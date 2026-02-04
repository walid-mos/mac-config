#!/usr/bin/env python3
"""
Terraform Module Scaffolding Tool
Creates a new Terraform module with proper structure and template files
"""
import argparse
import json
import os
import sys
from pathlib import Path
from typing import Dict, List

# Template content for module files
TEMPLATES = {
    "main.tf": '''# {module_name} module - Main configuration

resource "example_resource" "main" {{
  # TODO: Replace with actual resources
  name = var.name

  tags = merge(
    var.tags,
    {{
      Module = "{module_name}"
    }}
  )
}}
''',

    "variables.tf": '''# Input variables for {module_name} module

variable "name" {{
  type        = string
  description = "Name for the {module_name} resources"
}}

variable "tags" {{
  type        = map(string)
  description = "Common tags to apply to all resources"
  default     = {{}}
}}

variable "environment" {{
  type        = string
  description = "Environment name (dev, staging, prod)"

  validation {{
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be dev, staging, or prod."
  }}
}}
''',

    "outputs.tf": '''# Output values for {module_name} module

output "id" {{
  description = "ID of the created {module_name} resource"
  value       = example_resource.main.id
}}

output "arn" {{
  description = "ARN of the created {module_name} resource"
  value       = example_resource.main.arn
}}
''',

    "versions.tf": '''# Provider and Terraform version constraints

terraform {{
  required_version = ">= 1.5.0"

  required_providers {{
    aws = {{
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }}
  }}
}}
''',

    "README.md": '''# {module_title} Module

Terraform module for managing {module_name}.

## Usage

```hcl
module "{module_name}" {{
  source = "./modules/{module_name}"

  name        = "example"
  environment = "dev"

  tags = {{
    Project = "MyProject"
    Owner   = "TeamName"
  }}
}}
```

## Requirements

| Name | Version |
|------|---------|
| terraform | >= 1.5.0 |
| aws | ~> 5.0 |

## Inputs

| Name | Description | Type | Default | Required |
|------|-------------|------|---------|:--------:|
| name | Name for the {module_name} resources | `string` | n/a | yes |
| environment | Environment name (dev, staging, prod) | `string` | n/a | yes |
| tags | Common tags to apply to all resources | `map(string)` | `{{}}` | no |

## Outputs

| Name | Description |
|------|-------------|
| id | ID of the created {module_name} resource |
| arn | ARN of the created {module_name} resource |

## Examples

See the `examples/` directory for complete usage examples.

---

<!-- BEGIN_TF_DOCS -->
<!-- Run: terraform-docs markdown . > README.md -->
<!-- END_TF_DOCS -->
''',

    "examples/complete/main.tf": '''# Complete example for {module_name} module

module "{module_name}" {{
  source = "../.."

  name        = "example-{module_name}"
  environment = "dev"

  tags = {{
    Project     = "Example"
    Environment = "dev"
    ManagedBy   = "Terraform"
  }}
}}

output "{module_name}_id" {{
  description = "ID of the {module_name}"
  value       = module.{module_name}.id
}}
''',

    "examples/complete/versions.tf": '''terraform {{
  required_version = ">= 1.5.0"

  required_providers {{
    aws = {{
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }}
  }}
}}

provider "aws" {{
  region = "us-east-1"
}}
''',

    "examples/complete/README.md": '''# Complete Example

This example demonstrates the complete usage of the {module_name} module with all available options.

## Usage

```bash
terraform init
terraform plan
terraform apply
```

## Cleanup

```bash
terraform destroy
```
'''
}


def create_module_structure(module_name: str, base_path: str = ".") -> Dict:
    """
    Create the module directory structure with template files

    Args:
        module_name: Name of the module
        base_path: Base directory where module should be created

    Returns:
        Dict with status and details
    """
    result = {
        "success": False,
        "module_name": module_name,
        "path": None,
        "files_created": [],
        "errors": []
    }

    try:
        # Create base module directory
        module_path = Path(base_path) / module_name
        if module_path.exists():
            result["errors"].append(f"Module directory already exists: {module_path}")
            return result

        module_path.mkdir(parents=True, exist_ok=True)
        result["path"] = str(module_path.absolute())

        # Create examples directory
        examples_path = module_path / "examples" / "complete"
        examples_path.mkdir(parents=True, exist_ok=True)

        # Format module name for titles (replace hyphens with spaces, capitalize)
        module_title = module_name.replace("-", " ").replace("_", " ").title()

        # Create files from templates
        for filename, template in TEMPLATES.items():
            file_path = module_path / filename
            file_path.parent.mkdir(parents=True, exist_ok=True)

            content = template.format(
                module_name=module_name,
                module_title=module_title
            )

            file_path.write_text(content)
            result["files_created"].append(str(file_path.relative_to(base_path)))

        result["success"] = True

    except Exception as e:
        result["errors"].append(f"Error creating module: {str(e)}")

    return result


def main():
    parser = argparse.ArgumentParser(
        description="Initialize a new Terraform module with standard structure",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Create module in current directory
  %(prog)s my-vpc

  # Create module in specific path
  %(prog)s my-vpc --path ./modules

  # Output as JSON
  %(prog)s my-vpc --json
        """
    )

    parser.add_argument(
        "module_name",
        help="Name of the module to create (use lowercase with hyphens)"
    )

    parser.add_argument(
        "--path",
        default=".",
        help="Base directory where module should be created (default: current directory)"
    )

    parser.add_argument(
        "--json",
        action="store_true",
        help="Output result as JSON"
    )

    args = parser.parse_args()

    # Validate module name
    if not args.module_name.replace("-", "").replace("_", "").isalnum():
        print("Error: Module name should only contain lowercase letters, numbers, hyphens, and underscores",
              file=sys.stderr)
        sys.exit(1)

    # Create module
    result = create_module_structure(args.module_name, args.path)

    if args.json:
        print(json.dumps(result, indent=2))
    else:
        if result["success"]:
            print(f"✅ Successfully created module: {args.module_name}")
            print(f"📁 Location: {result['path']}")
            print(f"\n📝 Created {len(result['files_created'])} files:")
            for file in result["files_created"]:
                print(f"   - {file}")
            print(f"\n🚀 Next steps:")
            print(f"   1. cd {result['path']}")
            print(f"   2. Update main.tf with your resources")
            print(f"   3. Run: terraform init")
            print(f"   4. Run: terraform validate")
            print(f"   5. Generate docs: terraform-docs markdown . > README.md")
        else:
            print(f"❌ Failed to create module: {args.module_name}", file=sys.stderr)
            for error in result["errors"]:
                print(f"   Error: {error}", file=sys.stderr)
            sys.exit(1)

    sys.exit(0 if result["success"] else 1)


if __name__ == "__main__":
    main()
