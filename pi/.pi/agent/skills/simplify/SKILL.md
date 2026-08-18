---
name: simplify
user-invocable: true
description: >-
    Post-implementation, pre-review cleanup of a behavior-locked diff: reuse,
    quality, efficiency, altitude. Then apply only behavior-preserving fixes.
    Trigger on /simplify, "simplifie le diff", "cleanup avant review",
    "simplify le maillon", "simplify global". Not for initial implementation
    or correctness bugs.
---

# Simplify

Cleanup of a **diff that already works**, before review. Not bug hunting.

Claude's bundled `/simplify` fans out three reviewers (reuse, quality,
efficiency). Ours adds **altitude** — the angle `ship` / `stack` /
`accor-ship` actually ask for — and skips the fan-out on tiny diffs.

## Arguments

`/simplify [scope] [focus]`

- no args — working tree + commits on this branch vs its merge-base
- `maillon` / `local` — same, but never walk past the current branch tip
  (use after a stack maillon, before `gh stack add`)
- `global` / `stack` — whole stack vs `--base` (`develop` if it exists,
  else the repo default branch)
- a path, PR number (`#132`), or branch name — that target only
- remaining text — extra focus passed to every reviewer

## Phase 0 — Behavior lock + diff

1. Detect test/lint/typecheck commands from `package.json` / `Makefile`.
2. Run the cheapest lock that covers the changed surface. Record the
   exact command and that it was green. No lock → write a one-line
   verification plan and treat structural fixes as follow-up, not apply.
3. Collect the diff:
    - uncommitted: `git diff HEAD` and `git status --porcelain`
    - committed: `git diff <base>...HEAD` (three dots)
    - `base` = `@{upstream}` if it exists, else `develop` if it exists,
      else the default branch
4. Empty diff → stop. Nothing to simplify.

Tiny-diff shortcut: **< 4 files and < 80 lines** → one inline combined
pass (all four angles). Do not spawn agents.

## Phase 1 — Review (read-only)

Each child returns a list of findings:

```
file, line, summary, cost, class
```

`class` is exactly one of:

- `cleanup` — behavior-preserving, inside the reviewed diff
- `follow-up` — real issue that would change behavior, widen scope, or
  needs a product decision
- `skip` — false positive or out of scope

### Reuse

New code that re-implements something the repo already has. Grep
shared/utility modules and files next to the change. Name the existing
helper.

### Quality

Redundant or derivable state, copy-paste with a slight variation,
parameter sprawl, leaky abstractions, stringly-typed values where a
union already exists, wrapper JSX that adds no layout, narrative
comments (delete; keep only a non-obvious WHY).

### Efficiency

Redundant work, sequential independent I/O, blocking work on a hot
path, no-op store updates, TOCTOU existence checks, unbounded growth.

### Altitude

The fix sits too high: a special case layered on shared infrastructure
instead of generalizing the mechanism. Prefer deepening the module
(`coding/architecture.md` ARCH 0) over another `if`. Skip anything that
would change intended behavior.

## Phase 2 — Apply

Wait for every child. Dedup by file+line or same mechanism. Apply only
`cleanup`. Skip the rest and list them.

Do not expand scope because nearby code looks messy.

Re-run the behavior lock. Red → revert the offending fix, move it to
follow-up. Never leave the tree red.

Commit the cleanups only if the caller already has a commit convention
in flight (`ship` / `stack` / `accor-ship`). Otherwise leave them
unstaged and say so.

## Output

- Behavior lock used (command + result)
- Scope (base, files, lines)
- Depth: `combined` or `four-viewpoint`
- Fixed (one line each)
- Follow-up / skipped, with why
- Residual risk

## Boundaries

- Does not hunt correctness bugs. That is a review, not simplify.
- Called from `ship` / `stack` / `accor-ship`: maillon first, then
  `global` on the whole stack, **before** `gh stack submit`.
