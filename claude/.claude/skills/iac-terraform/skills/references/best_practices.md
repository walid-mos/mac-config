# Terraform Best Practices

Comprehensive guide to Terraform best practices for infrastructure as code.

## Table of Contents

1. [Project Structure](#project-structure)
2. [State Management](#state-management)
3. [Module Design](#module-design)
4. [Variable Management](#variable-management)
5. [Resource Naming](#resource-naming)
6. [Security Practices](#security-practices)
7. [Testing & Validation](#testing--validation)
8. [CI/CD Integration](#cicd-integration)

---

## Project Structure

### Recommended Directory Layout

```
terraform-project/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── terraform.tfvars
│   │   └── backend.tf
│   ├── staging/
│   └── prod/
├── modules/
│   ├── networking/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   ├── outputs.tf
│   │   ├── versions.tf
│   │   └── README.md
│   ├── compute/
│   └── database/
├── global/
│   ├── iam/
│   └── dns/
└── README.md
```

### Key Principles

**Separate Environments**
- Use directories for each environment (dev, staging, prod)
- Each environment has its own state file
- Prevents accidental changes to wrong environment

**Reusable Modules**
- Common infrastructure patterns in modules/
- Modules are versioned and tested
- Used across multiple environments

**Global Resources**
- Resources shared across environments (IAM, DNS)
- Separate state for better isolation
- Carefully managed with extra review

---

## State Management

### Remote State is Essential

**Why Remote State:**
- Team collaboration and locking
- State backup and versioning
- Secure credential handling
- Disaster recovery

**Recommended Backend: S3 + DynamoDB**

```hcl
terraform {
  backend "s3" {
    bucket         = "company-terraform-state"
    key            = "prod/networking/terraform.tfstate"
    region         = "us-east-1"
    encrypt        = true
    dynamodb_table = "terraform-state-lock"
    kms_key_id     = "arn:aws:kms:us-east-1:ACCOUNT:key/KEY_ID"
  }
}
```

**State Best Practices:**

1. **Enable Encryption**: Always encrypt state at rest
2. **Enable Versioning**: On S3 bucket for state recovery
3. **Use State Locking**: DynamoDB table prevents concurrent modifications
4. **Restrict Access**: IAM policies limiting who can read/write state
5. **Separate State Files**: Different states for different components
6. **Regular Backups**: Automated backups of state files

### State File Organization

**Bad - Single State:**
```
terraform.tfstate  (contains everything)
```

**Good - Multiple States:**
```
networking/terraform.tfstate
compute/terraform.tfstate
database/terraform.tfstate
```

**Benefits:**
- Reduced blast radius
- Faster plan/apply operations
- Parallel team work
- Easier to understand and debug

### State Management Commands

```bash
# List resources in state
terraform state list

# Show specific resource
terraform state show aws_instance.example

# Move resource to different address
terraform state mv aws_instance.old aws_instance.new

# Remove resource from state (doesn't destroy)
terraform state rm aws_instance.example

# Import existing resource
terraform import aws_instance.example i-1234567890abcdef0

# Pull state for inspection (read-only)
terraform state pull > state.json
```

---

## Module Design

### Module Structure

Every module should have:

```
module-name/
├── main.tf          # Primary resources
├── variables.tf     # Input variables
├── outputs.tf       # Output values
├── versions.tf      # Version constraints
├── README.md        # Documentation
└── examples/        # Usage examples
    └── complete/
        ├── main.tf
        └── variables.tf
```

### Module Best Practices

**1. Single Responsibility**
Each module should do one thing well:
- ✅ `vpc-module` creates VPC with subnets, route tables, NACLs
- ❌ `infrastructure` creates VPC, EC2, RDS, S3, everything

**2. Composability**
Modules should work together:
```hcl
module "vpc" {
  source = "./modules/vpc"
  cidr   = "10.0.0.0/16"
}

module "eks" {
  source     = "./modules/eks"
  vpc_id     = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids
}
```

**3. Sensible Defaults**
```hcl
variable "instance_type" {
  type        = string
  description = "EC2 instance type"
  default     = "t3.micro"  # Reasonable default
}

variable "enable_monitoring" {
  type        = bool
  description = "Enable detailed monitoring"
  default     = false  # Cost-effective default
}
```

**4. Complete Documentation**

```hcl
variable "vpc_cidr" {
  type        = string
  description = "CIDR block for VPC. Must be a valid IPv4 CIDR."
  
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "Must be a valid IPv4 CIDR block."
  }
}
```

**5. Output Useful Values**

```hcl
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "List of private subnet IDs for deploying workloads"
  value       = aws_subnet.private[*].id
}

output "nat_gateway_ips" {
  description = "Elastic IPs of NAT gateways for firewall whitelisting"
  value       = aws_eip.nat[*].public_ip
}
```

### Module Versioning

**Use Git Tags for Versioning:**
```hcl
module "vpc" {
  source = "git::https://github.com/company/terraform-modules.git//vpc?ref=v1.2.3"
  # Configuration...
}
```

**Semantic Versioning:**
- v1.0.0 → First stable release
- v1.1.0 → New features (backward compatible)
- v1.1.1 → Bug fixes
- v2.0.0 → Breaking changes

---

## Variable Management

### Variable Declaration

**Always Include:**
```hcl
variable "environment" {
  type        = string
  description = "Environment name (dev, staging, prod)"
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }
}
```

### Variable Files Hierarchy

```
terraform.tfvars        # Default values (committed, no secrets)
dev.tfvars             # Dev overrides
prod.tfvars            # Prod overrides  
secrets.auto.tfvars    # Auto-loaded (in .gitignore)
```

**Usage:**
```bash
terraform apply -var-file="prod.tfvars"
```

### Sensitive Variables

**Mark as Sensitive:**
```hcl
variable "database_password" {
  type        = string
  description = "Master password for database"
  sensitive   = true
}
```

**Never commit secrets:**
```bash
# .gitignore
*.auto.tfvars
secrets.tfvars
terraform.tfvars  # If contains secrets
```

**Better: Use External Secret Management**
```hcl
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "prod/database/master-password"
}

resource "aws_db_instance" "main" {
  password = data.aws_secretsmanager_secret_version.db_password.secret_string
}
```

### Variable Organization

**Group related variables:**
```hcl
# Network Configuration
variable "vpc_cidr" { }
variable "availability_zones" { }
variable "public_subnet_cidrs" { }
variable "private_subnet_cidrs" { }

# Application Configuration  
variable "app_name" { }
variable "app_version" { }
variable "instance_count" { }

# Tagging
variable "tags" {
  type        = map(string)
  description = "Common tags for all resources"
  default     = {}
}
```

---

## Resource Naming

### Naming Conventions

**Terraform Resources (snake_case):**
```hcl
resource "aws_vpc" "main_vpc" { }
resource "aws_subnet" "public_subnet_az1" { }
resource "aws_instance" "web_server_01" { }
```

**AWS Resource Names (kebab-case):**
```hcl
resource "aws_s3_bucket" "logs" {
  bucket = "company-prod-application-logs"
  # company-{env}-{service}-{purpose}
}

resource "aws_instance" "web" {
  tags = {
    Name = "prod-web-server-01"
    # {env}-{service}-{type}-{number}
  }
}
```

### Naming Standards

**Pattern: `{company}-{environment}-{service}-{resource_type}`**

Examples:
- `acme-prod-api-alb`
- `acme-dev-workers-asg`
- `acme-staging-database-rds`

**Benefits:**
- Easy filtering in AWS console
- Clear ownership and purpose
- Consistent across environments
- Billing and cost tracking

---

## Security Practices

### 1. Principle of Least Privilege

```hcl
# Bad - Too permissive
resource "aws_iam_policy" "bad" {
  policy = jsonencode({
    Statement = [{
      Effect   = "Allow"
      Action   = "*"
      Resource = "*"
    }]
  })
}

# Good - Specific permissions
resource "aws_iam_policy" "good" {
  policy = jsonencode({
    Statement = [{
      Effect = "Allow"
      Action = [
        "s3:GetObject",
        "s3:PutObject"
      ]
      Resource = "arn:aws:s3:::my-bucket/*"
    }]
  })
}
```

### 2. Encryption Everywhere

```hcl
# Encrypt S3 buckets
resource "aws_s3_bucket" "secure" {
  bucket = "my-secure-bucket"
}

resource "aws_s3_bucket_server_side_encryption_configuration" "secure" {
  bucket = aws_s3_bucket.secure.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm     = "aws:kms"
      kms_master_key_id = aws_kms_key.bucket.arn
    }
  }
}

# Encrypt EBS volumes
resource "aws_instance" "secure" {
  root_block_device {
    encrypted = true
  }
}

# Encrypt RDS databases
resource "aws_db_instance" "secure" {
  storage_encrypted = true
  kms_key_id       = aws_kms_key.rds.arn
}
```

### 3. Network Security

```hcl
# Restrictive security groups
resource "aws_security_group" "web" {
  name_prefix = "web-"
  
  # Only allow specific inbound
  ingress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]  # Consider restricting further
  }
  
  # Explicit outbound
  egress {
    from_port   = 443
    to_port     = 443
    protocol    = "tcp"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

# Use private subnets for workloads
resource "aws_subnet" "private" {
  map_public_ip_on_launch = false  # No public IPs
}
```

### 4. Secret Management

**Never in Code:**
```hcl
# ❌ NEVER DO THIS
resource "aws_db_instance" "bad" {
  password = "MySecretPassword123"  # NEVER!
}
```

**Use AWS Secrets Manager:**
```hcl
# ✅ CORRECT APPROACH
data "aws_secretsmanager_secret_version" "db" {
  secret_id = var.db_secret_arn
}

resource "aws_db_instance" "good" {
  password = data.aws_secretsmanager_secret_version.db.secret_string
}
```

### 5. Resource Tagging

```hcl
locals {
  common_tags = {
    Environment = var.environment
    ManagedBy   = "Terraform"
    Owner       = "platform-team"
    Project     = var.project_name
    CostCenter  = var.cost_center
  }
}

resource "aws_instance" "web" {
  tags = merge(
    local.common_tags,
    {
      Name = "web-server"
      Role = "webserver"
    }
  )
}
```

---

## Testing & Validation

### Pre-Deployment Validation

**1. Terraform Validate**
```bash
terraform validate
```
Checks syntax and configuration validity.

**2. Terraform Plan**
```bash
terraform plan -out=tfplan
```
Review changes before applying.

**3. tflint**
```bash
tflint --module
```
Linter for catching errors and enforcing conventions.

**4. checkov**
```bash
checkov -d .
```
Security and compliance scanning.

**5. terraform-docs**
```bash
terraform-docs markdown . > README.md
```
Auto-generate documentation.

### Automated Testing

**Terratest (Go):**
```go
func TestVPCCreation(t *testing.T) {
    terraformOptions := terraform.WithDefaultRetryableErrors(t, &terraform.Options{
        TerraformDir: "../examples/complete",
    })
    
    defer terraform.Destroy(t, terraformOptions)
    terraform.InitAndApply(t, terraformOptions)
    
    vpcId := terraform.Output(t, terraformOptions, "vpc_id")
    assert.NotEmpty(t, vpcId)
}
```

---

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Terraform

on:
  pull_request:
    branches: [main]
  push:
    branches: [main]

jobs:
  terraform:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Terraform
        uses: hashicorp/setup-terraform@v2
        
      - name: Terraform Init
        run: terraform init
        
      - name: Terraform Validate
        run: terraform validate
        
      - name: Terraform Plan
        run: terraform plan -no-color
        if: github.event_name == 'pull_request'
        
      - name: Terraform Apply
        run: terraform apply -auto-approve
        if: github.event_name == 'push' && github.ref == 'refs/heads/main'
```

### Best Practices for CI/CD

1. **Always run plan on PRs** - Review changes before merge
2. **Require approvals** - Human review for production
3. **Use workspaces or directories** - Separate pipeline per environment
4. **Store state remotely** - S3 backend with locking
5. **Use credential management** - OIDC or IAM roles, never store credentials
6. **Run security scans** - checkov, tfsec in pipeline
7. **Tag releases** - Version your infrastructure code

---

## Common Pitfalls to Avoid

### 1. Not Using Remote State
- ❌ Local state doesn't work for teams
- ✅ Use S3, Terraform Cloud, or other remote backend

### 2. Hardcoding Values
- ❌ `region = "us-east-1"` in every resource
- ✅ Use variables and locals

### 3. Not Using Modules
- ❌ Copying code between environments
- ✅ Create reusable modules

### 4. Ignoring State
- ❌ Manually modifying infrastructure
- ✅ All changes through Terraform

### 5. Poor Naming
- ❌ `resource "aws_instance" "i1" { }`
- ✅ `resource "aws_instance" "web_server_01" { }`

### 6. No Documentation
- ❌ No README, no comments
- ✅ Document everything

### 7. Massive State Files
- ❌ Single state for entire infrastructure
- ✅ Break into logical components

### 8. No Testing
- ❌ Apply directly to production
- ✅ Test in dev/staging first

---

## Quick Reference

### Essential Commands
```bash
# Initialize
terraform init

# Validate configuration
terraform validate

# Format code
terraform fmt -recursive

# Plan changes
terraform plan

# Apply changes
terraform apply

# Destroy resources
terraform destroy

# Show current state
terraform show

# List resources
terraform state list

# Output values
terraform output
```

### Useful Flags
```bash
# Plan without color
terraform plan -no-color

# Apply without prompts
terraform apply -auto-approve

# Destroy specific resource
terraform destroy -target=aws_instance.example

# Use specific var file
terraform apply -var-file="prod.tfvars"

# Set variable via CLI
terraform apply -var="environment=prod"
```
