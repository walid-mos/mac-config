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

All three phases use blocks from `html` and the `rp` rich-mode loop — load `../html/blocks.md` and `../html/rich-mode.md` (plus `../html/diagrams.md` for closure) as you enter each phase.

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
- **No side questions in chat — ever.** The chat is for short framing and relaying the `rp` URL. If anything else surfaces mid-interview — a tangent decision, an "should I also do X?" thought, a problem you noticed while exploring, an off-tree concern — it goes **in the HTML**, never in chat. Concretely:
  - **In-scope side decision** → add a branch to discovery (round 0 re-render) or a question to the next grilling round. Never ask it as a one-off in chat.
  - **Out-of-scope side decision** → render it in the closure `open-questions` block with a recommended action, or as a `next-steps` item. The user resolves it in the HTML or marks it deferred.
  - **Blocking problem you found** → surface it as a `risk-grid` row in the current round's HTML with the proposed mitigation, not as a chat interruption.
  - **Binary "go / wait" prompts** ("Go for closure?", "Should I proceed?", "Continue?") are banned. Generate the next round; the user pacing is driven by their HTML submission, not by chat confirmations.
  - The only allowed chat outputs between rounds are: the one-paragraph plan restatement (discovery), the `rp` URL, a short summary after merging a submission, and tool output. Anything else belongs in the HTML.

## Fallback

If `rp` is unavailable (no Node, no browser), fall back to the static `html` output at `./docs/interviews/<slug>/plan.html` (same folder as rich mode — just no live server) and run the phases in chat (Discovery → Grilling → Closure). The HTML loop is the preferred path; the chat fallback is for environments that can't serve.
