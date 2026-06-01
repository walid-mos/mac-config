-- Canonical, idempotent schema for the per-project progress database
-- (`~/mizraj/<slug>/progress.db`). The app and the planning skills are
-- independent co-clients of the same file — neither "needs" the other, and
-- `CREATE ... IF NOT EXISTS` lets whichever opens first create it. There is no
-- checksummed migration: this file IS the contract, versioned via schema_meta.
-- A version mismatch is a loud refusal, never a silent migration.

-- Live agent sessions: one row per spawned PTY, written on create and removed
-- on close. Per-project now that the whole database is per-project.
CREATE TABLE IF NOT EXISTS agent_sessions (
    id TEXT PRIMARY KEY NOT NULL,
    repo_path TEXT NOT NULL,
    worktree_path TEXT NOT NULL,
    ref_name TEXT NOT NULL,
    started_at TEXT NOT NULL,
    ended_at TEXT,
    status TEXT NOT NULL CHECK (status IN ('starting', 'running', 'idle', 'ended', 'failed'))
);

CREATE INDEX IF NOT EXISTS idx_agent_sessions_status ON agent_sessions(status);

-- Milestones: demoable increments, ordered by value. `id` "M5", `number` 5
-- (parsed from the id), `needs` modelled relationally in `milestone_needs`.
CREATE TABLE IF NOT EXISTS milestones (
    id        TEXT PRIMARY KEY NOT NULL,
    number    INTEGER NOT NULL,
    demo      TEXT NOT NULL,
    skeleton  INTEGER NOT NULL DEFAULT 0,
    position  INTEGER NOT NULL
);

-- The needs[] DAG, one edge per row. Both FKs guarantee the referenced
-- milestone exists; backward-only is asserted upstream (the skills' read_plan).
CREATE TABLE IF NOT EXISTS milestone_needs (
    milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    needs_id     TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    PRIMARY KEY (milestone_id, needs_id)
);

-- Tracks: one PR each. `id` "A" is unique only within its milestone; `branch`
-- is unique across the whole plan.
CREATE TABLE IF NOT EXISTS tracks (
    milestone_id TEXT NOT NULL REFERENCES milestones(id) ON DELETE CASCADE,
    id           TEXT NOT NULL,
    branch       TEXT NOT NULL UNIQUE,
    position     INTEGER NOT NULL,
    PRIMARY KEY (milestone_id, id)
);

-- Tasks carry both flat user-authored rows (origin 'user', track ref NULL,
-- fully editable) and track-derived rows (origin 'track'). `id` is the surrogate
-- the app addresses: a ULID for a user task, the coordinate "M5.A-01" for a
-- track task. `identifier` is the derived coordinate (NULL for user tasks),
-- UNIQUE so the skills upsert track tasks on it. Re-ingesting the plan updates
-- only the STRUCTURAL columns; the STATE columns (status, blocked_reason,
-- commit_sha, created_at) are never clobbered. The CHECK constraints make the
-- status/origin vocabulary the enforced contract.
CREATE TABLE IF NOT EXISTS tasks (
    id             TEXT PRIMARY KEY NOT NULL,
    identifier     TEXT UNIQUE,
    origin         TEXT NOT NULL CHECK (origin IN ('user', 'track')),
    -- structural (NULL for a flat user task) ───────────────────────
    milestone_id   TEXT,
    track_id       TEXT,
    step           TEXT,
    title          TEXT NOT NULL,
    description    TEXT,
    done_when      TEXT,
    size           TEXT,
    sink_id        TEXT,
    position       INTEGER NOT NULL DEFAULT 0,
    -- execution state ──────────────────────────────────────────────
    status         TEXT NOT NULL DEFAULT 'backlog'
                     CHECK (status IN ('backlog', 'in_progress', 'done', 'blocked')),
    blocked_reason TEXT,
    commit_sha     TEXT,
    created_at     TEXT NOT NULL,
    FOREIGN KEY (milestone_id, track_id)
        REFERENCES tracks(milestone_id, id) ON DELETE CASCADE
);

-- Decisions a task realizes (slice_of, e.g. ["D2","D3"]), one tag per row.
-- decision_id is opaque — decisions themselves are not modelled here.
CREATE TABLE IF NOT EXISTS task_slice_of (
    task_id     TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    decision_id TEXT NOT NULL,
    PRIMARY KEY (task_id, decision_id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_tree   ON tasks(milestone_id, track_id, position);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_user   ON tasks(origin, created_at DESC, id DESC);

-- Single-row table carrying the schema-contract version, so a client can detect
-- an incompatible peer before writing. The id CHECK pins it to exactly one row;
-- the seed is a no-op on every later open.
CREATE TABLE IF NOT EXISTS schema_meta (
    id      INTEGER PRIMARY KEY CHECK (id = 1),
    version INTEGER NOT NULL
);

INSERT OR IGNORE INTO schema_meta (id, version) VALUES (1, 1);
