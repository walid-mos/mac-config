-- Set one track task's execution state by identifier. Each @TOKEN@ is a complete,
-- already-quoted SQL token supplied by cockpit_db.sh: @STATUS@/@ID@ are quoted
-- string literals; @SHA@ is either a quoted literal or the bare `commit_sha`
-- (keep the current value); @REASON@ is either a quoted literal or bare `NULL`.
-- The trailing changes() lets the caller fail loud when the identifier is unknown.
UPDATE tasks
SET status         = @STATUS@,
    blocked_reason = @REASON@,
    commit_sha     = @SHA@
WHERE identifier = @ID@;

SELECT changes();
