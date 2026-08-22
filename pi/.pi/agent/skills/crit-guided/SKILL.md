---
name: crit-guided
user-invocable: true
description: >-
    Open a Crit Story (guided/chaptered) review of the current diff, then run
    Crit's persistent multi-round comment loop in the same review session. Use
    only when the user invokes /crit-guided, its /cg alias, or explicitly asks
    for a guided, story, or chaptered Crit review. Generic /crit or unguided
    review does not count.
---

## Workdir

Each `bash` call is a new shell. Variables and traps do **not** persist.

1. Create a directory with one call: `mktemp -d /tmp/crit-guided.XXXXXX`
2. Remember the printed **absolute** path. Pass that literal path in every later command. Do not rely on `$WORKDIR` or a `trap`.
3. Reuse that same directory for every story attempt and review round.
4. On the final workflow exit (approval or unrecoverable error), run `rm -rf <absolute-path>` in its own `bash` call. Cleanup is not automatic. Do not remove it between retryable attempts or rounds.

## Author and ingest a story

Build one literal `<scope-flags>` string from the user's scope (`--pr`, `--mr`,
`--range`, `--base-branch`, `--scope`, or none for the branch/working-tree
diff). Reuse it unchanged for every Story and review command so they resolve to
the same Crit session. Substitute the remembered absolute directory for
`<dir>` below.

1. `crit story <scope-flags> --guide > <dir>/guide.md`
2. `crit story <scope-flags> --prep <dir>/prep.txt`
3. Remove any previous output: `rm -f <dir>/story.json`. This must happen immediately before every writer launch so a failed writer cannot reuse stale JSON.
4. Launch **one** `crit-story-writer`:
    - `agent`: `crit-story-writer`
    - `context`: `fresh`
    - `async`: false (foreground)
    - `acceptance`: false
    - `task` must contain the three absolute paths:
        - `GUIDE=<dir>/guide.md`
        - `PREP=<dir>/prep.txt`
        - `STORY_JSON=<dir>/story.json`
5. Confirm `<dir>/story.json` exists and is non-empty. If it does not, clean the workdir, stop, and report the writer failure. Do not invent JSON.
6. Ingest with replacement semantics on every invocation, including a resumed branch that already has a Story:
   `crit story <scope-flags> --story-file <dir>/story.json --refresh --no-open`
   `--refresh` is not a substitute for guide/prep/writer; it only makes ingestion idempotent when the Crit session already contains a Story.
   On ingest rejection or a "diff changed since prep" / drift error: delete
   `<dir>/story.json`, repeat steps 1–6 **once** from a fresh prep. If the
   second attempt fails, clean the workdir, stop, and report Crit's error. Do not invent JSON.

## Open the same session

After a successful ingest, call `crit_review` with `<scope-flags>` split into
its `arguments` array (or `["--session", "<id>"]` if ingest printed a session).
Never launch the interactive review through bash. `crit_review` has no timeout,
forwards cancellation, and returns only after **Finish Review**, with complete
stdout instructions and stderr status. Relay the printed URL while the review
is open if available, then follow the returned instructions automatically.
Follow official `/crit` steps 3–4 only: read stdout and the stderr
`approved:` status, fix unresolved comments, reply with
`crit comment --reply-to` (no `--resolve` unless the user asks), and do not read
the review file early. **Do not execute official step 5 directly**; replace it
with the refresh-first reconnect sequence below.

## After each correction round

Before reconnecting (`crit --session …` or the command stdout printed):

1. Re-run **Author and ingest a story** so chapters match the current full diff. Crit keeps comments, viewed state, and round diffs.
2. Tell the user the story was refreshed, then call `crit_review` with the reconnect command's arguments and follow its returned instructions.
   Stop when `approved: true` or Finish Review has zero unresolved comments.

## Out of scope

- Live URL / HTML / plan-file reviews → official `/crit`
- Configuring `~/.crit.config.json` `agent_cmd`
- Calling `crit story` without `--guide`/`--prep`/`--story-file` (that would
  require `agent_cmd`)
