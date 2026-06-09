# Domain model

Reference vocabulary used by `/track`, `/backlog`, and `/next`.
See `docs/notes/2026-05-29-workflow-phases-redesign.html` for the full design notes.

## Three-axis model

- **Milestone** — a demonstrable increment, ordered by visible value. `M1` is
  the walking skeleton.
- **Track** — a sequential chain of tasks inside a milestone that ships as ONE
  PR. Tracks of the same milestone are independent → parallelizable.
- **Task** — one commit, calibrated I3/I4. The grain `/next` executes.

The derived identifier `[M{milestone}.{track}-{step}]` (e.g. `[M1.A-01]`) encodes
both axes; regex `\[M(\d+)\.([A-Z]+)-(\d+)\]`.

## Task state vocabulary (the `status` column)

| status        | meaning                                                                                          |
|---------------|--------------------------------------------------------------------------------------------------|
| `backlog`     | Not started.                                                                                     |
| `in_progress` | Implemented on the working tree, NOT committed — awaiting validation. Linear In Progress if `sink_id`. |
| `done`        | Validated on the previous `/next`; committed + pushed (`commit_sha` set). Linear Done + archived if `sink_id`. |
| `blocked`     | Skipped by `/next` until unblocked; `blocked_reason` says why.                                    |

`/next` owns the transitions; `/track` only ingests tasks (as `backlog` on first
insert — re-ingest never resets an already-progressed task).
