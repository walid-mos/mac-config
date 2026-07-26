# Publishing to Plane

All operations use the `plane` MCP tools. Nothing here runs before the user
has approved the breakdown.

## Workspace facts (verified 2026-07-25 — re-check with `get_features`)

| Project | identifier | id | epics | work_item_types |
| --- | --- | --- | --- | --- |
| core-infra | `INFRA` | `6d2f2481-08fd-4e7e-8805-24c1ad19176e` | off | off |
| mizraj | `MIZRAJ` | `5363c24c-81ad-4909-aeab-e5a89f82b7e6` | off | off |
| studiobymina | `MINA` | `4b5902bf-9e60-4895-857b-3a2bd92c189e` | on | on |
| stylot | `STYLOT` | `1810e847-5263-4d89-bee6-964831d577a8` | off | off |

Built-in dependencies (`blocking`, `blocked_by`, `start_before`,
`start_after`, `finish_before`, `finish_after`) are available on this
workspace. `list_work_item_relation_definitions` returns **HTTP 402** — do not
call it; use the built-in values directly. Custom relations that exist:
`relates to`, `duplicate`, `implements`, `implemented by`.

No project defines any label. States are the Plane defaults: Backlog
(default), Todo, In Progress, Done, Cancelled.

## 1. Resolve the epic representation

```
get_features(project_id)
```

- `epics: true` and `work_item_types: true` → epics are typed work items.
  `list_work_item_types(project_id)` and reuse the existing type named `Epic`
  for epics, and the existing non-epic type for tickets. Only if the type is
  missing: `resolve_work_item_type(project_id, "Epic")` — it finds or creates
  the type and makes it usable in the project.
- Either flag `false` → try `resolve_work_item_type(project_id, "Epic")`
  once. If it errors (402/403 — the feature is gated on this plan), fall back:
  the epic is a **plain work item** titled `[ÉPIQUE] <outcome>` with
  `priority: "urgent"`, and tickets hang off it via `parent`. Tell the user
  which representation you used, in one line.

Hierarchy is `parent` either way: every ticket sets `parent` to its epic's
UUID. That works on every plan.

## 2. Write the bodies as HTML

`description_html` is the only field that renders. Rules:

- Wrap the whole body in a single `<div>`.
- Section headings are `<h3>` — matches everything already on this workspace.
- Allowed: `<p>`, `<ul>`, `<li>`, `<strong>`, `<em>`, `<code>`, `<pre><code>`,
  `<a href>`.
- **No markdown.** `## Titre`, `- item`, `` `code` `` and `**gras**` render as
  literal text.
- Escape `&`, `<`, `>` inside prose and code: `&amp;`, `&lt;`, `&gt;`. A
  generic type or a shell redirect will otherwise eat the rest of the body.
- Do not pass `description_stripped` when you pass `description_html`; it is
  ignored.

## 3. Create, in dependency order

Epics first, then tickets, blockers before the tickets they block — a
ticket's `Bloquée par` section can only cite identifiers that already exist.

```
create_work_item(
  project_id,
  name="<outcome sentence>",
  type_id=<epic or ticket type, when types are on>,
  parent=<epic uuid, for tickets>,
  description_html="<div>…</div>",
  priority="urgent|high|medium|low|none",
)
```

Record, for every created item: `id`, `sequence_id`, title. The human-readable
identifier is `<PROJECT_IDENTIFIER>-<sequence_id>` (e.g. `MINA-42`) — that is
what goes in `Bloquée par` and what the user will quote back at you.

Leave `state` unset so items land in Backlog, unless the user asked
otherwise. Do not assign anyone. Do not set dates.

Priority: epics `urgent` when nothing ships without them, else `high`.
Tickets `high` for the critical path, `medium` by default, `low` for polish
and cleanup.

## 4. Set the blocking edges

After every ticket exists:

```
create_work_item_relation(
  project_id,
  work_item_id=<blocked ticket uuid>,
  work_item_ids=[<blocker uuid>, …],
  relation_type="blocked_by",
)
```

Then `update_work_item` on each blocked ticket to fill its `Bloquée par`
section with the real identifiers and titles. Both representations are
required: the edge drives the tracker's frontier, the text is what an
implementing agent actually reads.

If relation creation errors, keep the text and say the native edges could not
be set — do not retry in a loop.

## 5. Read back

- `list_work_items(project_id, pql='childOf("<EPIC-IDENTIFIER>")')` per epic —
  the count must match what you published.
- `retrieve_work_item` on two or three tickets with
  `fields="name,description_html,parent,priority"`; confirm the HTML renders
  as sections and not as literal markdown.
- `list_work_item_relations` on one blocked ticket; confirm `blocked_by`.

Report to the user: epic identifiers with their titles, ticket count per
epic, the frontier (tickets with no blockers, ready to pick up now), and
anything that degraded (representation fallback, missing edges).

## Labels

Optional and off by default — no project uses labels today. If the user wants
an agent-grabbable marker, `create_label(project_id, name="ready-for-agent")`
once, then pass its id in `labels` on each ticket. Ask before creating a label.

## Never

- Modify or close an existing epic or ticket that you did not create in this
  run, beyond the `Bloquée par` update pass on your own tickets.
- Paste a whole spec into a work item description — use `create_page` +
  `attach_page_to_work_item`.
- Create work items before the breakdown is approved.
