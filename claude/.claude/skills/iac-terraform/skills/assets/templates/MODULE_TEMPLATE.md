# Terraform Module Template

This directory contains templates for creating well-structured Terraform modules.

## Module Structure

```
module-name/
├── main.tf           # Primary resource definitions
├── variables.tf      # Input variables
├── outputs.tf        # Output values
├── versions.tf       # Version constraints
├── README.md         # Module documentation
└── examples/         # Usage examples
    └── complete/
        ├── main.tf
        ├── variables.tf
        └── outputs.tf
```

## Template Files

### main.tf
```hcl
# Main resource definitions
terraform {
  # No backend configuration in modules
}

# Example: VPC Module
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = var.enable_dns_hostnames
  enable_dns_support   = var.enable_dns_support
  
  tags = merge(
    var.tags,
    {
      Name = var.name
    }
  )
}

# Use locals for computed values
locals {
  availability_zones = slice(data.aws_availability_zones.available.names, 0, var.az_count)
}
```

### variables.tf
```hcl
variable "name" {
  description = "Name to be used on all resources as prefix"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  
  validation {
    condition     = can(cidrhost(var.vpc_cidr, 0))
    error_message = "Must be a valid IPv4 CIDR block."
  }
}

variable "enable_dns_hostnames" {
  description = "Enable DNS hostnames in the VPC"
  type        = bool
  default     = true
}

variable "tags" {
  description = "A map of tags to add to all resources"
  type        = map(string)
  default     = {}
}

# For sensitive values
variable "database_password" {
  description = "Master password for the database"
  type        = string
  sensitive   = true
}

# With validation
variable "environment" {
  description = "Environment name"
  type        = string
  
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

# Complex types
variable "subnets" {
  description = "Map of subnet configurations"
  type = map(object({
    cidr_block        = string
    availability_zone = string
    public            = bool
  }))
  default = {}
}
```

### outputs.tf
```hcl
output "vpc_id" {
  description = "The ID of the VPC"
  value       = aws_vpc.main.id
}

output "vpc_cidr" {
  description = "The CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}

output "private_subnet_ids" {
  description = "List of IDs of private subnets"
  value       = aws_subnet.private[*].id
}

# Sensitive outputs
output "database_endpoint" {
  description = "Database connection endpoint"
  value       = aws_db_instance.main.endpoint
  sensitive   = true
}

# Complex outputs
output "subnet_details" {
  description = "Detailed information about all subnets"
  value = {
    for subnet in aws_subnet.main :
    subnet.id => {
      cidr_block        = subnet.cidr_block
      availability_zone = subnet.availability_zone
      public            = subnet.map_public_ip_on_launch
    }
  }
}
```

### versions.tf
```hcl
terraform {
  required_version = ">= 1.3.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0.0"
    }
  }
}
```

### README.md Template
```markdown
# Module Name

Brief description of what this module does.

## Usage

\`\`\`hcl
module "example" {
  source = "./modules/module-name"
  
  name             = "my-resource"
  vpc_cidr         = "10.0.0.0/16"
  environment      = "prod"
  
  tags = {
    Environment = "prod"
    Project     = "example"
  }
}
\`\`\`

## Examples

- [Complete](./examples/complete) - Full example with all options

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.3.0 |
| aws | >= 5.0.0 |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| name | Resource name | `string` | n/a | yes |
| vpc_cidr | VPC CIDR block | `string` | n/a | yes |
| environment | Environment name | `string` | n/a | yes |
| tags | Common tags | `map(string)` | `{}` | no |

## Outputs

| Name | Description |
|------|-------------|
| vpc_id | VPC identifier |
| private_subnet_ids | List of private subnet IDs |

## Authors

Module is maintained by [Your Team].

## License

Apache 2 Licensed. See LICENSE for full details.
\`\`\`

## Example: Complete Usage Example

### examples/complete/main.tf
```hcl
module "vpc" {
  source = "../../"
  
  name                 = "example-vpc"
  vpc_cidr            = "10.0.0.0/16"
  environment         = "dev"
  enable_dns_hostnames = true
  
  tags = {
    Environment = "dev"
    Project     = "example"
    ManagedBy   = "Terraform"
  }
}
```

### examples/complete/outputs.tf
```hcl
output "vpc_id" {
  description = "The ID of the VPC"
  value       = module.vpc.vpc_id
}
```

### examples/complete/variables.tf
```hcl
variable "region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}
```

## Terragrunt Configuration Template

### terragrunt.hcl (root)
```hcl
# Root terragrunt.hcl
locals {
  # Load account-level variables
  account_vars = read_terragrunt_config(find_in_parent_folders("account.hcl"))
  
  # Load region-level variables  
  region_vars = read_terragrunt_config(find_in_parent_folders("region.hcl"))
  
  # Load environment variables
  environment_vars = read_terragrunt_config(find_in_parent_folders("env.hcl"))
  
  # Extract commonly used variables
  account_name = local.account_vars.locals.account_name
  account_id   = local.account_vars.locals.account_id
  aws_region   = local.region_vars.locals.aws_region
  environment  = local.environment_vars.locals.environment
}

# Generate provider configuration
generate "provider" {
  path      = "provider.tf"
  if_exists = "overwrite_terragrunt"
  contents  = <<EOF
provider "aws" {
  region = "${local.aws_region}"
  
  assume_role {
    role_arn = "arn:aws:iam::${local.account_id}:role/TerraformRole"
  }
  
  default_tags {
    tags = {
      Environment = "${local.environment}"
      ManagedBy   = "Terragrunt"
      Account     = "${local.account_name}"
    }
  }
}
EOF
}

# Configure S3 backend
remote_state {
  backend = "s3"
  
  generate = {
    path      = "backend.tf"
    if_exists = "overwrite_terragrunt"
  }
  
  config = {
    bucket         = "${local.account_name}-terraform-state"
    key            = "${path_relative_to_include()}/terraform.tfstate"
    region         = local.aws_region
    encrypt        = true
    dynamodb_table = "${local.account_name}-terraform-lock"
    
    s3_bucket_tags = {
      Name        = "Terraform State"
      Environment = local.environment
    }
    
    dynamodb_table_tags = {
      Name        = "Terraform Lock"
      Environment = local.environment
    }
  }
}

# Global inputs for all modules
inputs = {
  account_name = local.account_name
  account_id   = local.account_id
  aws_region   = local.aws_region
  environment  = local.environment
}
```

### terragrunt.hcl (module level)
```hcl
# Include root configuration
include "root" {
  path = find_in_parent_folders()
}

# Define terraform source
terraform {
  source = "git::https://github.com/company/terraform-modules.git//vpc?ref=v1.0.0"
}

# Dependencies on other modules
dependency "iam" {
  config_path = "../iam"
  
  mock_outputs = {
    role_arn = "arn:aws:iam::123456789012:role/mock"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}

# Module-specific inputs
inputs = {
  name     = "my-vpc"
  vpc_cidr = "10.0.0.0/16"
  
  # Use dependency outputs
  iam_role_arn = dependency.iam.outputs.role_arn
  
  # Module-specific tags
  tags = {
    Component = "networking"
    Module    = "vpc"
  }
}
```

## Best Practices

1. **Always include descriptions** for variables and outputs
2. **Use validation blocks** for important variables
3. **Mark sensitive values** as sensitive
4. **Provide sensible defaults** where appropriate
5. **Document everything** in README
6. **Include usage examples** in examples/ directory
7. **Version your modules** using Git tags
8. **Test modules** before tagging new versions
