# PR-maillon slicing

Single source of truth for how `/stack` (and `/ship` via Stack) turns a
scope into ordered maillons. Other skills pass facts and constraints
here; they do not restate these rules or their numeric thresholds.

A **maillon** is one branch + one PR. The stack is a sequence of
maillons. Apply this contract after gathering the scope (free-text
description, or Plane tickets already topologically ordered).

## Defaults

- **One coherent feature = one maillon.** A feature or CRUD that is one
  product unit stays one maillon even if it spans API + UI or several
  Plane tickets.
- **Sequential stack ≠ parallelism.** Links exist so each maillon is
  readable and testable alone, in dependency order. They never exist to
  fan work out across people or agents.
- **Ordered dependencies are preserved.** A maillon depends only on
  those below it. Do not reorder around a blocking edge.

## Soft budgets

`--max-files` (default **20**) and `--max-lines` (default **1000**) are
soft ceilings for readability, not split triggers.

- Exceed them rather than cut a coherent unit or leave a red /
  uncompilable / untestable maillon.
- Never split into an incoherent or red state to honor a budget.
- A budget overrun is allowed and must be called out in the plan; it is
  not a reason to fragment a CRUD or a tightly coupled pair (schema +
  its config, API + the only UI that can exercise it).

## When to add another maillon

Split (or keep tickets apart) only when the result is still a coherent,
compilable, reviewable feature **and** one of:

- a hard dependency order (foundation before consumer);
- two product units that are independently meaningful and testable;
- a mid-run overflow that can be closed as a complete maillon
  (`gh stack add`) without abandoning a red parent.

Do **not** split by mechanical layer (schema → validation → wiring →
UI) or by CRUD verb (create / read / update / delete) just to shrink a
diff. Do **not** isolate a trivial ticket as its own PR when it belongs
to the same feature.

## Inputs

From `/stack` (free-text scope) or `/ship` (no local algorithm):

- Topologically ordered work items, or a single description.
- Per item: coupling, blocking edges, surfaces (API/UI), acceptance.
- `--max-files` / `--max-lines` when the caller overrides them.
- Caller-specific constraints (Accor naming, proto 1:1, …) — applied on
  top, never as a second slicing algorithm.

## Output

Ordered maillons: branch slug, contents (tickets or scope), estimated
files/lines, whether a soft budget is exceeded (and why), test
commands. Then execute in that order.
