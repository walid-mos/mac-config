# backlog-bundle.json schema

`schema_version: "1"` is required — `/backlog` refuses unknown versions.

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
  "demo_spine": [
    "<observable behavior 1 — milestone-level checkpoint, derived from decisions[].verification>",
    "<observable behavior 2>",
    "..."
  ],
  "open_facts": {
    "<lower_snake_key>": "<value>"
  },
  "freeform": "<state.json freeform if any>"
}
```

## Field notes

**`decisions`** — one object per resolved decision, verbatim from `state.json`. The six-field schema (fact/mechanism/edge/rejected/order/verification) must be fully populated — no blank cells.

**`demo_spine`** — ordered list of observable behaviors that prove the plan is shipped. Derived from the `verification` fields across all decisions, deduplicated and sequenced in milestone order. One entry per milestone-level checkpoint. `/backlog` uses this to seed its walking-skeleton ordering when producing `plan.json`. Omit only if there are zero resolved decisions (empty interview).

**`target`** filling rules:
- Mentions `packages/<x>` or `core/packages/<x>` → `repo_path_hint = "packages/<x>"`, `linear_project_hint = "NextNode <X>"`, `linear_team_hint = "INT"`.
- Mentions a product (YSumAI, Kicked, Adiffi, NextNode Landing) → matching SAS project, `linear_team_hint = "SAS"`.
- Mentions infra / deploy / CI / Hetzner / Cloudflare → `linear_project_hint = "NextNode Infrastructure"`, `linear_team_hint = "INT"`.
- If genuinely ambiguous, leave the fields as empty strings — `/backlog` falls back to asking.

**`open_facts`** — facts surfaced during the interview that don't belong inside a Decision card. Typical entries: `apps_to_migrate: ["monitoring", "kicked"]`, `registry: "ghcr.io/nextnodesolutions"`. Free-form key/value, lower-snake-case keys. Omit the key entirely if nothing matches.
