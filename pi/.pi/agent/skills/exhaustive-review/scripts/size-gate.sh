#!/usr/bin/env bash
# Hard production-file size gate. Default and maximum budget: 250 lines.
# Usage: size-gate.sh [--budget N] <scope-selectors...> (see scope.sh)
set -euo pipefail
. "$(dirname "$0")/scope.sh"

budget=250
while [ "$#" -gt 0 ]; do
    case "$1" in
        --budget)
            [ "$#" -ge 2 ] || { echo "size-gate: --budget requires a value" >&2; exit 2; }
            budget="$2"
            shift 2
            ;;
        *)
            break
            ;;
    esac
done

[[ "$budget" =~ ^[1-9][0-9]*$ ]] && [ "$budget" -le 250 ] || {
    echo "size-gate: budget must be an integer from 1 to 250" >&2
    exit 2
}
parse_scope_arguments "$@"

scope_file="$(mktemp "${TMPDIR:-/tmp}/pi-size-scope.XXXXXX")"
trap 'rm -f -- "$scope_file"' EXIT
materialize_scope "$scope_file" "${SCOPE_ARGS[@]}"
root="$(git rev-parse --show-toplevel)"

python3 - "$root" "$scope_file" "$budget" <<'PY'
import json
import os
import re
import sys
from pathlib import Path, PurePosixPath

root, scope_path, raw_budget = sys.argv[1:]
budget = int(raw_budget)
paths = json.loads(Path(scope_path).read_text())
source_suffixes = {
    ".bash", ".c", ".cc", ".cjs", ".cpp", ".cs", ".go", ".h", ".hpp",
    ".java", ".js", ".jsx", ".kt", ".kts", ".lua", ".mjs", ".php", ".py",
    ".rb", ".rs", ".scala", ".sh", ".swift", ".ts", ".tsx", ".zsh",
}
test_directories = {"test", "tests", "__tests__", "spec", "specs", "fixtures"}
test_name = re.compile(r"(^test_|_(?:test|spec)$|\.(?:test|spec)$)")
failed = False
checked = 0

for relative in paths:
    file = Path(root, relative)
    if not file.exists():
        print(f"size-gate: SKIP deleted or absent — {relative}")
        continue
    if not file.is_file():
        continue

    pure = PurePosixPath(relative)
    suffix = file.suffix.lower()
    logical_name = pure.name.lower()
    if suffix:
        logical_name = logical_name[: -len(suffix)]
    is_test = bool(test_directories.intersection(part.lower() for part in pure.parts[:-1]))
    is_test = is_test or bool(test_name.search(logical_name))
    if is_test:
        continue

    is_source = suffix in source_suffixes
    if not suffix:
        try:
            is_source = file.read_bytes().startswith(b"#!")
        except OSError as error:
            raise SystemExit(f"size-gate: cannot read {relative}: {error}")
    if not is_source:
        continue

    try:
        lines = len(file.read_bytes().splitlines())
    except OSError as error:
        raise SystemExit(f"size-gate: cannot read {relative}: {error}")
    checked += 1
    if lines > budget:
        print(f"size-gate: OVER BUDGET — {relative} ({lines} > {budget})")
        failed = True

if failed:
    raise SystemExit(1)
print(f"size-gate: OK — {checked} production files checked (hard budget {budget})")
PY
