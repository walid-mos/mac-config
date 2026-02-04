#!/usr/bin/env python3
"""
Terraform State Inspector & Drift Detector
Analyzes Terraform state and detects configuration drift
"""
import json
import subprocess
import sys
from typing import Dict, List, Any
from datetime import datetime

def run_command(cmd: List[str], cwd: str = ".") -> Dict[str, Any]:
    """Run a command and return the result"""
    try:
        result = subprocess.run(
            cmd,
            cwd=cwd,
            capture_output=True,
            text=True,
            check=True
        )
        return {"success": True, "stdout": result.stdout, "stderr": result.stderr}
    except subprocess.CalledProcessError as e:
        return {"success": False, "stdout": e.stdout, "stderr": e.stderr, "returncode": e.returncode}

def check_state_health(working_dir: str) -> Dict[str, Any]:
    """Check the health of the Terraform state"""
    print("🔍 Checking Terraform state health...\n")
    
    # Check if state exists
    result = run_command(["terraform", "state", "list"], working_dir)
    if not result["success"]:
        return {
            "healthy": False,
            "error": "Unable to read state. Is Terraform initialized?",
            "details": result["stderr"]
        }
    
    resources = result["stdout"].strip().split("\n") if result["stdout"].strip() else []
    
    return {
        "healthy": True,
        "resource_count": len(resources),
        "resources": resources
    }

def detect_drift(working_dir: str) -> Dict[str, Any]:
    """Run terraform plan to detect drift"""
    print("🔄 Detecting configuration drift...\n")
    
    result = run_command(["terraform", "plan", "-detailed-exitcode", "-no-color"], working_dir)
    
    # Exit codes: 0 = no changes, 1 = error, 2 = changes detected
    if result["returncode"] == 0:
        return {
            "drift_detected": False,
            "message": "No drift detected - infrastructure matches configuration"
        }
    elif result["returncode"] == 2:
        return {
            "drift_detected": True,
            "message": "Drift detected - infrastructure differs from configuration",
            "plan_output": result["stdout"]
        }
    else:
        return {
            "error": True,
            "message": "Error running terraform plan",
            "details": result["stderr"]
        }

def analyze_state_resources(working_dir: str) -> Dict[str, Any]:
    """Analyze resources in the state file"""
    print("📊 Analyzing state resources...\n")
    
    result = run_command(["terraform", "show", "-json"], working_dir)
    if not result["success"]:
        return {"error": "Unable to read state JSON", "details": result["stderr"]}
    
    try:
        state_data = json.loads(result["stdout"])
    except json.JSONDecodeError:
        return {"error": "Unable to parse state JSON"}
    
    resources = state_data.get("values", {}).get("root_module", {}).get("resources", [])
    
    # Categorize resources by type
    resource_types = {}
    for resource in resources:
        res_type = resource.get("type", "unknown")
        resource_types[res_type] = resource_types.get(res_type, 0) + 1
    
    # Identify potentially problematic resources
    issues = []
    for resource in resources:
        # Check for resources with tainted status
        if resource.get("tainted", False):
            issues.append(f"⚠️  Resource {resource['address']} is tainted")
    
    return {
        "total_resources": len(resources),
        "resource_types": resource_types,
        "issues": issues
    }

def check_provider_versions(working_dir: str) -> Dict[str, Any]:
    """Check provider versions and constraints"""
    print("📦 Checking provider versions...\n")
    
    result = run_command(["terraform", "version", "-json"], working_dir)
    if not result["success"]:
        return {"error": "Unable to get version info"}
    
    try:
        version_data = json.loads(result["stdout"])
        return {
            "terraform_version": version_data.get("terraform_version"),
            "provider_versions": version_data.get("provider_selections", {})
        }
    except json.JSONDecodeError:
        return {"error": "Unable to parse version JSON"}

def check_backend_config(working_dir: str) -> Dict[str, Any]:
    """Check backend configuration"""
    print("🗄️  Checking backend configuration...\n")
    
    result = run_command(["terraform", "show", "-json"], working_dir)
    if not result["success"]:
        return {"error": "Unable to read backend config"}
    
    try:
        state_data = json.loads(result["stdout"])
        backend = state_data.get("values", {}).get("backend", {})
        
        return {
            "backend_type": backend.get("type", "local"),
            "config": backend.get("config", {})
        }
    except json.JSONDecodeError:
        return {"error": "Unable to parse backend config"}

def main():
    if len(sys.argv) < 2:
        print("Usage: inspect_state.py <terraform-directory> [--check-drift]")
        sys.exit(1)
    
    working_dir = sys.argv[1]
    check_drift_flag = "--check-drift" in sys.argv
    
    print("=" * 70)
    print("🏗️  TERRAFORM STATE INSPECTOR")
    print("=" * 70)
    print(f"Working Directory: {working_dir}")
    print(f"Timestamp: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
    
    # Check state health
    state_health = check_state_health(working_dir)
    if not state_health.get("healthy"):
        print(f"❌ State Health: UNHEALTHY")
        print(f"   Error: {state_health.get('error')}")
        print(f"   Details: {state_health.get('details')}")
        sys.exit(1)
    
    print(f"✅ State Health: HEALTHY")
    print(f"   Total Resources: {state_health['resource_count']}\n")
    
    # Check provider versions
    versions = check_provider_versions(working_dir)
    if "error" not in versions:
        print(f"📦 Terraform Version: {versions['terraform_version']}")
        print(f"   Providers:")
        for provider, version in versions.get('provider_versions', {}).items():
            print(f"      • {provider}: {version}")
        print()
    
    # Check backend
    backend = check_backend_config(working_dir)
    if "error" not in backend:
        print(f"🗄️  Backend Type: {backend['backend_type']}")
        if backend['backend_type'] != 'local':
            print(f"   Configuration: {backend.get('config', {})}")
        print()
    
    # Analyze resources
    analysis = analyze_state_resources(working_dir)
    if "error" not in analysis:
        print(f"📊 Resource Analysis:")
        print(f"   Total Resources: {analysis['total_resources']}")
        print(f"   Resource Types:")
        for res_type, count in sorted(analysis['resource_types'].items()):
            print(f"      • {res_type}: {count}")
        
        if analysis['issues']:
            print(f"\n   ⚠️  Issues Found:")
            for issue in analysis['issues']:
                print(f"      {issue}")
        else:
            print(f"\n   ✅ No issues detected")
        print()
    
    # Check for drift if requested
    if check_drift_flag:
        drift = detect_drift(working_dir)
        if drift.get("error"):
            print(f"❌ Drift Detection Failed:")
            print(f"   {drift['message']}")
            print(f"   {drift.get('details', '')}")
        elif drift.get("drift_detected"):
            print(f"⚠️  DRIFT DETECTED")
            print(f"   {drift['message']}")
            print(f"\n   Run 'terraform plan' for detailed differences")
        else:
            print(f"✅ No Drift Detected")
            print(f"   {drift['message']}")
        print()
    
    print("=" * 70)
    print("✅ State inspection complete!")
    
    # Recommendations
    print("\n💡 Recommendations:")
    if state_health['resource_count'] == 0:
        print("   • No resources in state - consider running 'terraform apply'")
    if backend.get('backend_type') == 'local':
        print("   • Using local backend - consider remote backend for team collaboration")
    if not check_drift_flag:
        print("   • Run with --check-drift flag to detect configuration drift")
    
    print("\n" + "=" * 70)

if __name__ == "__main__":
    main()
