-- Set one track task's execution state by identifier. Each @TOKEN@ is a complete,
-- already-quoted SQL token supplied by cockpit_db.sh: @STATUS@/@ID@ are quoted
-- string literals; @SHA@ is either a quoted literal or the bare `commit_sha`
-- (keep the current value); @REASON@ is either a quoted literal or bare `NULL`.
-- The trailing changes() lets the caller fail loud when the identifier is unknown.
--
-- Self-assignment trick for @SHA@: when no --sha flag is passed, cockpit_db.sh
-- substitutes the bare column name `commit_sha` so the UPDATE becomes
-- `commit_sha = commit_sha`, which is a no-op preserving the existing value.
-- FRAGILITY: if the column is ever renamed, the substitution silently breaks
-- (the bare name no longer resolves) without a syntax error. A rename must be
-- accompanied by updating cockpit_db.sh line that sets `sha_tok="commit_sha"`.
UPDATE tasks
SET status         = @STATUS@,
    blocked_reason = @REASON@,
    commit_sha     = @SHA@
WHERE identifier = @ID@;

SELECT changes();
