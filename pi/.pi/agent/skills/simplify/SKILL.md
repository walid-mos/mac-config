---
name: simplify
user-invocable: true
description: >-
    Post-implementation, pre-review cleanup of a behavior-locked diff: reuse,
    quality, efficiency, altitude. Always fans out four reviewers, then applies
    only behavior-preserving fixes. Trigger on /simplify, "simplifie le diff",
    "cleanup avant review", "simplify last commit", "simplify les PR 12 et 13".
    Not for initial implementation or correctness bugs.
---

# Simplify

Cleanup of a **diff that already works**, before review. Not bug hunting.

Always fan out four independent reviewers. Never collapse into an inline
combined pass — a small diff still has reuse and altitude findings.

## Arguments

`/simplify [scope…] [focus]`

**Default (no scope):** current branch vs `main`.

```bash
git diff main...HEAD
git diff HEAD            # include uncommitted on top
```

If `main` is missing, use the repo default branch (`gh repo view --json defaultBranchRef`).

**Explicit scopes** (combine when useful):

| Scope                           | Diff                                                                                                                            |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| (none)                          | `main...HEAD` + working tree                                                                                                    |
| `last` / `HEAD` / `last commit` | `git show --stat` + `git show` of `HEAD` only                                                                                   |
| `HEAD~N` / `last N commits`     | `git diff HEAD~N...HEAD`                                                                                                        |
| `#12` / `12` / `pr 12`          | `gh pr diff 12`                                                                                                                 |
| `#12 #13` / `prs 12,13`         | each PR diff, reviewed together, applied on the current branch only if it contains those changes                                |
| `maillon`                       | this stack branch vs its parent (`git merge-base --fork-point` of the branch below, else `HEAD~` of the maillon's first commit) |
| `global` / `stack`              | whole stack vs its base (`develop` if it exists, else `main`)                                                                   |
| a path                          | restrict the chosen range to that path                                                                                          |

Remaining free text is extra focus passed to every reviewer.

Several PRs: one fan-out covering the union of those diffs. Do not check
out another branch to apply. If the current branch does not contain a
named PR, report that PR as follow-up and still clean the ones that are
here.

## Phase 0 — Behavior lock + diff

1. Detect test/lint/typecheck commands from `package.json` / `Makefile`.
2. Run the cheapest lock that covers the changed surface. Record the
   exact command and that it was green. No lock → write a one-line
   verification plan and treat structural fixes as follow-up, not apply.
3. Collect the diff for the resolved scope. Empty → stop.

## Phase 1 — Review (always four agents)

Each child returns findings:

```
file, line, summary, cost, class
```

`class` is exactly one of:

- `cleanup` — behavior-preserving, inside the reviewed diff
- `follow-up` — would change behavior, widen scope, or needs a product decision
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
- Scope (range, files, lines)
- Fixed (one line each)
- Follow-up / skipped, with why
- Residual risk

## Boundaries

- Does not hunt correctness bugs. That is a review, not simplify.
- Called from `ship` / `stack` / `accor-ship`: `maillon` first, then
  `global` on the whole stack, **before** `gh stack submit`.
