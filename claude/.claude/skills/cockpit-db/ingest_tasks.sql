-- Upsert the chosen track's tasks + their slice_of from a track slice (the
-- output of `read_plan.py <plan.json> --milestone M --track T`, written to @DOC@).
-- The surrogate id is the coordinate without brackets ("[M1.A-01]" -> "M1.A-01");
-- identifier keeps the brackets and is the upsert key. ON CONFLICT updates
-- STRUCTURAL columns only — status / blocked_reason / commit_sha / created_at are
-- execution state owned by the app and /next, never clobbered by re-ingest.
BEGIN;

INSERT INTO tasks
    (id, identifier, origin, milestone_id, track_id, step,
     title, description, done_when, size, sink_id, position, created_at)
SELECT
    substr(json_extract(tk.value, '$.identifier'), 2,
           length(json_extract(tk.value, '$.identifier')) - 2),
    json_extract(tk.value, '$.identifier'),
    'track',
    json_extract(s.j, '$.milestone.id'),
    json_extract(s.j, '$.track.id'),
    json_extract(tk.value, '$.step'),
    json_extract(tk.value, '$.title'),
    json_extract(tk.value, '$.description'),
    json_extract(tk.value, '$.done_when'),
    json_extract(tk.value, '$.size'),
    json_extract(tk.value, '$.sink_id'),
    tk.key,
    strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
FROM (SELECT readfile('@DOC@') AS j) AS s,
     json_each(s.j, '$.track.tasks') AS tk
WHERE true
ON CONFLICT(identifier) DO UPDATE SET
    milestone_id = excluded.milestone_id,
    track_id     = excluded.track_id,
    step         = excluded.step,
    title        = excluded.title,
    description  = excluded.description,
    done_when    = excluded.done_when,
    size         = excluded.size,
    sink_id      = excluded.sink_id,
    position     = excluded.position;

-- Rebuild slice_of for exactly this track's tasks (junction carries no state).
DELETE FROM task_slice_of WHERE task_id IN (
    SELECT substr(json_extract(tk.value, '$.identifier'), 2,
                  length(json_extract(tk.value, '$.identifier')) - 2)
    FROM (SELECT readfile('@DOC@') AS j) AS s,
         json_each(s.j, '$.track.tasks') AS tk
);
INSERT OR IGNORE INTO task_slice_of (task_id, decision_id)
SELECT substr(json_extract(tk.value, '$.identifier'), 2,
              length(json_extract(tk.value, '$.identifier')) - 2),
       d.value
FROM (SELECT readfile('@DOC@') AS j) AS s,
     json_each(s.j, '$.track.tasks') AS tk,
     json_each(tk.value, '$.slice_of') AS d;

COMMIT;
