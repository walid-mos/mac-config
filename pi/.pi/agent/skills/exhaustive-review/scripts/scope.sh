#!/usr/bin/env bash
# Shared scope resolution — sourced by inventory.sh, coverage.sh, size-gate.sh.
# resolve_scope ARGS... -> sorted, deduped file list on stdout.
# Accepted args (mixable, repeatable):
#   <gitrange>   anything containing ".." (e.g. origin/develop-pi, HEAD~5..HEAD,
#                abc123..def456) -> files changed in that range
#   <path>       existing file or directory -> tracked + untracked-but-not-ignored
#                files under it (use for "these files" / "this feature" scopes)
resolve_scope() {
    local arg
    [ $# -gt 0 ] || { echo "scope: no arguments — pass a git range (A..B) and/or paths" >&2; return 1; }
    for arg in "$@"; do
        case "$arg" in
            *..*)
                git diff --name-only --diff-filter=ACMR "$arg" || return 1
                ;;
            *)
                if [ -e "$arg" ]; then
                    git ls-files --cached --others --exclude-standard -- "$arg"
                else
                    echo "scope: '$arg' is neither a git range (A..B) nor an existing path" >&2
                    return 1
                fi
                ;;
        esac
    done | sort -u
}
