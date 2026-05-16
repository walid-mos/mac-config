# Closure (round final)

Closure is **not** "I think it's resolved." It is a mechanical completeness check against a fixed six-field schema, applied to every decision. The goal is **zero interpretation downstream** — a dev (or `/backlog`, or a future Claude) reads the output and implements without asking a single question.

## 1. The six-field schema

| Field | What it must contain |
|---|---|
| **Fact** | The decision, stated as a non-hedged sentence. No "we could", no "maybe", no "probably". |
| **Mechanism** | What concretely materializes the fact. The form depends on the plan type — but it is always concrete: a file/function/pipeline step (infra, refacto), a route + component + endpoint (feature), a stack + reference structure (greenfield), an actor + artifact + cadence (process/org), a script + window + rollback (data migration), etc. "We will add X" is **not** a mechanism — *how* X arrives in production, in the codebase, in the team's workflow is. |
| **Edge** | What this touches and what it explicitly does **not** touch. Scope made surgical. |
| **Rejected** | Each alternative considered, with the one-sentence reason it was discarded. |
| **Order** | What must exist before this decision can be applied. Dependencies, prerequisites, blocking work. |
| **Verification** | How an outside observer confirms the decision is realized. A command output, a metric, an acceptance criterion, a deliverable artifact — something *checkable*, not "it works". |

## 2. Render the closure HTML

Generate `plan.html` with the `Interview · closure` recipe (`header` + `decisions` + `risk-grid` + `open-questions`* + `next-steps`). For the `decisions` block UX contract (compact sidebar with scrollspy, decisions-as-sections, collapse-by-default with fact-preview, per-decision afterthought textarea), see `../plan-html/blocks.md`. For the per-decision diagram primitives, see `../plan-html/diagrams.md`. Every `decisions` card carries the six fields, each editable in place.

Serve via `rp <slug>` and relay the URL in chat — protocol in `../plan-html/rich-mode.md`. Read `submission.json`:

```json
{
  "decisions": {
    "<decision-id>": {
      "fact": "...", "mechanism": "...", "edge": "...",
      "rejected": "...", "order": "...", "verification": "..."
    }
  },
  "edits": { ... },
  "comments": [{ "target": "...", "body": "..." }],
  "freeform": "..."
}
```

## 3. Verify completeness

After the closure submission, re-check that no cell is empty or hand-wavy. **A blank or vague cell sends you back to `grilling.md`** with a single-cell round targeting only that gap. Examples:

- Mechanism empty → ask only: "by what concrete artifact / pipeline / file does this decision arrive in production?"
- Verification vague ("it works") → ask only: "what is the literal check that proves it?"
- Rejected empty → ask only: "what alternatives did we consider and why did we drop them?"

When every cell on every row is concrete, the interview is complete.

## 4. Process afterthought comments

The closure page exposes a per-decision afterthought textarea (see the `decisions` block in `../plan-html/blocks.md`). On submit, those land in `submission.json` as:

```json
"comments": [{ "target": "<decision-id>", "body": "<user's note>" }]
```

For each comment:

1. Print the decision title + the note in chat so the user sees you read it.
2. Decide: is it a **question** (answer in chat, no plan change), a **proposed plan update** (rewrite the relevant cell(s) + re-run closure with the updated decision), or a **doubt** that warrants reopening that branch (single-question grilling round)?
3. After processing all comments, regenerate `plan.html` (overwriting the updated cells) and serve it again via `rp <slug>` so the user validates the new state. Loop until `comments` is empty on submit.

Never silently drop a comment. Every afterthought is either resolved in chat, applied to the plan, or sent back through grilling — but always acknowledged.

## 5. Promote and emit backlog bundle

Once the closure is final (no blank cells, no unresolved afterthoughts), do **two** things in order.

### 5.a Copy the plan to `docs/plans/`

```
mkdir -p docs/plans
cp docs/interviews/<slug>/plan.html docs/plans/<YYYY-MM-DD>-<slug>.html
```

The interview folder stays in place as historical state (rounds, submissions, `state.json`). The copy in `docs/plans/` is the authoritative implementation plan — that's what code reviews and future readers look at.

### 5.b Emit `backlog-bundle.json`

Pure transformation of `state.json` — no UI, no extra round. The bundle is the **canonical handoff** to `/backlog`. It carries the Decisions verbatim plus the metadata `/backlog` needs to skip its own discovery. **No phases, no tasks** — that's `/backlog`'s job, not the interview's.

Write to:

```
docs/interviews/<slug>/backlog-bundle.json
```

Schema (JSON, one decision per object — `schema_version: "1"` is required, `/backlog` refuses unknown versions):

```json
{
  "schema_version": "1",
  "source": {
    "kind": "interview",
    "slug": "<slug>",
    "change_kind": "<from state.json>"
  },
  "target": {
    "linear_project_hint": "<best match from Decisions — empty string if unsure>",
    "linear_team_hint": "<INT | SAS | CLI | empty string>",
    "repo_path_hint": "<packages/X | apps/Y | empty string>"
  },
  "decisions": [
    {
      "id": "D1",
      "theme": "<from state.json>",
      "fact": "...",
      "mechanism": "...",
      "edge": "...",
      "rejected": "...",
      "order": "...",
      "verification": "..."
    }
  ],
  "open_facts": {
    "<lower_snake_key>": "<value>"
  },
  "freeform": "<state.json freeform if any>"
}
```

**Filling `target`** — scan the resolved Decisions for concrete repo/package mentions:

- Mentions `packages/<x>` or `core/packages/<x>` → `repo_path_hint = "packages/<x>"`, `linear_project_hint = "NextNode <X>"`, `linear_team_hint = "INT"`.
- Mentions a product (YSumAI, Kicked, Adiffi, NextNode Landing) → matching SAS project, `linear_team_hint = "SAS"`.
- Mentions infra / deploy / CI / Hetzner / Cloudflare → `linear_project_hint = "NextNode Infrastructure"`, `linear_team_hint = "INT"`.
- If genuinely ambiguous, leave the fields as empty strings — `/backlog` falls back to asking.

**Filling `open_facts`** — capture facts surfaced during the interview that don't belong inside a Decision card. Typical entries: `apps_to_migrate: ["monitoring", "kicked"]`, `registry: "ghcr.io/nextnodesolutions"`, `reserved_names_source: "SERVICE_DEFINITIONS"`. Free-form key/value, lower-snake-case keys. Omit the key entirely if nothing matches.

After writing, confirm in chat with a one-line summary including both artifacts:

```
Plan: docs/plans/<YYYY-MM-DD>-<slug>.html
Bundle: docs/interviews/<slug>/backlog-bundle.json (N decisions)
```

The legacy markdown paste path (from the `next-steps` "Copy as backlog prompt" button) stays accepted by `/backlog` for plans with no interview origin — but for any closure produced here, the bundle is the canonical handoff.
