#!/usr/bin/env python3
"""
Check Flux CD health and diagnose reconciliation issues.
Supports Flux v2.7+ with OCI artifacts, image automation, and source-watcher.
"""

import argparse
import sys
import json
from typing import Dict, List, Any, Optional
from datetime import datetime, timedelta

try:
    from kubernetes import client, config
    from kubernetes.client.rest import ApiException
except ImportError:
    print("⚠️  Warning: 'kubernetes' library not found. Install with: pip install kubernetes")
    sys.exit(1)

try:
    from tabulate import tabulate
except ImportError:
    tabulate = None


class FluxHealthChecker:
    def __init__(self, namespace: str = "flux-system", kubeconfig: Optional[str] = None):
        self.namespace = namespace

        # Load kubeconfig
        try:
            if kubeconfig:
                config.load_kube_config(config_file=kubeconfig)
            else:
                try:
                    config.load_kube_config()
                except:
                    config.load_incluster_config()
        except Exception as e:
            print(f"❌ Failed to load kubeconfig: {e}")
            sys.exit(1)

        self.api = client.ApiClient()
        self.custom_api = client.CustomObjectsApi(self.api)
        self.core_api = client.CoreV1Api(self.api)

    def get_flux_resources(self, resource_type: str, namespace: Optional[str] = None) -> List[Dict]:
        """Get Flux custom resources."""
        ns = namespace or self.namespace

        resource_map = {
            'gitrepositories': ('source.toolkit.fluxcd.io', 'v1', 'gitrepositories'),
            'ocirepositories': ('source.toolkit.fluxcd.io', 'v1beta2', 'ocirepositories'),
            'helmrepositories': ('source.toolkit.fluxcd.io', 'v1', 'helmrepositories'),
            'buckets': ('source.toolkit.fluxcd.io', 'v1beta2', 'buckets'),
            'kustomizations': ('kustomize.toolkit.fluxcd.io', 'v1', 'kustomizations'),
            'helmreleases': ('helm.toolkit.fluxcd.io', 'v2', 'helmreleases'),
            'imageupdateautomations': ('image.toolkit.fluxcd.io', 'v1beta2', 'imageupdateautomations'),
            'imagerepositories': ('image.toolkit.fluxcd.io', 'v1beta2', 'imagerepositories'),
        }

        if resource_type not in resource_map:
            return []

        group, version, plural = resource_map[resource_type]

        try:
            response = self.custom_api.list_namespaced_custom_object(
                group=group,
                version=version,
                namespace=ns,
                plural=plural
            )
            return response.get('items', [])
        except ApiException as e:
            if e.status == 404:
                return []
            print(f"⚠️  Warning: Failed to get {resource_type}: {e}")
            return []

    def check_resource_health(self, resource: Dict, resource_type: str) -> Dict[str, Any]:
        """Check resource health and reconciliation status."""
        name = resource['metadata']['name']
        namespace = resource['metadata']['namespace']
        status = resource.get('status', {})

        # Get conditions
        conditions = status.get('conditions', [])
        ready_condition = next((c for c in conditions if c['type'] == 'Ready'), None)

        result = {
            'type': resource_type,
            'name': name,
            'namespace': namespace,
            'ready': ready_condition.get('status', 'Unknown') if ready_condition else 'Unknown',
            'message': ready_condition.get('message', '') if ready_condition else '',
            'last_reconcile': status.get('lastHandledReconcileAt', 'N/A'),
            'issues': [],
            'recommendations': []
        }

        # Check if ready
        if result['ready'] != 'True':
            result['issues'].append(f"{resource_type} is not ready")
            if result['message']:
                result['issues'].append(f"Message: {result['message']}")

        # Type-specific checks
        if resource_type == 'gitrepositories':
            self._check_git_repository(resource, result)
        elif resource_type == 'ocirepositories':
            self._check_oci_repository(resource, result)
        elif resource_type == 'kustomizations':
            self._check_kustomization(resource, result)
        elif resource_type == 'helmreleases':
            self._check_helm_release(resource, result)
        elif resource_type == 'imageupdateautomations':
            self._check_image_automation(resource, result)

        return result

    def _check_git_repository(self, resource: Dict, result: Dict):
        """Check GitRepository-specific issues."""
        status = resource.get('status', {})

        # Check artifact
        if not status.get('artifact'):
            result['issues'].append("No artifact available")
            result['recommendations'].append("Check repository URL and credentials")
            result['recommendations'].append(f"flux reconcile source git {result['name']} -n {result['namespace']}")

        # Check for auth errors
        if 'authentication' in result['message'].lower() or 'credentials' in result['message'].lower():
            result['recommendations'].append("Check Git credentials secret")
            result['recommendations'].append(f"kubectl get secret -n {result['namespace']}")

    def _check_oci_repository(self, resource: Dict, result: Dict):
        """Check OCIRepository-specific issues (Flux v2.6+ feature)."""
        status = resource.get('status', {})

        # Check artifact
        if not status.get('artifact'):
            result['issues'].append("No OCI artifact available")
            result['recommendations'].append("Check OCI repository URL and credentials")
            result['recommendations'].append("Verify OCI artifact exists in registry")

        # Check signature verification (Flux v2.7+)
        spec = resource.get('spec', {})
        if spec.get('verify'):
            verify_status = status.get('observedGeneration')
            if not verify_status:
                result['issues'].append("Signature verification configured but not completed")
                result['recommendations'].append("Check cosign or notation configuration")

    def _check_kustomization(self, resource: Dict, result: Dict):
        """Check Kustomization-specific issues."""
        status = resource.get('status', {})

        # Check source reference
        spec = resource.get('spec', {})
        source_ref = spec.get('sourceRef', {})
        if not source_ref:
            result['issues'].append("No source reference configured")

        # Check inventory
        inventory = status.get('inventory')
        if inventory and 'entries' in inventory:
            total_resources = len(inventory['entries'])
            result['recommendations'].append(f"Managing {total_resources} resources")

        # Check for prune errors
        if 'prune' in result['message'].lower():
            result['recommendations'].append("Check for resources blocking pruning")
            result['recommendations'].append("Review finalizers on deleted resources")

    def _check_helm_release(self, resource: Dict, result: Dict):
        """Check HelmRelease-specific issues."""
        status = resource.get('status', {})

        # Check install/upgrade status
        install_failures = status.get('installFailures', 0)
        upgrade_failures = status.get('upgradeFailures', 0)

        if install_failures > 0:
            result['issues'].append(f"Install failed {install_failures} times")
            result['recommendations'].append("Check Helm values and chart compatibility")

        if upgrade_failures > 0:
            result['issues'].append(f"Upgrade failed {upgrade_failures} times")
            result['recommendations'].append("Review Helm upgrade logs")
            result['recommendations'].append(f"kubectl logs -n {result['namespace']} -l app=helm-controller")

        # Check for timeout issues
        if 'timeout' in result['message'].lower():
            result['recommendations'].append("Increase timeout in HelmRelease spec")
            result['recommendations'].append("Check pod startup times and readiness probes")

    def _check_image_automation(self, resource: Dict, result: Dict):
        """Check ImageUpdateAutomation-specific issues (Flux v2.7+ GA)."""
        status = resource.get('status', {})

        # Check last automation time
        last_automation = status.get('lastAutomationRunTime')
        if not last_automation:
            result['issues'].append("No automation runs recorded")
            result['recommendations'].append("Check ImagePolicy and git write access")

    def check_flux_controllers(self) -> List[Dict]:
        """Check health of Flux controller pods."""
        results = []

        controller_labels = [
            'source-controller',
            'kustomize-controller',
            'helm-controller',
            'notification-controller',
            'image-reflector-controller',
            'image-automation-controller',
        ]

        for controller in controller_labels:
            try:
                pods = self.core_api.list_namespaced_pod(
                    namespace=self.namespace,
                    label_selector=f'app={controller}'
                )

                if not pods.items:
                    results.append({
                        'controller': controller,
                        'status': 'Not Found',
                        'issues': [f'{controller} not found'],
                        'recommendations': ['Check Flux installation']
                    })
                    continue

                pod = pods.items[0]
                pod_status = pod.status.phase

                result = {
                    'controller': controller,
                    'status': pod_status,
                    'issues': [],
                    'recommendations': []
                }

                if pod_status != 'Running':
                    result['issues'].append(f'Controller not running (status: {pod_status})')
                    result['recommendations'].append(f'kubectl describe pod -n {self.namespace} -l app={controller}')
                    result['recommendations'].append(f'kubectl logs -n {self.namespace} -l app={controller}')

                # Check container restarts
                for container_status in pod.status.container_statuses or []:
                    if container_status.restart_count > 5:
                        result['issues'].append(f'High restart count: {container_status.restart_count}')
                        result['recommendations'].append('Check controller logs for crash loops')

                results.append(result)

            except ApiException as e:
                results.append({
                    'controller': controller,
                    'status': 'Error',
                    'issues': [f'Failed to check: {e}'],
                    'recommendations': []
                })

        return results

    def print_summary(self, resource_results: List[Dict], controller_results: List[Dict]):
        """Print summary of Flux health."""
        # Controller health
        print("\n🎛️  Flux Controllers:\n")

        if tabulate:
            controller_table = []
            for r in controller_results:
                status_icon = "✅" if r['status'] == 'Running' and not r['issues'] else "❌"
                controller_table.append([
                    status_icon,
                    r['controller'],
                    r['status'],
                    len(r['issues'])
                ])
            print(tabulate(
                controller_table,
                headers=['', 'Controller', 'Status', 'Issues'],
                tablefmt='simple'
            ))
        else:
            for r in controller_results:
                status_icon = "✅" if r['status'] == 'Running' and not r['issues'] else "❌"
                print(f"{status_icon} {r['controller']}: {r['status']} ({len(r['issues'])} issues)")

        # Resource health
        if resource_results:
            print("\n📦 Flux Resources:\n")

            if tabulate:
                resource_table = []
                for r in resource_results:
                    status_icon = "✅" if r['ready'] == 'True' and not r['issues'] else "❌"
                    resource_table.append([
                        status_icon,
                        r['type'],
                        r['name'],
                        r['namespace'],
                        r['ready'],
                        len(r['issues'])
                    ])
                print(tabulate(
                    resource_table,
                    headers=['', 'Type', 'Name', 'Namespace', 'Ready', 'Issues'],
                    tablefmt='simple'
                ))
            else:
                for r in resource_results:
                    status_icon = "✅" if r['ready'] == 'True' and not r['issues'] else "❌"
                    print(f"{status_icon} {r['type']}/{r['name']}: {r['ready']} ({len(r['issues'])} issues)")

        # Detailed issues
        all_results = controller_results + resource_results
        issues_found = [r for r in all_results if r.get('issues')]

        if issues_found:
            print("\n🔍 Detailed Issues:\n")
            for r in issues_found:
                print(f"{r.get('controller') or r.get('type')}/{r.get('name', 'N/A')}:")
                for issue in r['issues']:
                    print(f"  • {issue}")
                if r.get('recommendations'):
                    print("  Recommendations:")
                    for rec in r['recommendations']:
                        print(f"    → {rec}")
                print()
        else:
            print("\n✅ No issues found!")


def main():
    parser = argparse.ArgumentParser(
        description='Check Flux CD health and diagnose reconciliation issues (Flux v2.7+ compatible)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Check Flux controllers and all resources
  python3 check_flux_health.py

  # Check specific namespace
  python3 check_flux_health.py --namespace my-app

  # Check only GitRepositories
  python3 check_flux_health.py --type gitrepositories

  # Check OCI repositories (Flux v2.6+)
  python3 check_flux_health.py --type ocirepositories

  # Output as JSON
  python3 check_flux_health.py --json

Flux v2.7+ Features:
  - OCI artifact support (GA in v2.6)
  - Image automation (GA in v2.7)
  - Source-watcher component
  - OpenTelemetry tracing
        """
    )

    parser.add_argument('--namespace', default='flux-system', help='Flux namespace (default: flux-system)')
    parser.add_argument('--type', help='Check specific resource type only')
    parser.add_argument('--kubeconfig', help='Path to kubeconfig file')
    parser.add_argument('--json', action='store_true', help='Output as JSON')

    args = parser.parse_args()

    try:
        checker = FluxHealthChecker(namespace=args.namespace, kubeconfig=args.kubeconfig)

        # Check controllers
        controller_results = checker.check_flux_controllers()

        # Check resources
        resource_results = []
        resource_types = [args.type] if args.type else [
            'gitrepositories',
            'ocirepositories',
            'helmrepositories',
            'kustomizations',
            'helmreleases',
            'imageupdateautomations',
        ]

        for resource_type in resource_types:
            resources = checker.get_flux_resources(resource_type)
            for resource in resources:
                result = checker.check_resource_health(resource, resource_type)
                resource_results.append(result)

        if args.json:
            print(json.dumps({
                'controllers': controller_results,
                'resources': resource_results
            }, indent=2))
        else:
            checker.print_summary(resource_results, controller_results)

    except KeyboardInterrupt:
        print("\n\nInterrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()
