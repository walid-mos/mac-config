-- Ordered read-only dump of one track's tasks, as a JSON object. @M@ / @T@ are
-- the milestone id ('M1') and track id ('A') as quoted SQL literals. `tasks` is
-- always a JSON array (never null) so the caller parses one shape.
SELECT json_object(
    'milestone_id', @M@,
    'track_id', @T@,
    'branch', (SELECT branch FROM tracks WHERE milestone_id = @M@ AND id = @T@),
    'tasks', (
        SELECT COALESCE(json_group_array(json_object(
            'identifier', identifier,
            'step', step,
            'title', title,
            'status', status,
            'size', size,
            'sink_id', sink_id,
            'description', description,
            'done_when', done_when,
            'blocked_reason', blocked_reason,
            'commit_sha', commit_sha
        )), json('[]'))
        FROM (
            SELECT * FROM tasks
            WHERE origin = 'track' AND milestone_id = @M@ AND track_id = @T@
            ORDER BY position, step
        )
    )
);
