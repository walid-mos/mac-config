#!/usr/bin/env bash
# Parse and materialize explicit review scopes shared by every gate.
# Usage: parse_scope_arguments (--path P|--range A..B|--commit REF)...
#        materialize_scope <output.json> "${SCOPE_ARGS[@]}"

SCOPE_ARGS=()
parse_scope_arguments() {
    SCOPE_ARGS=()
    while [ "$#" -gt 0 ]; do
        case "$1" in
            --path|--range|--commit)
                [ "$#" -ge 2 ] || {
                    echo "scope: $1 requires a value" >&2
                    return 2
                }
                SCOPE_ARGS+=("$1" "$2")
                shift 2
                ;;
            *)
                echo "scope: unknown argument '$1'" >&2
                return 2
                ;;
        esac
    done
    [ "${#SCOPE_ARGS[@]}" -gt 0 ] || {
        echo "scope: at least one selector is required" >&2
        return 2
    }
}

materialize_scope() {
    local output="${1:?materialize_scope requires an output path}"
    shift

    python3 - "$output" "$@" <<'PY'
import json
import os
import subprocess
import sys
from pathlib import Path


def git(*args: str) -> bytes:
    result = subprocess.run(
        ["git", "-C", root, *args],
        check=False,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    if result.returncode != 0:
        message = result.stderr.decode(errors="replace").strip()
        raise SystemExit(f"scope: git {' '.join(args)} failed: {message}")
    return result.stdout


def nul_paths(payload: bytes) -> list[str]:
    return [os.fsdecode(item) for item in payload.split(b"\0") if item]


if len(sys.argv) < 4:
    raise SystemExit(
        "scope: pass at least one explicit selector: --path P, --range A..B, or --commit REF"
    )

output = Path(sys.argv[1])
arguments = sys.argv[2:]
root_result = subprocess.run(
    ["git", "rev-parse", "--show-toplevel"],
    check=False,
    stdout=subprocess.PIPE,
    stderr=subprocess.PIPE,
)
if root_result.returncode != 0:
    raise SystemExit("scope: current directory is not inside a Git repository")
root = os.fsdecode(root_result.stdout).strip()
invocation_directory = os.getcwd()

paths: set[str] = set()
index = 0
while index < len(arguments):
    selector = arguments[index]
    if selector not in {"--path", "--range", "--commit"}:
        raise SystemExit(f"scope: unknown selector {selector!r}")
    if index + 1 >= len(arguments):
        raise SystemExit(f"scope: {selector} requires a value")
    value = arguments[index + 1]
    index += 2

    if selector == "--path":
        absolute = os.path.abspath(os.path.join(invocation_directory, value))
        try:
            relative = os.path.relpath(absolute, root)
            if os.path.commonpath([root, absolute]) != root:
                raise ValueError
        except ValueError:
            raise SystemExit(f"scope: path is outside the repository: {value}")
        matched = nul_paths(
            git("ls-files", "-z", "--cached", "--others", "--exclude-standard", "--", relative)
        )
    elif selector == "--range":
        matched = nul_paths(
            git("diff", "--name-only", "-z", "--diff-filter=ACMRD", value)
        )
    else:
        git("rev-parse", "--verify", f"{value}^{{commit}}")
        matched = nul_paths(
            git(
                "diff-tree",
                "--root",
                "--no-commit-id",
                "--name-only",
                "-r",
                "-m",
                "-z",
                value,
            )
        )

    if not matched:
        raise SystemExit(f"scope: {selector} {value!r} resolved to no files")
    paths.update(matched)

if not paths:
    raise SystemExit("scope: resolved scope is empty")

output.write_text(json.dumps(sorted(paths), ensure_ascii=True) + "\n")
PY
}
