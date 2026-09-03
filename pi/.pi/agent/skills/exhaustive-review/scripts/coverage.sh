#!/usr/bin/env bash
# Final coverage gate for one temporary objective manifest. The review state is consumed.
# Usage: coverage.sh --review-id ID <scope-selectors...> (see scope.sh)
set -euo pipefail
. "$(dirname "$0")/scope.sh"

review_id=""
while [ "$#" -gt 0 ]; do
    case "$1" in
        --review-id)
            [ "$#" -ge 2 ] || { echo "coverage: --review-id requires a value" >&2; exit 2; }
            review_id="$2"
            shift 2
            ;;
        *)
            break
            ;;
    esac
done

[[ "$review_id" =~ ^pi-exhaustive-review\.[A-Za-z0-9]+$ ]] || {
    echo "coverage: invalid or missing --review-id" >&2
    exit 2
}
parse_scope_arguments "$@"

review_dir="${TMPDIR:-/tmp}/$review_id"
[ -d "$review_dir" ] || {
    echo "coverage: review '$review_id' does not exist" >&2
    exit 1
}
trap 'rm -rf -- "$review_dir"' EXIT

manifest="$review_dir/manifest.jsonl"
metadata="$review_dir/review.json"
[ -f "$manifest" ] && [ -f "$metadata" ] || {
    echo "coverage: review state is incomplete" >&2
    exit 1
}

current_scope="$review_dir/current-scope.json"
materialize_scope "$current_scope" "${SCOPE_ARGS[@]}"
current_root="$(git rev-parse --show-toplevel)"

python3 - "$manifest" "$metadata" "$current_scope" "$current_root" <<'PY'
import json
import os
import sys
from pathlib import Path

manifest_path, metadata_path, current_scope_path, current_root = sys.argv[1:]


def fail(message: str) -> None:
    raise SystemExit(f"coverage: FAIL — {message}")


try:
    metadata = json.loads(Path(metadata_path).read_text())
    current_paths = json.loads(Path(current_scope_path).read_text())
except (OSError, json.JSONDecodeError) as error:
    fail(f"invalid review metadata: {error}")

if set(metadata) != {"objective", "reportOnly", "root", "paths"}:
    fail("review metadata has an invalid schema")
if not isinstance(metadata["objective"], str) or not metadata["objective"].strip():
    fail("objective must be a non-empty string")
if not isinstance(metadata["reportOnly"], bool):
    fail("reportOnly must be boolean")
if os.path.realpath(metadata["root"]) != os.path.realpath(current_root):
    fail("review belongs to another repository")
if not isinstance(metadata["paths"], list) or not all(
    isinstance(path, str) and path for path in metadata["paths"]
):
    fail("recorded scope is invalid")
if len(metadata["paths"]) != len(set(metadata["paths"])):
    fail("recorded scope contains duplicate paths")
if not isinstance(current_paths, list) or not all(isinstance(path, str) for path in current_paths):
    fail("current scope is invalid")

recorded = set(metadata["paths"])
current = set(current_paths)
if recorded != current:
    added = sorted(current - recorded)
    removed = sorted(recorded - current)
    fail(f"scope changed; added={added!r}; removed={removed!r}")

records = []
try:
    for line_number, line in enumerate(Path(manifest_path).read_text().splitlines(), 1):
        if not line.strip():
            fail(f"blank manifest line {line_number}")
        record = json.loads(line)
        if set(record) != {"objective", "path", "verdict", "note"}:
            fail(f"manifest line {line_number} has an invalid schema")
        if record["objective"] != metadata["objective"]:
            fail(f"manifest line {line_number} has the wrong objective")
        if not isinstance(record["path"], str) or not record["path"]:
            fail(f"manifest line {line_number} has an invalid path")
        if record["verdict"] not in {"pending", "done", "skip"}:
            fail(f"manifest line {line_number} has an invalid verdict")
        if not isinstance(record["note"], str):
            fail(f"manifest line {line_number} has a non-string note")
        if record["verdict"] == "skip" and not record["note"].strip():
            fail(f"manifest line {line_number} skips without a reason")
        records.append(record)
except json.JSONDecodeError as error:
    fail(f"invalid JSONL: {error}")

paths = [record["path"] for record in records]
if len(paths) != len(set(paths)):
    fail("manifest contains duplicate paths")
if set(paths) != recorded:
    fail("manifest paths differ from the inventory snapshot")

pending = sorted(record["path"] for record in records if record["verdict"] == "pending")
if pending:
    fail(f"files without a verdict: {pending!r}")

print(
    f"coverage: OK — {len(records)} files complete for objective "
    f"{metadata['objective']!r}; temporary review deleted"
)
PY
