#!/usr/bin/env bash
# Size gate: exit 1 if any production file in the resolved scope exceeds the
# line budget. Tests, docs and data files are exempt.
# Usage: scripts/size-gate.sh [--budget N] <scope...>   (same resolution as inventory.sh)
set -euo pipefail
. "$(dirname "$0")/scope.sh"

budget=250
if [ "${1:-}" = "--budget" ]; then
    budget="${2:?usage: size-gate.sh [--budget N] <scope...>}"
    shift 2
fi

fail=0
while IFS= read -r f; do
    [ -n "$f" ] || continue
    case "$f" in
        *test*|*spec*|*.md|*.csv|*JOURNAL*|*.json|*.patch) continue ;;
    esac
    [ -f "$f" ] || continue
    lines="$(wc -l < "$f" | tr -d ' ')"
    if [ "$lines" -gt "$budget" ]; then
        echo "size-gate: OVER BUDGET — $f ($lines > $budget)"
        fail=1
    fi
done < <(resolve_scope "$@")

if [ "$fail" -eq 0 ]; then
    echo "size-gate: OK (budget ${budget} lines)"
else
    exit 1
fi
