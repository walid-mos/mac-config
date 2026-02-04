#!/usr/bin/env python3
"""
Validate Flux OCI artifact references and verify signatures.
Supports Flux v2.6+ OCI artifacts with cosign/notation verification.
"""

import argparse
import sys
import subprocess
import json

try:
    from kubernetes import client, config
except ImportError:
    print("⚠️  'kubernetes' not found. Install with: pip install kubernetes")
    sys.exit(1)


def check_oci_repository(name: str, namespace: str = 'flux-system'):
    """Check OCIRepository resource status."""
    try:
        config.load_kube_config()
        api = client.CustomObjectsApi()

        oci_repo = api.get_namespaced_custom_object(
            group='source.toolkit.fluxcd.io',
            version='v1beta2',
            namespace=namespace,
            plural='ocirepositories',
            name=name
        )

        status = oci_repo.get('status', {})
        conditions = status.get('conditions', [])
        ready = next((c for c in conditions if c['type'] == 'Ready'), None)

        print(f"📦 OCIRepository: {name}")
        print(f"   Ready: {ready.get('status') if ready else 'Unknown'}")
        print(f"   Message: {ready.get('message', 'N/A') if ready else 'N/A'}")

        # Check artifact
        artifact = status.get('artifact')
        if artifact:
            print(f"   Artifact: {artifact.get('revision', 'N/A')}")
            print(f"   Digest: {artifact.get('digest', 'N/A')}")
        else:
            print("   ⚠️  No artifact available")

        # Check verification
        spec = oci_repo.get('spec', {})
        if spec.get('verify'):
            print("   ✓ Signature verification enabled")
            provider = spec['verify'].get('provider', 'cosign')
            print(f"   Provider: {provider}")
        else:
            print("   ⚠️  No signature verification")

        return ready.get('status') == 'True' if ready else False

    except Exception as e:
        print(f"❌ Error checking OCIRepository: {e}")
        return False


def verify_oci_artifact(image: str, provider: str = 'cosign'):
    """Verify OCI artifact signature."""
    print(f"\n🔐 Verifying {image} with {provider}...\n")

    if provider == 'cosign':
        try:
            result = subprocess.run(
                ['cosign', 'verify', image],
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                print("✅ Signature verification successful")
                return True
            else:
                print(f"❌ Verification failed: {result.stderr}")
                return False
        except FileNotFoundError:
            print("⚠️  cosign not found. Install: https://github.com/sigstore/cosign")
            return False

    elif provider == 'notation':
        try:
            result = subprocess.run(
                ['notation', 'verify', image],
                capture_output=True,
                text=True
            )
            if result.returncode == 0:
                print("✅ Signature verification successful")
                return True
            else:
                print(f"❌ Verification failed: {result.stderr}")
                return False
        except FileNotFoundError:
            print("⚠️  notation not found. Install: https://notaryproject.dev")
            return False


def main():
    parser = argparse.ArgumentParser(
        description='Validate Flux OCI artifacts and verify signatures',
        epilog="""
Examples:
  # Check OCIRepository status
  python3 oci_artifact_checker.py --name my-app-oci --namespace flux-system

  # Verify OCI artifact signature with cosign
  python3 oci_artifact_checker.py --verify ghcr.io/org/app:v1.0.0

  # Verify with notation
  python3 oci_artifact_checker.py --verify myregistry.io/app:latest --provider notation

Requirements:
  - kubectl configured for cluster access
  - cosign (for signature verification)
  - notation (for notation verification)

Flux v2.6+ OCI Features:
  - OCIRepository for Helm charts and Kustomize overlays
  - Signature verification with cosign or notation
  - Digest pinning for immutability
        """
    )

    parser.add_argument('--name', help='OCIRepository name')
    parser.add_argument('--namespace', default='flux-system', help='Namespace')
    parser.add_argument('--verify', help='OCI image to verify')
    parser.add_argument('--provider', choices=['cosign', 'notation'], default='cosign',
                       help='Verification provider')

    args = parser.parse_args()

    if args.name:
        check_oci_repository(args.name, args.namespace)

    if args.verify:
        verify_oci_artifact(args.verify, args.provider)

    if not args.name and not args.verify:
        print("❌ Specify --name or --verify")
        sys.exit(1)


if __name__ == '__main__':
    main()
