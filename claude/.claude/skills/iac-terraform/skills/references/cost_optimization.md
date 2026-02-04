# Terraform Cost Optimization Guide

Strategies for optimizing cloud infrastructure costs when using Terraform.

## Table of Contents

1. [Right-Sizing Resources](#right-sizing-resources)
2. [Spot and Reserved Instances](#spot-and-reserved-instances)
3. [Storage Optimization](#storage-optimization)
4. [Networking Costs](#networking-costs)
5. [Resource Lifecycle](#resource-lifecycle)
6. [Cost Tagging](#cost-tagging)
7. [Monitoring and Alerts](#monitoring-and-alerts)
8. [Multi-Cloud Considerations](#multi-cloud-considerations)

---

## Right-Sizing Resources

### Compute Resources

**Start small, scale up:**
```hcl
variable "instance_type" {
  type        = string
  description = "EC2 instance type"
  default     = "t3.micro"  # Start with smallest reasonable size

  validation {
    condition     = can(regex("^t[0-9]\\.", var.instance_type))
    error_message = "Consider starting with burstable (t-series) instances for cost optimization."
  }
}
```

**Use auto-scaling instead of over-provisioning:**
```hcl
resource "aws_autoscaling_group" "app" {
  min_size         = 2   # Minimum for HA
  desired_capacity = 2   # Normal load
  max_size         = 10  # Peak load

  # Scale based on actual usage
  target_group_arns = [aws_lb_target_group.app.arn]

  tag {
    key                 = "Environment"
    value               = var.environment
    propagate_at_launch = true
  }
}
```

### Database Right-Sizing

**Start with appropriate size:**
```hcl
resource "aws_db_instance" "main" {
  instance_class = var.environment == "prod" ? "db.t3.medium" : "db.t3.micro"

  # Enable auto-scaling for storage
  allocated_storage     = 20
  max_allocated_storage = 100  # Auto-scale up to 100GB

  # Use cheaper storage for non-prod
  storage_type = var.environment == "prod" ? "io1" : "gp3"
}
```

---

## Spot and Reserved Instances

### Spot Instances for Non-Critical Workloads

**Launch Template for Spot:**
```hcl
resource "aws_launch_template" "spot" {
  name_prefix   = "spot-"
  image_id      = data.aws_ami.amazon_linux.id
  instance_type = "t3.medium"

  instance_market_options {
    market_type = "spot"

    spot_options {
      max_price                      = "0.05"  # Set price limit
      spot_instance_type             = "one-time"
      instance_interruption_behavior = "terminate"
    }
  }

  tag_specifications {
    resource_type = "instance"
    tags = {
      Name        = "spot-instance"
      Workload    = "non-critical"
      CostSavings = "true"
    }
  }
}

resource "aws_autoscaling_group" "spot" {
  desired_capacity = 5
  max_size         = 10
  min_size         = 0

  mixed_instances_policy {
    instances_distribution {
      on_demand_percentage_above_base_capacity = 20  # 20% on-demand, 80% spot
      spot_allocation_strategy                 = "capacity-optimized"
    }

    launch_template {
      launch_template_specification {
        launch_template_id = aws_launch_template.spot.id
        version            = "$Latest"
      }

      # Multiple instance types increase spot availability
      override {
        instance_type = "t3.medium"
      }
      override {
        instance_type = "t3.large"
      }
      override {
        instance_type = "t3a.medium"
      }
    }
  }
}
```

### Reserved Instances (Use Outside Terraform)

Terraform shouldn't manage reservations directly, but should:
- Tag resources consistently for reservation planning
- Use Instance Savings Plans for flexibility
- Monitor usage patterns to inform reservation purchases

**Tagging for reservation analysis:**
```hcl
locals {
  reservation_tags = {
    ReservationCandidate = var.environment == "prod" ? "true" : "false"
    UsagePattern         = "steady-state"  # or "variable", "burst"
    CostCenter          = var.cost_center
  }
}
```

---

## Storage Optimization

### S3 Lifecycle Policies

**Automatic tiering:**
```hcl
resource "aws_s3_bucket_lifecycle_configuration" "logs" {
  bucket = aws_s3_bucket.logs.id

  rule {
    id     = "log-retention"
    status = "Enabled"

    transition {
      days          = 30
      storage_class = "STANDARD_IA"  # Infrequent Access after 30 days
    }

    transition {
      days          = 90
      storage_class = "GLACIER_IR"  # Instant Retrieval Glacier after 90 days
    }

    transition {
      days          = 180
      storage_class = "DEEP_ARCHIVE"  # Deep Archive after 180 days
    }

    expiration {
      days = 365  # Delete after 1 year
    }
  }
}
```

**Intelligent tiering for variable access:**
```hcl
resource "aws_s3_bucket_intelligent_tiering_configuration" "assets" {
  bucket = aws_s3_bucket.assets.id
  name   = "entire-bucket"

  tiering {
    access_tier = "ARCHIVE_ACCESS"
    days        = 90
  }

  tiering {
    access_tier = "DEEP_ARCHIVE_ACCESS"
    days        = 180
  }
}
```

### EBS Volume Optimization

**Use appropriate volume types:**
```hcl
resource "aws_instance" "app" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = "t3.medium"

  root_block_device {
    volume_type = "gp3"  # gp3 is cheaper than gp2 with better baseline
    volume_size = 20
    iops        = 3000   # Default, only pay more if you need more
    throughput  = 125    # Default
    encrypted   = true

    # Delete on termination to avoid orphaned volumes
    delete_on_termination = true
  }

  tags = {
    Name = "app-server"
  }
}
```

**Snapshot lifecycle:**
```hcl
resource "aws_dlm_lifecycle_policy" "snapshots" {
  description        = "EBS snapshot lifecycle"
  execution_role_arn = aws_iam_role.dlm.arn
  state              = "ENABLED"

  policy_details {
    resource_types = ["VOLUME"]

    schedule {
      name = "Daily snapshots"

      create_rule {
        interval      = 24
        interval_unit = "HOURS"
        times         = ["03:00"]
      }

      retain_rule {
        count = 7  # Keep only 7 days of snapshots
      }

      copy_tags = true
    }

    target_tags = {
      BackupEnabled = "true"
    }
  }
}
```

---

## Networking Costs

### Minimize Data Transfer

**Use VPC endpoints to avoid NAT charges:**
```hcl
resource "aws_vpc_endpoint" "s3" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${var.region}.s3"
  route_table_ids = [
    aws_route_table.private.id
  ]

  tags = {
    Name        = "s3-endpoint"
    CostSavings = "reduces-nat-charges"
  }
}

resource "aws_vpc_endpoint" "dynamodb" {
  vpc_id       = aws_vpc.main.id
  service_name = "com.amazonaws.${var.region}.dynamodb"
  route_table_ids = [
    aws_route_table.private.id
  ]
}
```

**Interface endpoints for AWS services:**
```hcl
resource "aws_vpc_endpoint" "ecr_api" {
  vpc_id              = aws_vpc.main.id
  service_name        = "com.amazonaws.${var.region}.ecr.api"
  vpc_endpoint_type   = "Interface"
  subnet_ids          = aws_subnet.private[*].id
  security_group_ids  = [aws_security_group.vpc_endpoints.id]
  private_dns_enabled = true

  tags = {
    Name        = "ecr-api-endpoint"
    CostSavings = "reduces-nat-data-transfer"
  }
}
```

### Regional Optimization

**Co-locate resources in same region/AZ:**
```hcl
# Bad - cross-region data transfer is expensive
resource "aws_instance" "app" {
  availability_zone = "us-east-1a"
}

resource "aws_rds_cluster" "main" {
  availability_zones = ["us-west-2a"]  # Different region!
}

# Good - same region and AZ when possible
resource "aws_instance" "app" {
  availability_zone = var.availability_zone
}

resource "aws_rds_cluster" "main" {
  availability_zones = [var.availability_zone]  # Same AZ
}
```

---

## Resource Lifecycle

### Scheduled Shutdown for Non-Production

**Lambda to stop/start instances:**
```hcl
resource "aws_lambda_function" "scheduler" {
  filename      = "scheduler.zip"
  function_name = "instance-scheduler"
  role          = aws_iam_role.scheduler.arn
  handler       = "scheduler.handler"
  runtime       = "python3.9"

  environment {
    variables = {
      TAG_KEY   = "Schedule"
      TAG_VALUE = "business-hours"
    }
  }
}

# EventBridge rule to stop instances at night
resource "aws_cloudwatch_event_rule" "stop_instances" {
  name                = "stop-dev-instances"
  description         = "Stop dev instances at 7 PM"
  schedule_expression = "cron(0 19 ? * MON-FRI *)"  # 7 PM weekdays
}

resource "aws_cloudwatch_event_target" "stop" {
  rule      = aws_cloudwatch_event_rule.stop_instances.name
  target_id = "stop-instances"
  arn       = aws_lambda_function.scheduler.arn

  input = jsonencode({
    action = "stop"
  })
}

# Start instances in the morning
resource "aws_cloudwatch_event_rule" "start_instances" {
  name                = "start-dev-instances"
  description         = "Start dev instances at 8 AM"
  schedule_expression = "cron(0 8 ? * MON-FRI *)"  # 8 AM weekdays
}
```

**Tag instances for scheduling:**
```hcl
resource "aws_instance" "dev" {
  ami           = data.aws_ami.amazon_linux.id
  instance_type = "t3.medium"

  tags = {
    Name        = "dev-server"
    Environment = "dev"
    Schedule    = "business-hours"  # Scheduler will stop/start based on this
    AutoShutdown = "true"
  }
}
```

### Cleanup Old Resources

**S3 lifecycle for temporary data:**
```hcl
resource "aws_s3_bucket_lifecycle_configuration" "temp" {
  bucket = aws_s3_bucket.temp.id

  rule {
    id     = "cleanup-temp-files"
    status = "Enabled"

    filter {
      prefix = "temp/"
    }

    expiration {
      days = 7  # Delete after 7 days
    }

    abort_incomplete_multipart_upload {
      days_after_initiation = 1
    }
  }
}
```

---

## Cost Tagging

### Comprehensive Tagging Strategy

**Define tagging locals:**
```hcl
locals {
  common_tags = {
    # Cost allocation tags
    CostCenter  = var.cost_center
    Project     = var.project_name
    Environment = var.environment
    Owner       = var.team_email

    # Operational tags
    ManagedBy       = "Terraform"
    TerraformModule = basename(abspath(path.module))

    # Cost optimization tags
    AutoShutdown        = var.environment != "prod" ? "enabled" : "disabled"
    ReservationCandidate = var.environment == "prod" ? "true" : "false"
    CostOptimized       = "true"
  }
}

# Apply to all resources
resource "aws_instance" "app" {
  # ... configuration ...

  tags = merge(
    local.common_tags,
    {
      Name = "${var.environment}-app-server"
      Role = "application"
    }
  )
}
```

**Enforce tagging with AWS Config:**
```hcl
resource "aws_config_config_rule" "required_tags" {
  name = "required-tags"

  source {
    owner             = "AWS"
    source_identifier = "REQUIRED_TAGS"
  }

  input_parameters = jsonencode({
    tag1Key = "CostCenter"
    tag2Key = "Environment"
    tag3Key = "Owner"
  })

  depends_on = [aws_config_configuration_recorder.main]
}
```

---

## Monitoring and Alerts

### Budget Alerts

**AWS Budgets with Terraform:**
```hcl
resource "aws_budgets_budget" "monthly" {
  name              = "${var.environment}-monthly-budget"
  budget_type       = "COST"
  limit_amount      = var.monthly_budget
  limit_unit        = "USD"
  time_unit         = "MONTHLY"
  time_period_start = "2024-01-01_00:00"

  cost_filter {
    name = "TagKeyValue"
    values = [
      "Environment$${var.environment}"
    ]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 80
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }

  notification {
    comparison_operator        = "GREATER_THAN"
    threshold                  = 100
    threshold_type             = "PERCENTAGE"
    notification_type          = "ACTUAL"
    subscriber_email_addresses = [var.budget_alert_email]
  }
}
```

### Cost Anomaly Detection

```hcl
resource "aws_ce_anomaly_monitor" "service" {
  name              = "${var.environment}-service-monitor"
  monitor_type      = "DIMENSIONAL"
  monitor_dimension = "SERVICE"
}

resource "aws_ce_anomaly_subscription" "alerts" {
  name      = "${var.environment}-anomaly-alerts"
  frequency = "DAILY"

  monitor_arn_list = [
    aws_ce_anomaly_monitor.service.arn
  ]

  subscriber {
    type    = "EMAIL"
    address = var.cost_alert_email
  }

  threshold_expression {
    dimension {
      key           = "ANOMALY_TOTAL_IMPACT_ABSOLUTE"
      values        = ["100"]  # Alert on $100+ anomalies
      match_options = ["GREATER_THAN_OR_EQUAL"]
    }
  }
}
```

---

## Multi-Cloud Considerations

### Azure Cost Optimization

**Use Azure Hybrid Benefit:**
```hcl
resource "azurerm_linux_virtual_machine" "main" {
  # ... configuration ...

  # Use Azure Hybrid Benefit for licensing savings
  license_type = "RHEL_BYOS"  # or "SLES_BYOS"
}
```

**Azure Reserved Instances (outside Terraform):**
- Purchase through Azure Portal
- Tag VMs with `ReservationGroup` for planning

### GCP Cost Optimization

**Use committed use discounts:**
```hcl
resource "google_compute_instance" "main" {
  # ... configuration ...

  # Use committed use discount
  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    preemptible         = var.environment != "prod"  # Preemptible for non-prod
  }
}
```

**GCP Preemptible VMs:**
```hcl
resource "google_compute_instance_template" "preemptible" {
  machine_type = "n1-standard-1"

  scheduling {
    automatic_restart   = false
    on_host_maintenance = "TERMINATE"
    preemptible         = true  # Up to 80% cost reduction
  }
}
```

---

## Cost Optimization Checklist

### Before Deployment
- [ ] Right-size compute resources (start small)
- [ ] Use appropriate storage tiers
- [ ] Enable auto-scaling instead of over-provisioning
- [ ] Implement tagging strategy
- [ ] Configure lifecycle policies
- [ ] Set up VPC endpoints for AWS services

### After Deployment
- [ ] Monitor actual usage vs. provisioned capacity
- [ ] Review cost allocation tags
- [ ] Identify reservation opportunities
- [ ] Configure budget alerts
- [ ] Enable cost anomaly detection
- [ ] Schedule non-production resource shutdown

### Ongoing
- [ ] Monthly cost review
- [ ] Quarterly right-sizing analysis
- [ ] Annual reservation review
- [ ] Remove unused resources
- [ ] Optimize data transfer patterns
- [ ] Update instance families (new generations are often cheaper)

---

## Cost Estimation Tools

### Use `infracost` in CI/CD

```bash
# Install infracost
curl -fsSL https://raw.githubusercontent.com/infracost/infracost/master/scripts/install.sh | sh

# Generate cost estimate
infracost breakdown --path .

# Compare cost changes in PR
infracost diff --path . --compare-to tfplan.json
```

### Terraform Cloud Cost Estimation

Enable in Terraform Cloud workspace settings for automatic cost estimates on every plan.

---

## Additional Resources

- AWS Cost Optimization: https://aws.amazon.com/pricing/cost-optimization/
- Azure Cost Management: https://azure.microsoft.com/en-us/products/cost-management/
- GCP Cost Management: https://cloud.google.com/cost-management
- Infracost: https://www.infracost.io/
- Cloud Cost Optimization Tools: Kubecost, CloudHealth, CloudCheckr
