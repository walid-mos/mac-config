#!/usr/bin/env bash
# Coverage gate: exit 1 if any file in the resolved scope is absent from the
# manifest or has no verdict (done|skip). Exit 0 = coverage complete.
# Usage: scripts/coverage.sh <scope...> [manifest-path]   (same resolution as inventory.sh)
set -euo pipefail
. "$(dirname "$0")/scope.sh"

if [ $# -ge 2 ] && [ ! -e "${@: -1}" ] && [[ "${@: -1}" != *..* ]]; then
    manifest="${@: -1}"
    set -- "${@:1,$#-1}"
else
    manifest=".review-manifest.csv"
fi

if [ ! -f "$manifest" ]; then
    echo "coverage: FAIL — manifest '$manifest' does not exist (run inventory.sh first)"
    exit 1
fi

missing=0
while IFS= read -r f; do
    [ -n "$f" ] || continue
    # The manifest itself is never part of the scope (mirrors inventory.sh).
    [ "$f" = "$manifest" ] && continue
    # Last occurrence wins (robust to duplicate rows in the manifest).
    status="$(awk -F, -v f="$f" '$1 == f { v = $2 } END { print v }' "$manifest")"
    case "$status" in
        done|skip) ;;
        *) echo "coverage: NO VERDICT — $f (got: '${status:-absent}')"; missing=$((missing + 1)) ;;
    esac
done < <(resolve_scope "$@")

if [ "$missing" -eq 0 ]; then
    echo "coverage: OK — every scoped file has a verdict"
else
    echo "coverage: FAIL — $missing file(s) without verdict"
    exit 1
fi
