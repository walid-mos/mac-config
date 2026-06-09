---
name: cockpit-db
description: >-
  Internal sqlite3 client library for the per-project progress.db. Provides
  four subcommands (ingest-track, read-track, list-open, set-status) used by
  the /track and /next skills. Not user-invocable; not registered in the skill
  system. Load only when maintaining cockpit_db.sh or its SQL files.
---

# cockpit-db — maintainer reference

This is an **implementation library**, not a user-facing skill. It is invoked
as a shell subprocess by the `track` and `next` skills via:

```sh
bash "$HERE/../cockpit-db/cockpit_db.sh" <subcommand> ...
```

## Subcommand interface

| Subcommand | Arguments | Output |
|---|---|---|
| `ingest-track` | `<dir> <plan.json> <milestone> <track>` | stderr log line; exits non-zero on failure |
| `read-track` | `<dir> <milestone> <track>` | JSON object (one track + tasks) on stdout |
| `list-open` | `<dir>` | JSON array of staged tracks with open tasks on stdout |
| `set-status` | `<dir> --identifier ID --status S [--sha SHA] [--blocked-reason R]` | stderr log line; exits non-zero if identifier unknown |

Valid `--status` values: `backlog`, `in_progress`, `done`, `blocked`.

## @TOKEN@ placeholder substitution contract

`run_sql_file` does a plain bash string-replacement of `@NAME@` tokens in the
SQL file before passing the result to sqlite3 on stdin. Rules:

1. Each token `@NAME@` is replaced by a **complete, already-quoted SQL token**
   produced by `sql_str()` (a single-quoted SQL string) or a bare SQL keyword
   (e.g. `commit_sha`, `NULL`).
2. **Free-text tokens last.** If a value can contain arbitrary text (e.g. a
   blocked reason), its substitution pair must be passed as the **last**
   argument to `run_sql_file`, so a value containing `@...@` cannot clobber
   another placeholder.
3. The SQL files must never introduce a new `@TOKEN@` without a matching pair
   passed from the calling `cmd_*` function.

## readfile() runtime constraint

`ingest_skeleton.sql` and `ingest_tasks.sql` use `readfile()`, a **sqlite3 CLI
shell extension**. These files MUST be run via the sqlite3 CLI shell (as
`cockpit_db.sh` does). They are incompatible with library-mode sqlite3 clients
(Python `sqlite3` module, SQLAlchemy, etc.) that do not load the shell
extension. Any new SQL file added to this directory must either use only
standard SQL or document this constraint explicitly.

## SCHEMA_VERSION bump protocol

When `SCHEMA_VERSION` must be incremented:

1. Update `SCHEMA_VERSION` constant in `cockpit_db.sh`.
2. Update `progress.schema.sql` with the new schema (greenfield, no migration).
3. Update `INSERT OR IGNORE INTO schema_meta` to seed the new version number.
4. Coordinate with the Tauri app (`src-tauri/src/db/mod.rs`) — it is an
   independent co-client and must be updated to the same version before either
   side opens a shared database.

The version mismatch check in `open_db` is a **loud refusal** (`die`), never a
silent migration. This is intentional.

## DB path derivation

`db_path()` calls `repo_slug()` to derive `~/mizraj/<slug>/progress.db`. The
slug algorithm mirrors the Tauri app's `slug_from_remote_url` byte-for-byte
(last URL segment after `:` or `/`, `.git` stripped, lowercased). **Both must
stay in sync** or the skills and the app resolve different database files.

## Plan parsing dependency

`cmd_ingest_track` calls `python3 "$READ_PLAN"` (resolves to
`../track/read_plan.py`) to validate the plan DAG and emit ingest-ready JSON.
The DB layer itself (all reads, set-status, list-open) is sqlite3-only.
