---
name: interview
description: >-
  Interview the user relentlessly about a plan, design, or proposal until
  reaching shared understanding, resolving each branch of the decision tree,
  then capture the resolved decisions as an autonomous HTML deliverable.
  Asks one question at a time with a recommended answer. Use when the user
  runs `/interview`, says "grill me", "stress-test this plan", "challenge my
  design", "interview me", or wants to surface unresolved assumptions before
  implementation.
user-invocable: true
---

# Interview

All work is rendered as interactive HTML rounds served by `rp`. The chat is for short framing; every actual decision passes through the HTML loop.

## Phases

1. **Discovery** (round 0) → see `./discovery.md`. Classify `change_kind`, enumerate branches, pre-prune by category, render `branches-tree`.
2. **Grilling** (rounds 1..N, multi-round + batched) → see `./grilling.md`. For each in-scope branch, batch questions to fill the six-field closure schema.
3. **Closure** (final round) → see `./closure.md`. Six-field completeness check; promote to `docs/plans/` when sealed.

All three phases use blocks from `plan-html` and the `rp` rich-mode loop — load `../plan-html/blocks.md` and `../plan-html/rich-mode.md` (plus `../plan-html/diagrams.md` for closure) as you enter each phase.

## Slug and storage

Layout owned by the **`project-docs`** skill — load it for the canonical layout, naming rules and conflict handling. The interview folder + state files (`plan.html`, `submission.json`, `state.json`, `.rp-url`) are defined there.

On invocation, pick a kebab-case slug from the topic (e.g. `auth-middleware-migration`). Output goes to `./docs/interviews/<slug>/`. **`state.json` is the only memory of resolved cells across rounds — never lose it.** Read it before generating any round; write it after merging every submission.

## Rules across phases

- If a question can be answered by exploring the codebase, explore — never ask the user something you can verify yourself.
- `state.json` is the source of truth between rounds. Always read it before generating a round.
- Skipped questions get re-worded, not repeated. If the same question is skipped twice in a row, drop it and apply the recommended answer with a `Verification` note flagging it as Claude-defaulted.
- Track resolved decisions internally as you go.
- If the user backtracks via `Re-open`, update only the affected cell — never restart the tree.
- **`change_kind` gates the question budget across all rounds, not just discovery.** If a grilling question would only make sense under a different `change_kind` (e.g. asking about a deprecation window when the plan is `additive-brownfield`), drop it. Don't smuggle retro-compat or migration concerns back in through the side door.

## Fallback

If `rp` is unavailable (no Node, no browser), fall back to the static `plan-html` output at `./docs/interviews/<slug>/plan.html` (same folder as rich mode — just no live server) and run the phases in chat (Discovery → Grilling → Closure). The HTML loop is the preferred path; the chat fallback is for environments that can't serve.
