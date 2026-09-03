---
name: exhaustive-review
description: Use for an exhaustive review, audit, or simplification of an explicit git path, range, or commit. Requires one temporary manifest per objective, complete file coverage, and fail-closed gates before claiming completion.
---

# Exhaustive Review

Exhaustiveness is proved by an enumerated scope and a gate, never by memory or a
completion claim.

## 0. Clarify and inventory

If the scope is ambiguous, resolve only that ambiguity with `ask_user_question`.
Then inventory before web research, source inspection, or editing:

```bash
scripts/inventory.sh --objective <name> [--report-only] \
  (--path <path> | --range <A..B> | --commit <ref>)...
```

Selectors are explicit, repeatable, and mixable. Ranges and commits include
deleted paths. Inventory fails on invalid or empty selectors and creates a unique
JSONL manifest under `$TMPDIR`; it prints a `review-id` and manifest path. Never
choose or reuse a manifest path.

Create a separate inventory for every evaluation objective. Do not combine bugs,
duplication, architecture, formatting, or another objective in one manifest.

## 1. Survey without changing scoped sources

Visit every manifest path. Change only its `verdict` and `note` fields:

- `pending` — not yet visited;
- `done` — evaluated for this manifest's objective;
- `skip` — not evaluated; requires a non-empty reason in `note`.

Do not modify files in the reviewed scope during the survey. A report-only review
ends with findings and gates; it never requires remediation.

For more than 15 files, review in batches of at most 8 in manifest order.
Record evidence and verdicts directly in the manifest after each batch.

## 2. Remediate one objective

For a remediation review, make a separate pass for the manifest's sole objective.
Keep unrelated findings in the report rather than fixing them. For any test-owned
path, follow `coding` section 6; this workflow adds no ownership exception.

## 3. Finish fail closed

Using exactly the inventory selectors, run `scripts/size-gate.sh` and then the
final `scripts/coverage.sh --review-id <id>`. Their usage comments own CLI details.

The hard policy is at most 250 production lines; an explicit budget may only be
stricter. A remediation is not complete while size fails. In report-only mode,
report the violation without changing source and do not call the scope compliant.

Coverage is the final operation and consumes its temporary review state. Record
the negative space before running it. Any failure requires a fresh inventory.
Never call an objective's audit exhaustive or complete unless coverage exits 0.
