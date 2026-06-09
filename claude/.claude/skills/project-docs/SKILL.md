---
name: project-docs
description: >-
  Owns the `docs/` layout for NextNode projects: folder structure, kind-based
  routing (interviews, plans, notes), slug/date naming rules. Load when
  bootstrapping `docs/`, placing an artifact, or auditing layout.
  User-invocable via `/project-docs`.
user-invocable: true
---

# project-docs

`docs/` is the only home for Claude-generated artifacts in a NextNode project. This skill is the single source of truth for the layout — `html` and `interview` reference it instead of redefining their own paths.

## Scope

- `docs/` lives at the **git root** of the project.
- Scratch perso hors-projet (notes personnelles, plans non liés à un repo) → poser ailleurs (`~/Desktop`, `~/Notes`, …), pas dans `docs/`.

## Layout

Four kinds. Folder name = plural. Add a new kind only when a real second exemplar of it shows up — not before.

| Kind | Path | Lifecycle | Producer |
|---|---|---|---|
| Interview workflow | `docs/interviews/<slug>/` | Folder · stateful · multi-round | `/interview` (rich mode via `rp`) |
| Implementation plan | `docs/plans/<YYYY-MM-DD>-<slug>.html` | Single file · static | `html` (after interview closure, or stand-alone) |
| Execution plan (machine) | `docs/plans/<slug>/plan.json` | Folder · static · sink-agnostic | `/backlog` (consumed by `/track` + `/next`) |
| Free-form note | `docs/notes/<YYYY-MM-DD>-<slug>.html` | Single file · static | `html` (any other recipe — audit, review, retro, research, status, board) or hand-written |

> `docs/plans/<slug>/plan.json` is the **machine-readable** backlog contract (`milestones[] → tracks[] → tasks[]`), distinct from the human-facing `<date>-<slug>.html` plan. The folder is keyed on slug (one live plan per slug) and is the durable input `/track` reads. See `/backlog` for the schema.

Folder lifecycle (`interviews/` only): stateful, multi-file — owned entirely by `/interview`, do not create or modify manually. Single-file lifecycle: one self-contained HTML, no state, no companion files.

## Naming

- **Slug** — kebab-case, ASCII, descriptive but short (`auth-middleware-migration`). No date in the slug.
- **Date prefix** (`YYYY-MM-DD-`) — required on every single-file **HTML** artifact (plans, notes).
- **No date prefix** — on `interviews/<slug>/` folders (one interview per topic) and on `plans/<slug>/plan.json` (one live execution plan per slug).
- **Conflicts** — if the slug+date combo already exists, ask before overwriting.

## Bootstrap

`mkdir -p docs/<kind>` only when actually writing an artifact. Don't pre-create folders.

## Interview → plan promotion

When `/interview` closes, **`/interview` is responsible** for copying the final `plan.html` to `docs/plans/<YYYY-MM-DD>-<slug>.html` so the plan is discoverable from the canonical location. `/html` does not perform this copy. The interview folder stays as historical state.

## Placement decision tree

1. Is it a stateful multi-round workflow? → `docs/interviews/<slug>/` (owned by `/interview`, do not create manually)
2. Is it a machine-readable backlog? → `docs/plans/<slug>/plan.json` (produced by `/backlog`)
3. Is it a human-readable HTML artifact? → interview promotion → `docs/plans/`, everything else → `docs/notes/`
4. None of the above? → not a `docs/` artifact; store outside the repo

## FORBIDDEN / CORRECT

| FORBIDDEN | CORRECT |
|---|---|
| `docs/plan/` (singular) | `docs/plans/` |
| `docs/plans/<slug>.plan.json` (flat file) | `docs/plans/<slug>/plan.json` (subfolder) |
| `docs/<slug>.html` (no kind folder) | `docs/plans/` or `docs/notes/` |
| Date in slug: `auth-migration-2026-05-15` | Slug timeless: `auth-migration`, date is the prefix |
| `state.json` outside `docs/interviews/<slug>/` | Stateful workflow → interview folder only |
| Inventing a new kind folder ad-hoc | Add a kind only when a real second exemplar exists |
| Creating `docs/interviews/<slug>/` manually | Owned by `/interview` — never create manually |

## Adding a new kind

Real second exemplar → add it to the table here. No parallel conventions, no per-skill folder invention.
