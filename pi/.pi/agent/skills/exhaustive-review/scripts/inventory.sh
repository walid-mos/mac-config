#!/usr/bin/env bash
# Build the review manifest: one row per file in the resolved scope.
# Scope: any mix of git ranges (A..B) and paths. See scope.sh.
# Usage: scripts/inventory.sh <scope...> [manifest-path]
set -euo pipefail
. "$(dirname "$0")/scope.sh"

if [ $# -ge 2 ] && [ ! -e "${@: -1}" ] && [[ "${@: -1}" != *..* ]]; then
    # Last arg is neither an existing path nor a range -> treat as manifest path.
    out="${@: -1}"
    set -- "${@:1,$#-1}"
else
    out=".review-manifest.csv"
fi

# Exclude the manifest itself from its own scope.
resolve_scope "$@" | grep -vxF "$out" > "$out"
echo "manifest: $out ($(wc -l < "$out" | tr -d ' ') files)"
