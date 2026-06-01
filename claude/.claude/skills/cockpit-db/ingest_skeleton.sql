-- Upsert the full milestone/track skeleton + the needs DAG from a plan summary
-- (the output of `read_plan.py <plan.json>`, written to @DOC@). STRUCTURAL only:
-- task rows are ingested per chosen track by ingest_tasks.sql, so a track is
-- "staged" for /next exactly when it has tasks. Idempotent — re-running changes
-- nothing but refreshed structural fields.
BEGIN;

INSERT INTO milestones (id, number, demo, skeleton, position)
SELECT json_extract(m.value, '$.id'),
       json_extract(m.value, '$.number'),
       json_extract(m.value, '$.demo'),
       json_extract(m.value, '$.skeleton'),
       json_extract(m.value, '$.number')
FROM json_each((SELECT readfile('@DOC@')), '$.milestones') AS m
WHERE true
ON CONFLICT(id) DO UPDATE SET
    number   = excluded.number,
    demo     = excluded.demo,
    skeleton = excluded.skeleton,
    position = excluded.position;

INSERT INTO tracks (milestone_id, id, branch, position)
SELECT json_extract(m.value, '$.id'),
       json_extract(t.value, '$.id'),
       json_extract(t.value, '$.branch'),
       t.key
FROM json_each((SELECT readfile('@DOC@')), '$.milestones') AS m,
     json_each(m.value, '$.tracks') AS t
WHERE true
ON CONFLICT(milestone_id, id) DO UPDATE SET
    branch   = excluded.branch,
    position = excluded.position;

-- The needs edges carry no state, so rebuild them wholesale. Every referenced
-- milestone exists (all are upserted above), so the FK on needs_id holds.
DELETE FROM milestone_needs;
INSERT OR IGNORE INTO milestone_needs (milestone_id, needs_id)
SELECT json_extract(m.value, '$.id'), n.value
FROM json_each((SELECT readfile('@DOC@')), '$.milestones') AS m,
     json_each(m.value, '$.needs') AS n;

COMMIT;
