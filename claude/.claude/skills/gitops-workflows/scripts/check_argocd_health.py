#!/usr/bin/env python3
"""
Check ArgoCD application health and diagnose sync issues.
Supports ArgoCD 3.x API with annotation-based tracking.
"""

import argparse
import sys
import json
from typing import Dict, List, Any, Optional
from datetime import datetime

try:
    import requests
except ImportError:
    print("⚠️  Warning: 'requests' library not found. Install with: pip install requests")
    sys.exit(1)

try:
    from tabulate import tabulate
except ImportError:
    tabulate = None


class ArgoCDHealthChecker:
    def __init__(self, server: str, token: Optional[str] = None, username: Optional[str] = None, password: Optional[str] = None):
        self.server = server.rstrip('/')
        self.token = token
        self.session = requests.Session()

        if token:
            self.session.headers['Authorization'] = f'Bearer {token}'
        elif username and password:
            # Login to get token
            self._login(username, password)
        else:
            raise ValueError("Either --token or --username/--password must be provided")

    def _login(self, username: str, password: str):
        """Login to ArgoCD and get auth token."""
        try:
            response = self.session.post(
                f"{self.server}/api/v1/session",
                json={"username": username, "password": password},
                verify=False
            )
            response.raise_for_status()
            self.token = response.json()['token']
            self.session.headers['Authorization'] = f'Bearer {self.token}'
        except Exception as e:
            print(f"❌ Failed to login to ArgoCD: {e}")
            sys.exit(1)

    def get_applications(self, name: Optional[str] = None) -> List[Dict]:
        """Get ArgoCD applications."""
        try:
            if name:
                url = f"{self.server}/api/v1/applications/{name}"
                response = self.session.get(url, verify=False)
                response.raise_for_status()
                return [response.json()]
            else:
                url = f"{self.server}/api/v1/applications"
                response = self.session.get(url, verify=False)
                response.raise_for_status()
                return response.json().get('items', [])
        except Exception as e:
            print(f"❌ Failed to get applications: {e}")
            return []

    def check_application_health(self, app: Dict) -> Dict[str, Any]:
        """Check application health and sync status."""
        name = app['metadata']['name']
        health = app.get('status', {}).get('health', {})
        sync = app.get('status', {}).get('sync', {})
        operation_state = app.get('status', {}).get('operationState', {})

        result = {
            'name': name,
            'health_status': health.get('status', 'Unknown'),
            'health_message': health.get('message', ''),
            'sync_status': sync.get('status', 'Unknown'),
            'sync_revision': sync.get('revision', 'N/A')[:8] if sync.get('revision') else 'N/A',
            'operation_phase': operation_state.get('phase', 'N/A'),
            'issues': [],
            'recommendations': []
        }

        # Check for common issues
        if result['health_status'] not in ['Healthy', 'Unknown']:
            result['issues'].append(f"Application is {result['health_status']}")
            if result['health_message']:
                result['issues'].append(f"Health message: {result['health_message']}")

        if result['sync_status'] == 'OutOfSync':
            result['issues'].append("Application is out of sync with Git")
            result['recommendations'].append("Run: argocd app sync " + name)
            result['recommendations'].append("Check if manual sync is required (sync policy)")

        if result['sync_status'] == 'Unknown':
            result['issues'].append("Sync status is unknown")
            result['recommendations'].append("Check ArgoCD application controller logs")
            result['recommendations'].append(f"kubectl logs -n argocd -l app.kubernetes.io/name=argocd-application-controller")

        # Check for failed operations
        if operation_state.get('phase') == 'Failed':
            result['issues'].append(f"Last operation failed")
            if 'message' in operation_state:
                result['issues'].append(f"Operation message: {operation_state['message']}")
            result['recommendations'].append("Check operation details in ArgoCD UI")
            result['recommendations'].append(f"argocd app get {name}")

        # Check resource conditions (ArgoCD 3.x)
        resources = app.get('status', {}).get('resources', [])
        unhealthy_resources = [r for r in resources if r.get('health', {}).get('status') not in ['Healthy', 'Unknown', '']]
        if unhealthy_resources:
            result['issues'].append(f"{len(unhealthy_resources)} resources are unhealthy")
            for r in unhealthy_resources[:3]:  # Show first 3
                kind = r.get('kind', 'Unknown')
                name = r.get('name', 'Unknown')
                status = r.get('health', {}).get('status', 'Unknown')
                result['issues'].append(f"  - {kind}/{name}: {status}")
            result['recommendations'].append(f"kubectl get {unhealthy_resources[0]['kind']} -n {app['spec']['destination']['namespace']}")

        # Check for annotation-based tracking (ArgoCD 3.x default)
        tracking_method = app.get('spec', {}).get('syncPolicy', {}).get('syncOptions', [])
        has_label_tracking = 'UseLabel=true' in tracking_method
        if has_label_tracking:
            result['recommendations'].append("⚠️  Using legacy label-based tracking. Consider migrating to annotation-based tracking (ArgoCD 3.x default)")

        return result

    def check_all_applications(self, name: Optional[str] = None, show_healthy: bool = False) -> List[Dict]:
        """Check all applications or specific application."""
        apps = self.get_applications(name)
        results = []

        for app in apps:
            result = self.check_application_health(app)
            if show_healthy or result['issues']:
                results.append(result)

        return results

    def print_summary(self, results: List[Dict]):
        """Print summary of application health."""
        if not results:
            print("✅ No applications found or all healthy (use --show-healthy to see healthy apps)")
            return

        # Summary statistics
        total = len(results)
        with_issues = len([r for r in results if r['issues']])

        print(f"\n📊 Summary: {with_issues}/{total} applications have issues\n")

        # Table output
        if tabulate:
            table_data = []
            for r in results:
                status_icon = "❌" if r['issues'] else "✅"
                table_data.append([
                    status_icon,
                    r['name'],
                    r['health_status'],
                    r['sync_status'],
                    r['sync_revision'],
                    len(r['issues'])
                ])

            print(tabulate(
                table_data,
                headers=['', 'Application', 'Health', 'Sync', 'Revision', 'Issues'],
                tablefmt='simple'
            ))
        else:
            for r in results:
                status_icon = "❌" if r['issues'] else "✅"
                print(f"{status_icon} {r['name']}: Health={r['health_status']}, Sync={r['sync_status']}, Issues={len(r['issues'])}")

        # Detailed issues and recommendations
        print("\n🔍 Detailed Issues:\n")
        for r in results:
            if not r['issues']:
                continue

            print(f"Application: {r['name']}")
            print(f"  Health: {r['health_status']}")
            print(f"  Sync: {r['sync_status']}")

            if r['issues']:
                print("  Issues:")
                for issue in r['issues']:
                    print(f"    • {issue}")

            if r['recommendations']:
                print("  Recommendations:")
                for rec in r['recommendations']:
                    print(f"    → {rec}")
            print()


def main():
    parser = argparse.ArgumentParser(
        description='Check ArgoCD application health and diagnose sync issues (ArgoCD 3.x compatible)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Check all applications
  python3 check_argocd_health.py \\
    --server https://argocd.example.com \\
    --token $ARGOCD_TOKEN

  # Check specific application
  python3 check_argocd_health.py \\
    --server https://argocd.example.com \\
    --username admin \\
    --password $ARGOCD_PASSWORD \\
    --app my-app

  # Show all applications including healthy ones
  python3 check_argocd_health.py \\
    --server https://argocd.example.com \\
    --token $ARGOCD_TOKEN \\
    --show-healthy

ArgoCD 3.x Features:
  - Annotation-based tracking (default)
  - Fine-grained RBAC support
  - Enhanced resource health checks
        """
    )

    parser.add_argument('--server', required=True, help='ArgoCD server URL')
    parser.add_argument('--token', help='ArgoCD auth token (or set ARGOCD_TOKEN env var)')
    parser.add_argument('--username', help='ArgoCD username')
    parser.add_argument('--password', help='ArgoCD password')
    parser.add_argument('--app', help='Specific application name to check')
    parser.add_argument('--show-healthy', action='store_true', help='Show healthy applications')
    parser.add_argument('--json', action='store_true', help='Output as JSON')

    args = parser.parse_args()

    # Get token from env if not provided
    import os
    token = args.token or os.getenv('ARGOCD_TOKEN')

    try:
        checker = ArgoCDHealthChecker(
            server=args.server,
            token=token,
            username=args.username,
            password=args.password
        )

        results = checker.check_all_applications(
            name=args.app,
            show_healthy=args.show_healthy
        )

        if args.json:
            print(json.dumps(results, indent=2))
        else:
            checker.print_summary(results)

    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        sys.exit(1)


if __name__ == '__main__':
    main()
