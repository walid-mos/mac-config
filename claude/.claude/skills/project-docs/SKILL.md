---
name: project-docs
description: >-
  Owns the `docs/` layout for NextNode projects: where each kind of artifact
  lives, slug/date naming rules, the contract other skills (`html`,
  `interview`) follow. Load when bootstrapping `docs/`, choosing a folder for an
  artifact, or auditing a layout. User-invocable via `/project-docs`.
user-invocable: true
---

# project-docs

`docs/` is the only home for Claude-generated artifacts in a NextNode project. This skill is the single source of truth for the layout — `html` and `interview` reference it instead of redefining their own paths.

## Scope

- `docs/` lives at the **git root** of the project.
- Scratch perso hors-projet (notes personnelles, plans non liés à un repo) → poser ailleurs (`~/Desktop`, `~/Notes`, …), pas dans `docs/`.

## Layout

Three kinds. Folder name = plural. Add a new kind only when a real second exemplar of it shows up — not before.

| Kind | Path | Lifecycle | Producer |
|---|---|---|---|
| Interview workflow | `docs/interviews/<slug>/` | Folder · stateful · multi-round | `/interview` (rich mode via `rp`) |
| Implementation plan | `docs/plans/<YYYY-MM-DD>-<slug>.html` | Single file · static | `html` (after interview closure, or stand-alone) |
| Free-form note | `docs/notes/<YYYY-MM-DD>-<slug>.html` | Single file · static | `html` (any other recipe — audit, review, retro, research, status, board) or hand-written |

Folder lifecycle (`interviews/` only) holds: `plan.html` (current round), `state.json` (cross-round memory), `submission.json` (latest user submission), `.rp-url` (transient, never commit). Single-file lifecycle: one self-contained HTML, no state, no companion files.

## Naming

- **Slug** — kebab-case, ASCII, descriptive but short (`auth-middleware-migration`). No date in the slug.
- **Date prefix** (`YYYY-MM-DD-`) — required on every single-file artifact.
- **No date prefix** — on `interviews/<slug>/` folders (one interview per topic).
- **Conflicts** — if the slug+date combo already exists, ask before overwriting.

## Bootstrap

`mkdir -p docs/<kind>` only when actually writing an artifact. Don't pre-create folders.

## Interview → plan promotion

When `/interview` closes, copy the final `plan.html` to `docs/plans/<YYYY-MM-DD>-<slug>.html` so the plan is discoverable from the canonical location. The interview folder stays as historical state.

## Anti-patterns

- Mixing pluriel/singulier (`docs/plan/` vs `docs/plans/`) — pluriel only.
- Date in a slug (`auth-migration-2026-05-15`) — date is the prefix, slug is timeless.
- A `state.json` outside `docs/interviews/<slug>/` — stateful workflow → folder.
- A file at `docs/<slug>.html` (no kind folder) — assign a kind.

## Adding a new kind

Real second exemplar → add it to the table here. No parallel conventions, no per-skill folder invention.
