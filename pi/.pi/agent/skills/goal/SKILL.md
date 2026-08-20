---
name: goal
user-invocable: true
description: >-
    Keep working toward a verifiable completion condition across turns, without
    asking the user between steps. Pair with the /goal extension (auto-continue).
    Trigger on /goal, "travaille jusqu'à", "jusqu'à ce que les tests passent",
    "implémente jusqu'à ce que". Use for substantial work with a checkable end
    state, not one-shot questions.
---

# Goal

Claude's `/goal` is a session-scoped stop-hook: a small model judges the
condition after every turn and either continues or clears. Ours does the
same via the extension, plus the delivery rules this workspace already
uses (`stack` hors Plane, `ship` sous Plane).

## When this skill is loaded

A goal is active, or the user just set one. Ship, stack et accor-ship
appellent eux-mêmes `goal_set` (tool d'extension) — le loop est engagé
automatiquement. Work until the condition is **proven** or honestly
impossible.

## How to work

1. **Prove, don't declare.** The evaluator only sees the transcript. A
   condition like "tests pass" is met only after you ran the command and
   the output is in the conversation. Same for `git status`, file counts,
   typecheck.
2. **No mid-flight questions.** Ambiguity that blocks progress is decided
   now, stated in one line, and you move. Client-facing product decisions
   that you cannot own → mark the goal impossible with the exact missing
   decision, do not invent.
3. **Pick the delivery skill once**, then stay on it:
    - Plane epic / tickets → `/ship`
    - free-form feature, Jira, no tracker → `/stack`
    - cleanup of an already-green diff → `/simplify`
    - everything else → implement in place, still with a behavior lock
      Note : ship/stack/accor-ship appellent `goal_set` automatiquement — quand tu
      es dans ces skills, suis leurs phases, le goal est déjà actif.
4. **One verifiable step per turn.** Prefer a command result over a
   paragraph. The evaluator is a small model with no tools.
5. **Do not stop because you feel done.** Stop because the condition's
   stated check just succeeded in this transcript, or because it cannot
   succeed (missing access, contradictory constraint, red lock you cannot
   fix without widening scope).

## Writing a condition (if the user gave a vague one)

Rewrite it internally into:

- one measurable end state
- the command or read-back that proves it
- constraints that must not change

Example: `"auth migration done"` → `"every call site of the old auth
helper is gone (`git grep oldHelper`empty) and`pnpm test` exits 0;
no unrelated files touched`".

Do not ask the user to rephrase unless the condition is empty.

## Impossible

Say so plainly, with the blocker. The extension will clear the goal.
Do not keep spinning.

## Not this skill

- one-shot question → just answer
