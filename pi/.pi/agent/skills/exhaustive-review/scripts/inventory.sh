#!/usr/bin/env bash
# Create one temporary JSONL manifest for one review objective.
# Usage: inventory.sh --objective NAME [--report-only] <scope-selectors...> (see scope.sh)
set -euo pipefail
. "$(dirname "$0")/scope.sh"

objective=""
report_only=false
while [ "$#" -gt 0 ]; do
    case "$1" in
        --objective)
            [ "$#" -ge 2 ] || { echo "inventory: --objective requires a value" >&2; exit 2; }
            objective="$2"
            shift 2
            ;;
        --report-only)
            report_only=true
            shift
            ;;
        *)
            break
            ;;
    esac
done

[ -n "${objective//[[:space:]]/}" ] || {
    echo "inventory: --objective must be non-empty" >&2
    exit 2
}
parse_scope_arguments "$@"

review_dir="$(mktemp -d "${TMPDIR:-/tmp}/pi-exhaustive-review.XXXXXX")"
cleanup=true
trap 'if [ "$cleanup" = true ]; then rm -rf -- "$review_dir"; fi' EXIT

scope_file="$review_dir/scope.json"
materialize_scope "$scope_file" "${SCOPE_ARGS[@]}"
root="$(git rev-parse --show-toplevel)"
manifest="$review_dir/manifest.jsonl"
metadata="$review_dir/review.json"

python3 - "$objective" "$report_only" "$root" "$scope_file" "$manifest" "$metadata" <<'PY'
import json
import sys
from pathlib import Path

objective, report_only, root, scope_path, manifest_path, metadata_path = sys.argv[1:]
paths = json.loads(Path(scope_path).read_text())
with Path(manifest_path).open("w") as manifest:
    for path in paths:
        record = {
            "objective": objective,
            "path": path,
            "verdict": "pending",
            "note": "",
        }
        manifest.write(json.dumps(record, ensure_ascii=True, separators=(",", ":")) + "\n")
Path(metadata_path).write_text(
    json.dumps(
        {
            "objective": objective,
            "reportOnly": report_only == "true",
            "root": root,
            "paths": paths,
        },
        ensure_ascii=True,
        separators=(",", ":"),
    )
    + "\n"
)
PY

cleanup=false
review_id="${review_dir##*/}"
printf 'review-id: %s\n' "$review_id"
printf 'manifest: %s (%s files; objective: %s)\n' \
    "$manifest" "$(python3 -c 'import json,sys; print(len(json.load(open(sys.argv[1]))))' "$scope_file")" "$objective"
