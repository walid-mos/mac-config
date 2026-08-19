---
name: simplify
user-invocable: true
description: >-
    Post-implementation, pre-review cleanup of a behavior-locked diff: reuse,
    quality, efficiency, altitude. Always fans out four local execution
    children, verifies cleanups, then applies only behavior-preserving fixes.
    Trigger on /simplify, "simplifie le diff", "cleanup avant review",
    "simplify last commit", "simplify les PR 12 et 13". Not for initial
    implementation or correctness bugs.
---

# Simplify

Cleanup of a **diff that already works**, before review. Not bug hunting.

## Execution contract

Foreground, live card, **30 min**. Never lower `timeoutMs`. Never use
`$` in the script (no shell). Children: `acceptance: false`.

## Arguments

`/simplify [scope…] [focus]`

**Default (no scope):** current branch vs repo default (`develop` if it
exists, else `main`, else `gh repo view --json defaultBranchRef`) plus
the working tree.

```bash
git diff <base>...HEAD
git diff HEAD
```

| Scope                           | Diff                                                                                                                                              |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| (none)                          | `<base>...HEAD` + working tree                                                                                                                    |
| `last` / `HEAD` / `last commit` | `git show` of `HEAD` only                                                                                                                         |
| `HEAD~N` / `last N commits`     | `git diff HEAD~N...HEAD`                                                                                                                          |
| `#12` / `12` / `pr 12`          | `gh pr diff 12`                                                                                                                                   |
| `#12 #13` / `prs 12,13`         | union of those PR diffs; apply only if this branch contains them                                                                                  |
| `maillon`                       | this stack branch vs the branch below (`gh stack view`; else `git merge-base --fork-point` of that parent, else the first unique commit's parent) |
| `global` / `stack`              | whole stack vs its base (`develop` if it exists, else `main`)                                                                                     |
| a path                          | restrict the chosen range to that path                                                                                                            |

Remaining free text is extra focus, appended to every child task.

Several PRs: one fan-out on the union. Do not check out another branch
to apply. A named PR not on this branch → follow-up, still clean the ones
that are here.

## Phase 0 — Behavior lock + file list (you, inline)

1. Detect test/lint/typecheck from `package.json` / `Makefile`.
2. Run the cheapest lock that covers the changed surface. Record the
   exact command and that it was green. No lock → one-line verification
   plan; treat structural fixes as follow-up, not apply.
3. Resolve the range. Collect the file list. **Drop generated files**
   before any agent sees them: `**/migrations/meta/*_snapshot.json`,
   lockfiles, generated clients, license dumps. Empty after that → stop.
4. Build `FILES` (explicit, sorted) and `RANGE` (`<base>...HEAD` or the
   equivalent). Children never re-derive the partition.

Pass each child the **full source diff** (generated already stripped)
plus `RANGE` + `FILES`. Same contract as Claude's bundled `/simplify`:
complete context, then they grep the wider repo.

Wait for every child. Dedup by `file|line` or the same mechanism.

## Phase 2 — Verify, then apply

You verify each `cleanup` yourself (read/grep — no more agents unless
more than 8 cleanups survive):

- Reuse: the named helper exists and the signature matches.
- Quality: the copies are the same knowledge (AHA), not look-alikes.
- Efficiency: the I/O is actually independent.
- Altitude: the deeper mechanism already exists.

Failed verification → `skip`. Do not expand scope because nearby code
looks messy.

Apply only verified `cleanup`:

- All `trivial`/`local` in ≤ 3 files → you may apply.

Re-run the behavior lock. Red → revert the offending fix, move it to
follow-up. Never leave the tree red.

Commit the cleanups only if the caller already has a commit convention
in flight (`ship` / `stack` / `accor-ship`). Otherwise leave them
unstaged and say so.

## Failure recovery

`.filter` on `runs.all` — children die. `stats.failed` goes in the report.

If the parent workflow itself times out: completed `structuredOutput` is
still on the child runs — read it (`children.list` / run artifacts),
then retry only the missing angles. Collapsing to an inline pass is a
skill violation, not a fallback.

## Output

- Behavior lock used (command + result)
- Scope (range, files kept, files dropped as generated)
- Fixed (one line each)
- Follow-up / skipped, with why
- Failed angles, if any, and what you retried
- Residual risk

## Boundaries

- Does not hunt correctness bugs. That is a review, not simplify.
- Called from `ship` / `stack` / `accor-ship`: `maillon` first, then
  `global` on the whole stack, **before** `gh stack submit`.
