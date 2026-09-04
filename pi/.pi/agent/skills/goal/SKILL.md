---
name: goal
description: >-
    Keep working toward a verifiable completion condition across turns, without
    asking the user between steps. Pair with the /goal extension (auto-continue
    loop, evaluator configured in goal.json). Trigger on
    /goal, "travaille jusqu'à", "jusqu'à ce que les tests passent", "implémente
    jusqu'à ce que". Use for substantial work with a checkable end state, not
    one-shot questions.
---

# Goal

The `/goal` **extension** owns the loop (set / status / clear, evaluate after
each settled turn, auto-continue). This skill owns **how you work** while a
goal is active.

## When this skill is loaded

A goal is active, or the user just set one. Work until the condition is
**proven** or honestly impossible.

## How to work

1. **Prove, don't declare.** The evaluator only sees the transcript. A
   condition like "tests pass" is met only after you ran the command and
   the output is in the conversation. Same for `git status`, file counts,
   typecheck.
2. **No mid-flight questions.** Ambiguity that blocks progress is decided
   now, stated in one line, and you move. Client-facing product decisions
   that you cannot own → mark the goal impossible with the exact missing
   decision, do not invent.
3. **Follow the active skills.** Code work follows `coding`; the goal
   loop itself is never a reason to bypass it.
4. **One verifiable step per turn.** Prefer a command result over a
   paragraph. `list`, `wait`, repeated reviews and cancellations are not
   progress unless they produce materially new proof.
5. **Bound work.** Complete only the smallest slice needed for the next
   proof. Never rerun an exhaustive review after every small correction;
   finish a coherent implementation slice, ingest existing findings, then
   run one final fresh review.
6. **Stop on resource failure.** A provider quota, uncached-token limit or
   failed assistant turn pauses the goal. Do not retry automatically. Once
   resources are available, a natural-language request to resume reactivates
   the interrupted goal; the user need not repeat `/goal` or its condition.
7. **Do not stop because you feel done.** Stop because the condition's
   stated check just succeeded in this transcript, or because it cannot
   succeed (missing access, contradictory constraint, red lock you cannot
   fix without widening scope).

## Writing a condition (if the user gave a vague one)

Rewrite it internally into:

- one measurable end state
- the command or read-back that proves it
- constraints that must not change

Example: `"auth migration done"` → `"every call site of the old auth
helper is gone (`git grep oldHelper` empty) and the repo test suite exits 0;
no unrelated files touched"`.

Do not ask the user to rephrase unless the condition is empty.

## Evaluator configuration

The judge model candidates live in `~/.pi/agent/goal.json` — the single
source of truth for evaluator routing. Never pin or substitute a model in
conversation; edit the route there if the evaluator misbehaves.

## Impossible

Say so plainly, with the blocker. The extension will clear the goal.
Do not keep spinning.

## Not this skill

- one-shot question → just answer
- scheduled/recurring work → nothing built-in; say it is not covered
