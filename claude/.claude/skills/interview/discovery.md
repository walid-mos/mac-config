# Discovery (round 0)

Restate the user's plan in one paragraph in chat — short, confirms you parsed it. Then explore the codebase (parallel `Explore` subagents if the surface is non-trivial).

## 1. Classify the change (mandatory, before enumerating branches)

Based on the exploration — never by asking the user — pick exactly one category and record it in `state.json` as `change_kind`:

| Category | Trigger |
|---|---|
| `greenfield` | New project, new package, or new isolated module with no existing consumers. |
| `additive-brownfield` | Adds new files / routes / components / exports to an existing codebase **without modifying any externally-observable contract** (public API, exported package symbol, persisted schema, user-facing URL, deployed config). |
| `breaking-brownfield` | Modifies an existing externally-observable contract in a non-backward-compatible way. |
| `migration-or-data-move` | Moves, reshapes, or backfills persisted data, or migrates infrastructure / runtime. |

This category gates which branch families are eligible (see §3). If you genuinely cannot tell from exploration, default to `additive-brownfield` — most common, least noisy.

## 2. Enumerate decision branches

Generate the candidate branches you see from exploration. Each branch carries title, one-sentence description, "matters because" line, and in-scope/out-of-scope toggle.

## 3. Pre-prune by category (default scope)

When rendering the discovery HTML, **pre-set the `scope` toggle** of each branch based on `change_kind`:

- Branches about **backward compatibility, deprecation, API versioning, feature flags for rollback, or coexistence with the old behavior** → pre-set `scope: "out"` unless `change_kind` is `breaking-brownfield`.
- Branches about **data migration, backfill, schema evolution, rollback windows** → pre-set `scope: "out"` unless `change_kind` is `breaking-brownfield` or `migration-or-data-move`.
- All other branches → pre-set `scope: "in"` by default.

The user can flip a branch back to IN via the toggle — pre-pruning only changes the default, not the option. Never silently omit a branch you considered; render it with `scope: "out"` so the user sees you considered it.

## 4. Render

Generate `plan.html` with the `Interview · discovery` recipe (`header` + `context` + `branches-tree`). For the `branches-tree` UX contract (theme grouping, sticky filter bar, collapse-by-default, out-of-scope visual mute, etc.), see `../plan-html/blocks.md`. The `context` block must surface `change_kind` so the user sees the classification you applied. Include a `+ Ajouter une branche` affordance.

Serve via `rp <slug>` and relay the URL in chat — protocol in `../plan-html/rich-mode.md`. Read `submission.json`:

```json
{
  "change_kind": "...",
  "branches": [
    { "id": "...", "title": "...", "description": "...", "matters": "...", "scope": "in"|"out" }
  ],
  "freeform": "..."
}
```

Write `change_kind` and the confirmed in-scope branches to `state.json`. Out-of-scope branches are recorded but not grilled. If the user flipped any pre-pruned branch back to IN, treat it as a normal in-scope branch — no penalty.
