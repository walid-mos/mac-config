-- Every staged track (one that has track tasks) carrying at least one unfinished
-- task, as a JSON array — the disambiguation source for /track and /next. A track
-- whose skeleton row exists but has no tasks is NOT listed (it is not staged).
SELECT COALESCE(json_group_array(json_object(
    'milestone_id', milestone_id,
    'track_id', track_id,
    'branch', branch,
    'open', open_count,
    'total', total_count
)), json('[]'))
FROM (
    SELECT t.milestone_id AS milestone_id,
           t.id           AS track_id,
           t.branch       AS branch,
           SUM(CASE WHEN k.status IN ('backlog', 'in_progress', 'blocked') THEN 1 ELSE 0 END) AS open_count,
           COUNT(k.id)    AS total_count
    FROM tracks t
    JOIN tasks k
      ON k.origin = 'track' AND k.milestone_id = t.milestone_id AND k.track_id = t.id
    GROUP BY t.milestone_id, t.id, t.branch
    HAVING open_count > 0
    ORDER BY t.milestone_id, t.id
);
