#!/usr/bin/env python3
"""
Terraform Module Validator
Validates Terraform modules against best practices
"""
import os
import sys
import re
from pathlib import Path
from typing import Dict, List, Any

class ModuleValidator:
    def __init__(self, module_path: str):
        self.module_path = Path(module_path)
        self.issues = []
        self.warnings = []
        self.suggestions = []
        
    def validate(self) -> Dict[str, Any]:
        """Run all validation checks"""
        print(f"🔍 Validating module: {self.module_path}\n")
        
        self.check_required_files()
        self.check_variables_file()
        self.check_outputs_file()
        self.check_readme()
        self.check_versions_file()
        self.check_examples()
        self.check_naming_conventions()
        
        return {
            "valid": len(self.issues) == 0,
            "issues": self.issues,
            "warnings": self.warnings,
            "suggestions": self.suggestions
        }
    
    def check_required_files(self):
        """Check for required module files"""
        required_files = ['main.tf', 'variables.tf', 'outputs.tf']
        
        for file in required_files:
            if not (self.module_path / file).exists():
                self.issues.append(f"Missing required file: {file}")
    
    def check_variables_file(self):
        """Check variables.tf for best practices"""
        vars_file = self.module_path / 'variables.tf'
        if not vars_file.exists():
            return
        
        content = vars_file.read_text()
        
        # Check for variable descriptions
        variable_blocks = re.findall(r'variable\s+"([^"]+)"\s*{([^}]+)}', content, re.DOTALL)
        
        for var_name, var_content in variable_blocks:
            if 'description' not in var_content:
                self.warnings.append(f"Variable '{var_name}' missing description")
            
            if 'type' not in var_content:
                self.warnings.append(f"Variable '{var_name}' missing type constraint")
            
            # Check for sensitive variables without sensitive flag
            if any(keyword in var_name.lower() for keyword in ['password', 'secret', 'key', 'token']):
                if 'sensitive' not in var_content or 'sensitive = true' not in var_content:
                    self.warnings.append(f"Variable '{var_name}' appears sensitive but not marked as sensitive")
    
    def check_outputs_file(self):
        """Check outputs.tf for best practices"""
        outputs_file = self.module_path / 'outputs.tf'
        if not outputs_file.exists():
            return
        
        content = outputs_file.read_text()
        
        # Check for output descriptions
        output_blocks = re.findall(r'output\s+"([^"]+)"\s*{([^}]+)}', content, re.DOTALL)
        
        if len(output_blocks) == 0:
            self.suggestions.append("Consider adding outputs to expose useful resource attributes")
        
        for output_name, output_content in output_blocks:
            if 'description' not in output_content:
                self.warnings.append(f"Output '{output_name}' missing description")
            
            # Check for sensitive outputs
            if any(keyword in output_name.lower() for keyword in ['password', 'secret', 'key', 'token']):
                if 'sensitive' not in output_content or 'sensitive = true' not in output_content:
                    self.warnings.append(f"Output '{output_name}' appears sensitive but not marked as sensitive")
    
    def check_readme(self):
        """Check for README documentation"""
        readme_files = ['README.md', 'readme.md', 'README.txt']
        has_readme = any((self.module_path / f).exists() for f in readme_files)
        
        if not has_readme:
            self.issues.append("Missing README.md - modules should be documented")
            return
        
        # Find which readme exists
        readme_path = None
        for f in readme_files:
            if (self.module_path / f).exists():
                readme_path = self.module_path / f
                break
        
        if readme_path:
            content = readme_path.read_text()
            
            # Check for key sections
            required_sections = ['Usage', 'Inputs', 'Outputs']
            for section in required_sections:
                if section.lower() not in content.lower():
                    self.suggestions.append(f"README missing '{section}' section")
            
            # Check for examples
            if 'example' not in content.lower():
                self.suggestions.append("README should include usage examples")
    
    def check_versions_file(self):
        """Check for versions.tf or terraform block"""
        versions_file = self.module_path / 'versions.tf'
        
        # Check versions.tf
        if versions_file.exists():
            content = versions_file.read_text()
            if 'required_version' not in content:
                self.warnings.append("versions.tf should specify required_version")
            if 'required_providers' not in content:
                self.warnings.append("versions.tf should specify required_providers with versions")
        else:
            # Check main.tf for terraform block
            main_file = self.module_path / 'main.tf'
            if main_file.exists():
                content = main_file.read_text()
                if 'terraform' not in content or 'required_version' not in content:
                    self.warnings.append("Module should specify Terraform version requirements")
            else:
                self.warnings.append("Consider creating versions.tf to specify version constraints")
    
    def check_examples(self):
        """Check for example usage"""
        examples_dir = self.module_path / 'examples'
        
        if not examples_dir.exists():
            self.suggestions.append("Consider adding 'examples/' directory with usage examples")
        elif examples_dir.is_dir():
            example_subdirs = [d for d in examples_dir.iterdir() if d.is_dir()]
            if len(example_subdirs) == 0:
                self.suggestions.append("examples/ directory is empty - add example configurations")
    
    def check_naming_conventions(self):
        """Check file and resource naming conventions"""
        tf_files = list(self.module_path.glob('*.tf'))
        
        for tf_file in tf_files:
            # Check for snake_case file names
            if not re.match(r'^[a-z0-9_]+\.tf$', tf_file.name):
                self.warnings.append(f"File '{tf_file.name}' should use snake_case naming")
            
            # Check file content for naming
            content = tf_file.read_text()
            
            # Check resource names use snake_case
            resources = re.findall(r'resource\s+"[^"]+"\s+"([^"]+)"', content)
            for resource_name in resources:
                if not re.match(r'^[a-z0-9_]+$', resource_name):
                    self.warnings.append(f"Resource name '{resource_name}' should use snake_case")
            
            # Check for hard-coded values that should be variables
            if re.search(r'= "us-east-1"', content):
                self.suggestions.append("Consider making region configurable via variable")

def main():
    if len(sys.argv) < 2:
        print("Usage: validate_module.py <module-directory>")
        sys.exit(1)
    
    module_path = sys.argv[1]
    
    if not os.path.isdir(module_path):
        print(f"❌ Error: {module_path} is not a directory")
        sys.exit(1)
    
    print("=" * 70)
    print("🏗️  TERRAFORM MODULE VALIDATOR")
    print("=" * 70)
    print()
    
    validator = ModuleValidator(module_path)
    result = validator.validate()
    
    # Print results
    if result['issues']:
        print("❌ ISSUES (Must Fix):")
        for issue in result['issues']:
            print(f"   • {issue}")
        print()
    
    if result['warnings']:
        print("⚠️  WARNINGS (Should Fix):")
        for warning in result['warnings']:
            print(f"   • {warning}")
        print()
    
    if result['suggestions']:
        print("💡 SUGGESTIONS (Consider):")
        for suggestion in result['suggestions']:
            print(f"   • {suggestion}")
        print()
    
    # Summary
    print("=" * 70)
    if result['valid']:
        print("✅ Module validation PASSED!")
        if not result['warnings'] and not result['suggestions']:
            print("   No issues, warnings, or suggestions - excellent work!")
    else:
        print("❌ Module validation FAILED!")
        print(f"   {len(result['issues'])} issues must be fixed before using this module")
    print("=" * 70)
    
    sys.exit(0 if result['valid'] else 1)

if __name__ == "__main__":
    main()
