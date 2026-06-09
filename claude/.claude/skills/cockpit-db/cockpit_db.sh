#!/usr/bin/env bash
# cockpit_db.sh — the planning skills' sqlite3 client for the per-project progress
# database (~/mizraj/<slug>/progress.db). No Python in the DB read/write layer:
# the deterministic engine is sqlite3 + the canonical SQL beside this file.
# Plan parsing (ingest-track) still calls read_plan.py to validate and slice the
# plan.json; the DB itself is touched only via sqlite3 CLI + SQL files.
# progress.schema.sql here is byte-identical to agent-cockpit's copy, and
# schema_meta.version (SCHEMA_VERSION) turns any drift into a loud refusal at open
# instead of a silent migration. The app and these skills are independent
# co-clients of the one file — whichever opens first creates it.
#
# Subcommands (each takes the project dir as its first argument so the slug and
# db path are resolved from the active project):
#   ingest-track <dir> <plan.json> <milestone> <track>   upsert skeleton + track tasks
#   read-track   <dir> <milestone> <track>               JSON dump of one track
#   list-open    <dir>                                   JSON of staged tracks with open tasks
#   set-status   <dir> --identifier ID --status S [--sha SHA] [--blocked-reason R]
set -euo pipefail

: "${TMPDIR:=/tmp}"

SCHEMA_VERSION=1
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SCHEMA_SQL="$HERE/progress.schema.sql"
READ_PLAN="$HERE/../track/read_plan.py"

die() { printf 'FATAL %s\n' "$*" >&2; exit 2; }
log() { printf '%s\n' "$*" >&2; }

# Quote a value as a single-quoted SQL string literal (double embedded quotes).
sql_str() { printf "'%s'" "$(printf '%s' "$1" | sed "s/'/''/g")"; }

# slug = the last segment of the origin remote URL with a trailing .git stripped,
# lowercased; fallback to the git work-tree directory name. Mirrors the app's
# repo_slug (src-tauri/src/db/mod.rs:54, slug_from_remote_url) byte-for-byte —
# both are repo-only and must STAY repo-only, or the app and the skills resolve
# different ~/mizraj/<slug>/progress.db files and silently read past each other.
repo_slug() {
    local dir="$1" url s repo root
    url="$(git -C "$dir" remote get-url origin 2>/dev/null || true)"
    if [ -n "$url" ]; then
        s="${url%/}"            # drop a trailing slash
        repo="${s##*[:/]}"      # last segment after the final : or /
        repo="${repo%.git}"     # drop a trailing .git
        if [ -n "$repo" ]; then
            printf '%s' "$repo" | tr '[:upper:]' '[:lower:]'
            return
        fi
    fi
    root="$(git -C "$dir" rev-parse --show-toplevel 2>/dev/null)" || die "not a git repo: $dir"
    basename "$root" | tr '[:upper:]' '[:lower:]'
}

db_path() { printf '%s/mizraj/%s/progress.db' "$HOME" "$(repo_slug "$1")"; }

# Create the file (and ~/mizraj/<slug>/), apply the idempotent schema, and refuse
# loudly on a contract-version mismatch (never migrate).
open_db() {
    local db="$1" version
    mkdir -p "$(dirname "$db")"
    sqlite3 -cmd ".timeout 5000" "$db" < "$SCHEMA_SQL"
    version="$(sqlite3 "$db" 'SELECT version FROM schema_meta')"
    [ "$version" = "$SCHEMA_VERSION" ] \
        || die "progress.db schema version $version != expected $SCHEMA_VERSION; reset it (rm '$db')"
}

# Run one SQL file with foreign keys + a busy timeout, substituting @NAME@
# placeholders from name=value pairs. Pairs are applied in order, so a pair whose
# value may contain literal text (e.g. a blocked reason) must be passed LAST.
run_sql_file() {
    local db="$1" file="$2"; shift 2
    local sql pair name value
    sql="$(cat "$HERE/$file")"
    for pair in "$@"; do
        name="${pair%%=*}"
        value="${pair#*=}"
        sql="${sql//@${name}@/$value}"
    done
    # `.timeout` and the foreign_keys setter run on the connection without
    # emitting rows (unlike `PRAGMA busy_timeout=`, which echoes its value), so
    # stdout stays pure query output for the JSON-returning reads. SQL is fed on
    # stdin — passed as an argument it would start with `--` and sqlite3 would
    # mistake the leading comment for an unknown option.
    sqlite3 -cmd ".timeout 5000" -cmd "PRAGMA foreign_keys=ON" "$db" <<<"$sql"
}

cmd_ingest_track() {
    [ $# -eq 4 ] || die "usage: ingest-track <dir> <plan.json> <milestone> <track>"
    local dir="$1" plan="$2" milestone="$3" track="$4"
    [ -f "$plan" ] || die "plan not found: $plan"
    local db; db="$(db_path "$dir")"
    open_db "$db"

    local summary slice
    summary="$(mktemp "$TMPDIR/cockpit.sum.XXXXXX")"
    slice="$(mktemp "$TMPDIR/cockpit.slice.XXXXXX")"

    # Reuse read_plan.py: it validates the plan (DAG/branches), derives the task
    # identifiers, and emits the JSON the SQL ingests. A non-zero exit is a bad plan.
    python3 "$READ_PLAN" "$plan" > "$summary" \
        || { rm -f "$summary" "$slice"; die "read_plan summary failed for $plan"; }
    python3 "$READ_PLAN" "$plan" --milestone "$milestone" --track "$track" > "$slice" \
        || { rm -f "$summary" "$slice"; die "read_plan slice failed for $milestone.$track"; }

    run_sql_file "$db" ingest_skeleton.sql "DOC=$summary"
    run_sql_file "$db" ingest_tasks.sql "DOC=$slice"
    rm -f "$summary" "$slice"
    log "OK ingested ${milestone}.${track} -> $db"
}

cmd_read_track() {
    [ $# -eq 3 ] || die "usage: read-track <dir> <milestone> <track>"
    local dir="$1" milestone="$2" track="$3"
    local mid="${milestone#[Mm]}"; mid="M${mid}"
    local db; db="$(db_path "$dir")"
    open_db "$db"
    run_sql_file "$db" read_track.sql "M=$(sql_str "$mid")" "T=$(sql_str "$track")"
}

cmd_list_open() {
    [ $# -eq 1 ] || die "usage: list-open <dir>"
    local db; db="$(db_path "$1")"
    open_db "$db"
    run_sql_file "$db" list_open.sql
}

cmd_set_status() {
    local dir="$1"; shift
    local identifier="" status="" sha="" reason="" have_reason=0
    while [ $# -gt 0 ]; do
        case "$1" in
            --identifier) identifier="$2"; shift 2;;
            --status) status="$2"; shift 2;;
            --sha) sha="$2"; shift 2;;
            --blocked-reason) reason="$2"; have_reason=1; shift 2;;
            *) die "set-status: unknown arg $1";;
        esac
    done
    [ -n "$identifier" ] || die "set-status: --identifier required"
    [ -n "$status" ] || die "set-status: --status required"
    case "$status" in
        backlog|in_progress|done|blocked) ;;
        *) die "set-status: bad status '$status'";;
    esac

    local db; db="$(db_path "$dir")"
    open_db "$db"

    # @SHA@ keeps the current value when no --sha; @REASON@ is NULL unless blocking.
    local sha_tok="commit_sha"; [ -n "$sha" ] && sha_tok="$(sql_str "$sha")"
    local reason_tok="NULL"; [ "$have_reason" = 1 ] && reason_tok="$(sql_str "$reason")"

    local changed
    # REASON last: it is the only free-text token, so substituting it after the
    # others prevents a reason containing "@…@" from clobbering another placeholder.
    changed="$(run_sql_file "$db" set_status.sql \
        "STATUS=$(sql_str "$status")" "SHA=$sha_tok" "ID=$(sql_str "$identifier")" "REASON=$reason_tok")"
    [ "$changed" -ge 1 ] 2>/dev/null || die "set-status: no task with identifier $identifier"
    log "OK $identifier -> $status"
}

main() {
    [ $# -ge 1 ] || die "usage: cockpit_db.sh <ingest-track|read-track|list-open|set-status> ..."
    local cmd="$1"; shift
    case "$cmd" in
        ingest-track) cmd_ingest_track "$@";;
        read-track)   cmd_read_track "$@";;
        list-open)    cmd_list_open "$@";;
        set-status)   cmd_set_status "$@";;
        *) die "unknown subcommand: $cmd";;
    esac
}

main "$@"
