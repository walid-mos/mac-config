---
name: backlog
user-invocable: true
description: >-
  Turn a feature idea or an angle of attack into a published Plane backlog:
  relentless interview, then a spec, then epics and agent-executable tickets
  with real blocking edges. Trigger on /backlog, "transforme ça en tickets",
  "fais-moi les épiques", "mets ça dans Plane", "spec cette feature",
  "découpe cette feature en tickets", "construis le backlog".
---

# Backlog

One pass from a rough intent to a Plane backlog an autonomous agent can
implement without asking a human anything.

Four gates, in order. Do not skip forward, do not merge them.

1. **Orient** — resolve the target project, read the codebase, gather facts.
2. **Grill** — interview until every decision is closed. See [`grilling.md`](grilling.md).
3. **Spec** — write the PRD. See [`spec-template.md`](spec-template.md).
4. **Slice & publish** — epics + tickets, gated then written to Plane.
   See [`tickets.md`](tickets.md) and [`plane.md`](plane.md).

Nothing is written to Plane before the user approves the breakdown (gate 4).

## HTML deliverables

Gates 2–4 each ship an HTML document, never a wall of chat. **Load the
`html` skill first** and follow it (shapes, rich mode, D2/mermaid, build
script); [`deliverables.md`](deliverables.md) maps each gate to its document.
All files for one feature live in `docs/interviews/<feature-slug>/`:

- Gate 2 → `round-<n>.html` — rich-mode questionnaire per interview round,
  independent questions in parallel, recommendations pre-selected.
- Gate 3 → `spec.html` — the spec with its diagrams (states, data model, flows).
- Gate 4 → `breakdown.html` — rich-mode board: dependency graph, per-epic
  pages, agent-ready gate table, Approve/Reject gate.

Chat is for running commentary and one-off trivial questions only.

## 1. Orient

- **Resolve the target project.** `list_projects`, match the repo (directory
  name, `nextnode.toml`, git remote) against project `name`/`identifier`. If
  the match is not unambiguous, ask — one question, list the candidates.
- **Read the project's ground truth**: `CLAUDE.md`, `CONTEXT.md`,
  `PRODUCT.md`, `ARCHITECTURE.md`, ADRs under `docs/adr/`. Decisions already
  recorded in an ADR are **settled** — do not re-litigate them in the grill.
- **Explore the codebase for real.** Every file path, symbol, script, table
  and route you will later cite in a ticket must be something you *read this
  session*. Delegate breadth to `Explore` subagents when the surface is wide.
- **Check for prior art on the tracker**: `search_work_items` on the feature's
  key nouns. If epics or tickets already cover part of it, say so and decide
  with the user: extend the existing epic, or open a new one.
- **Load the applicable judgment skills** for the stack you are about to spec
  (`coding`, `typescript`, `react`, `cloudflare-cost`, `nextnode-*`) — their
  constraints shape the implementation decisions, and a ticket that violates
  them is not agent-ready.

Facts are looked up, never asked. Decisions are asked, never assumed.

## 2. Grill

Run the interview in [`grilling.md`](grilling.md) until the user confirms
shared understanding. This is the stage that makes the rest possible: a
ticket cannot be autonomous if a decision inside it is still open.

Exit condition: **zero open decisions in the area being specced.** Anything
genuinely undecidable now goes to *Hors périmètre* in the spec, never into a
ticket as "à trancher".

## 3. Spec

Write the spec per [`spec-template.md`](spec-template.md), in the language of
the project's existing tracker content (French for every current project).
Use the project's domain vocabulary verbatim — its words, not synonyms.

Render it as `spec.html` (see [`deliverables.md`](deliverables.md)), open it,
get approval. Do not publish it yet.

## 4. Slice & publish

- Decompose the spec into **epics** (each an outcome that delivers standalone
  value) and, under each, **tickets** — vertical tracer-bullet slices. Rules
  and templates: [`tickets.md`](tickets.md).
- Run the **agent-ready gate** in [`tickets.md`](tickets.md) against every
  ticket. A ticket that fails any check does not get published — fix it or
  send its open question back to gate 2.
- Present the breakdown as `breakdown.html` (see
  [`deliverables.md`](deliverables.md)): dependency graph, tickets per epic,
  gate results, and the per-ticket questions (granularity, blocking edges,
  merge/split) as rich-mode forms. Iterate until the gate returns approved.
- Publish per [`plane.md`](plane.md): epics first, then tickets in dependency
  order, then the `blocked_by` edges, then read back what you wrote.

## Non-negotiables

- **No write to Plane without explicit approval of the breakdown.** Reading
  the tracker is free; creating 40 work items is not undoable in one call.
- **A ticket never contains an open question.** No "à trancher", no "TBD", no
  "à voir avec". If it survived to the ticket, it was decided.
- **A ticket cites nothing unverified.** Paths, exports, scripts, columns,
  routes: read them, or state that this ticket creates them.
- **A ticket is self-contained.** Assume the implementing agent has a fresh
  context window, this ticket's body, and the repo. Nothing else. Repeat the
  vocabulary and decisions it needs instead of pointing at the epic.
- **Traps are part of the deliverable.** Every footgun you hit while
  exploring goes in *Pièges* — that is the difference between a ticket an
  agent completes and one it breaks.
- **Never close or restructure existing epics** as a side effect.

## Sources

Merged and adapted from `mattpocock/skills`: `to-spec`, `to-tickets`,
`grilling` (MIT). Departures from upstream, deliberate:

- The interview runs **before** the spec — upstream `to-spec` explicitly does
  not interview.
- Upstream forbids file paths in tickets ("they go stale"). We require them,
  with a verification date, because they are what makes a ticket executable
  by an agent. Staleness is handled by re-verifying at pickup, not by vagueness.
- Ticket bodies follow this workspace's established French HTML house style,
  not the upstream markdown template.
