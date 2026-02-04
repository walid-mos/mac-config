# Terraform Troubleshooting Guide

Common Terraform and Terragrunt issues with solutions.

## Table of Contents

1. [State Issues](#state-issues)
2. [Provider Issues](#provider-issues)
3. [Resource Errors](#resource-errors)
4. [Module Issues](#module-issues)
5. [Terragrunt Specific](#terragrunt-specific)
6. [Performance Issues](#performance-issues)

---

## State Issues

### State Lock Error

**Symptom:**
```
Error locking state: Error acquiring the state lock
Lock Info:
  ID:        abc123...
  Path:      terraform.tfstate
  Operation: OperationTypeApply
  Who:       user@hostname
  Created:   2024-01-15 10:30:00 UTC
```

**Common Causes:**
1. Previous operation crashed or was interrupted
2. Another user/process is running terraform
3. State lock wasn't released properly

**Resolution:**

1. **Verify no one else is running terraform:**
```bash
# Check with team first!
```

2. **Force unlock (use with caution):**
```bash
terraform force-unlock abc123
```

3. **For DynamoDB backend, check lock table:**
```bash
aws dynamodb get-item \
  --table-name terraform-state-lock \
  --key '{"LockID": {"S": "path/to/state/terraform.tfstate-md5"}}'
```

**Prevention:**
- Use proper state locking backend (S3 + DynamoDB)
- Implement timeout in CI/CD pipelines
- Always let terraform complete or properly cancel

---

### State Drift Detected

**Symptom:**
```
Note: Objects have changed outside of Terraform

Terraform detected the following changes made outside of Terraform
since the last "terraform apply":
```

**Common Causes:**
1. Manual changes in AWS console
2. Another tool modifying resources
3. Auto-scaling or auto-remediation

**Resolution:**

1. **Review the drift:**
```bash
terraform plan -detailed-exitcode
```

2. **Options:**
   - **Import changes:** Update terraform to match reality
   - **Revert changes:** Apply terraform to restore desired state
   - **Refresh state:** `terraform apply -refresh-only`

3. **Import specific changes:**
```bash
# Update your .tf files, then:
terraform plan  # Verify it matches
terraform apply
```

**Prevention:**
- Implement policy to prevent manual changes
- Use AWS Config rules to detect drift
- Regular `terraform plan` to catch drift early
- Consider using Terraform Cloud drift detection

---

### State Corruption

**Symptom:**
```
Error: Failed to load state
Error: state snapshot was created by Terraform v1.5.0, 
which is newer than current v1.3.0
```

**Common Causes:**
1. Using different Terraform versions
2. State file manually edited
3. Incomplete state upload

**Resolution:**

1. **Version mismatch:**
```bash
# Upgrade to matching version
tfenv install 1.5.0
tfenv use 1.5.0
```

2. **Restore from backup:**
```bash
# For S3 backend with versioning
aws s3api list-object-versions \
  --bucket terraform-state \
  --prefix prod/terraform.tfstate

# Restore specific version
aws s3api get-object \
  --bucket terraform-state \
  --key prod/terraform.tfstate \
  --version-id VERSION_ID \
  terraform.tfstate
```

3. **Rebuild state (last resort):**
```bash
# Remove corrupted state
terraform state rm aws_instance.example

# Re-import resources
terraform import aws_instance.example i-1234567890abcdef0
```

**Prevention:**
- Pin Terraform version in `versions.tf`
- Enable S3 versioning for state bucket
- Never manually edit state files
- Use consistent Terraform versions across team

---

## Provider Issues

### Provider Version Conflict

**Symptom:**
```
Error: Incompatible provider version

Provider registry.terraform.io/hashicorp/aws v5.0.0 does not have 
a package available for your current platform
```

**Resolution:**

1. **Specify version constraints:**
```hcl
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 4.67.0"  # Use compatible version
    }
  }
}
```

2. **Clean provider cache:**
```bash
rm -rf .terraform
terraform init -upgrade
```

3. **Lock file sync:**
```bash
terraform providers lock \
  -platform=darwin_amd64 \
  -platform=darwin_arm64 \
  -platform=linux_amd64
```

---

### Authentication Failures

**Symptom:**
```
Error: error configuring Terraform AWS Provider: 
no valid credential sources found
```

**Common Causes:**
1. Missing AWS credentials
2. Expired credentials
3. Incorrect IAM permissions

**Resolution:**

1. **Verify credentials:**
```bash
aws sts get-caller-identity
```

2. **Check credential order:**
   - Environment variables (AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY)
   - Shared credentials file (~/.aws/credentials)
   - IAM role (for EC2/ECS)

3. **Configure provider:**
```hcl
provider "aws" {
  region = "us-east-1"
  
  # Option 1: Use profile
  profile = "production"
  
  # Option 2: Assume role
  assume_role {
    role_arn = "arn:aws:iam::ACCOUNT:role/TerraformRole"
  }
}
```

4. **Check IAM permissions:**
```bash
# Test specific permission
aws ec2 describe-instances --dry-run
```

**Prevention:**
- Use IAM roles in CI/CD
- Implement OIDC for GitHub Actions
- Regular credential rotation
- Use AWS SSO for developers

---

## Resource Errors

### Resource Already Exists

**Symptom:**
```
Error: creating EC2 Instance: EntityAlreadyExists: 
Resource with id 'i-1234567890abcdef0' already exists
```

**Resolution:**

1. **Import existing resource:**
```bash
terraform import aws_instance.web i-1234567890abcdef0
```

2. **Verify configuration matches:**
```bash
terraform plan  # Should show no changes after import
```

3. **If configuration differs, update it:**
```hcl
resource "aws_instance" "web" {
  ami           = "ami-abc123"  # Match existing
  instance_type = "t3.micro"    # Match existing
}
```

---

### Dependency Errors

**Symptom:**
```
Error: resource depends on resource "aws_vpc.main" that 
is not declared in the configuration
```

**Resolution:**

1. **Add explicit dependency:**
```hcl
resource "aws_subnet" "private" {
  vpc_id = aws_vpc.main.id
  
  depends_on = [
    aws_internet_gateway.main  # Explicit dependency
  ]
}
```

2. **Use data sources for existing resources:**
```hcl
data "aws_vpc" "existing" {
  id = "vpc-12345678"
}

resource "aws_subnet" "new" {
  vpc_id = data.aws_vpc.existing.id
}
```

---

### Timeout Errors

**Symptom:**
```
Error: timeout while waiting for state to become 'available'
(last state: 'pending', timeout: 10m0s)
```

**Resolution:**

1. **Increase timeout:**
```hcl
resource "aws_db_instance" "main" {
  # ... configuration ...
  
  timeouts {
    create = "60m"
    update = "60m"
    delete = "60m"
  }
}
```

2. **Check resource status manually:**
```bash
aws rds describe-db-instances --db-instance-identifier mydb
```

3. **Retry the operation:**
```bash
terraform apply
```

---

## Module Issues

### Module Source Not Found

**Symptom:**
```
Error: Failed to download module

Could not download module "vpc" (main.tf:10) source: 
git::https://github.com/company/terraform-modules.git//vpc
```

**Resolution:**

1. **Verify source URL:**
```hcl
module "vpc" {
  source = "git::https://github.com/company/terraform-modules.git//vpc?ref=v1.0.0"
  # Add authentication if private repo
}
```

2. **For private repos, configure Git auth:**
```bash
# SSH key
git config --global url."git@github.com:".insteadOf "https://github.com/"

# Or use HTTPS with token
git config --global url."https://oauth2:TOKEN@github.com/".insteadOf "https://github.com/"
```

3. **Clear module cache:**
```bash
rm -rf .terraform/modules
terraform init
```

---

### Module Version Conflicts

**Symptom:**
```
Error: Inconsistent dependency lock file

Module has dependencies locked at version 1.0.0 but 
root module requires version 2.0.0
```

**Resolution:**

1. **Update lock file:**
```bash
terraform init -upgrade
```

2. **Pin module version:**
```hcl
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 3.0"  # Compatible with 3.x
}
```

---

## Terragrunt Specific

### Dependency Cycle Detected

**Symptom:**
```
Error: Dependency cycle detected:
  module-a depends on module-b
  module-b depends on module-c  
  module-c depends on module-a
```

**Resolution:**

1. **Review dependencies in terragrunt.hcl:**
```hcl
dependency "vpc" {
  config_path = "../vpc"
}

dependency "database" {
  config_path = "../database"
}

# Don't create circular references!
```

2. **Refactor to remove cycle:**
   - Split modules differently
   - Use data sources instead of dependencies
   - Pass values through variables

3. **Use mock outputs during planning:**
```hcl
dependency "vpc" {
  config_path = "../vpc"
  
  mock_outputs = {
    vpc_id = "vpc-mock"
  }
  mock_outputs_allowed_terraform_commands = ["validate", "plan"]
}
```

---

### Hook Failures

**Symptom:**
```
Error: Hook execution failed
Command: pre_apply_hook.sh
Exit code: 1
```

**Resolution:**

1. **Debug the hook:**
```bash
# Run hook manually
bash .terragrunt-cache/.../pre_apply_hook.sh
```

2. **Add error handling to hook:**
```bash
#!/bin/bash
set -e  # Exit on error

# Your hook logic
if ! command -v jq &> /dev/null; then
    echo "jq is required but not installed"
    exit 1
fi
```

3. **Make hook executable:**
```bash
chmod +x hooks/pre_apply_hook.sh
```

---

### Include Path Issues

**Symptom:**
```
Error: Cannot include file
Path does not exist: ../common.hcl
```

**Resolution:**

1. **Use correct relative path:**
```hcl
include "root" {
  path = find_in_parent_folders()
}

include "common" {
  path = "${get_terragrunt_dir()}/../common.hcl"
}
```

2. **Verify file exists:**
```bash
ls -la ../common.hcl
```

---

## Performance Issues

### Slow Plans/Applies

**Symptoms:**
- `terraform plan` takes >5 minutes
- `terraform apply` very slow
- State operations timing out

**Common Causes:**
1. Too many resources in single state
2. Slow provider API calls
3. Large number of data sources
4. Complex interpolations

**Resolution:**

1. **Split state files:**
```
networking/     # Separate state
compute/        # Separate state  
database/       # Separate state
```

2. **Use targeted operations:**
```bash
terraform plan -target=aws_instance.web
terraform apply -target=module.vpc
```

3. **Optimize data sources:**
```hcl
# Bad - queries every plan
data "aws_ami" "ubuntu" {
  most_recent = true
  # ... filters
}

# Better - use specific AMI
variable "ami_id" {
  default = "ami-abc123"  # Update periodically
}
```

4. **Enable parallelism:**
```bash
terraform apply -parallelism=20  # Default is 10
```

5. **Use caching (Terragrunt):**
```hcl
remote_state {
  backend = "s3"
  config = {
    skip_credentials_validation = true  # Faster
    skip_metadata_api_check     = true
  }
}
```

---

## Quick Diagnostic Steps

When encountering any Terraform error:

1. **Read the full error message** - Don't skip details
2. **Check recent changes** - What changed since last successful run?
3. **Verify versions** - Terraform, providers, modules
4. **Check state** - Is it locked? Corrupted?
5. **Test authentication** - Can you access resources manually?
6. **Review logs** - Use TF_LOG=DEBUG for detailed output
7. **Isolate the problem** - Use -target to test specific resources

### Enable Debug Logging

```bash
export TF_LOG=DEBUG
export TF_LOG_PATH=terraform-debug.log
terraform plan
```

### Test Configuration

```bash
terraform validate  # Syntax check
terraform fmt -check  # Format check
tflint  # Linting
```

---

## Prevention Checklist

- [ ] Use remote state with locking
- [ ] Pin Terraform and provider versions
- [ ] Implement pre-commit hooks
- [ ] Run plan before every apply
- [ ] Use modules for reusable components
- [ ] Enable state versioning/backups
- [ ] Document architecture and dependencies
- [ ] Implement CI/CD with proper reviews
- [ ] Regular terraform plan in CI to detect drift
- [ ] Monitor and alert on state changes
