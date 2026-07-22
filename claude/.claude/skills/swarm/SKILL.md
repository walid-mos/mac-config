---
name: swarm
description: >-
  Massively parallel multi-agent orchestration for exhaustive tasks (audit,
  review, recherche, migration) : fan-out maximal de subagents Sonnet pour la
  lecture/recherche, Opus pour le raisonnement et la vérification
  adversariale, Fable (boucle principale) comme orchestrateur et
  synthétiseur. Trigger on /swarm, "spawn un maximum de subagents",
  "audit exhaustif", "passe tout le code en revue avec des agents".
user-invocable: true
---

# Swarm — exhaustive multi-agent orchestration

When invoked, run the task with the Workflow tool at maximum useful
parallelism. The user has opted into multi-agent orchestration by invoking
this skill — do not ask for confirmation, launch.

## Role split (non-negotiable)

| Role | Model | Why |
|---|---|---|
| Orchestrator + final synthesis | **Fable (the main loop — you)** | Never delegate orchestration, dedup logic, or the final report. You write the workflow script, read the results, arbitrate, synthesize. |
| Reading / search / inventory | **sonnet** | One reader per scope unit. Cheap, fast, exhaustive. |
| Cross-cutting reasoning, specialist analysis | **opus**, `effort: 'max'` | Architecture rules, global dead-code, security, anything needing judgment across units. |
| Adversarial verification | **opus**, one agent per finding | Prompted to REFUTE, not confirm. |
| Any other subagent (role not listed above) | **opus**, `effort: 'xhigh'` | Fallback default. |

**Fable is reserved for the main loop.** No subagent ever runs on Fable —
never pass `model: 'fable'` to `agent()` and never omit `model` (omission
inherits the session model, i.e. Fable). Every `agent()` call sets `model`
explicitly: `sonnet` or `opus` per the table; if the role doesn't map to a
row, default to `model: 'opus', effort: 'xhigh'`.

## Pipeline (adapt phases to the task, keep the shape)

1. **Scout inline first** (you, Fable): `git ls-files`, count LOC, map the
   top-level structure. Partition the scope into units of ~20–90 files with
   zero overlap and 100 % coverage. Read the project's own rule documents
   (ARCHITECTURE.md, AGENTS.md, lint configs) yourself — you need them to
   judge findings at synthesis time.
   **Deterministic tools first**: before designing any agent, run the
   deterministic checks that answer part of the question outright —
   compiler (`tsc -b`, not a possibly-hollow `typecheck` script: verify
   the script actually checks files), linter, `grep`, build. Their green
   output removes entire question classes from agent prompts (e.g. "does
   this prop exist?" is answered by tsc, since .d.ts are its source).
   Spawn agents ONLY for what these tools cannot decide: runtime
   semantics, dead selectors/strings, doc-vs-code coherence, judgment.
2. **Phase Lecture** — one sonnet agent per unit, all in a single
   `parallel()`. Each prompt must include the STRICT RULES block below.
3. **Phase Analyse** — 1–3 opus specialists for cross-unit concerns the
   readers can't see (dependency directions, global dead code across
   packages, config vs code coherence). Run them in the same `parallel()`
   as the readers — no barrier between reading and analysis.
   **Litmus test per analyst**: state in one sentence what it finds that
   no deterministic tool can. No answer → delete the analyst. An agent
   that re-derives compiler/linter output (e.g. reading node_modules
   .d.ts to check prop existence) is redundant by construction: slower,
   costlier, less reliable than the tool.
4. **Dedup in plain code** (key = `file + title prefix`), never via an agent.
5. **Phase Vérification** — one opus adversarial verifier per deduped
   finding, all parallel. Drop anything not confirmed.
6. **Synthesis** (you, Fable): read the full result, re-check anything
   borderline yourself inline, write the deliverable. Report counts
   honestly: raw → deduped → confirmed → rejected, files read, agent
   failures.

## STRICT RULES block (embed verbatim-equivalent in every reader/analyst prompt)

- List your scope's files first (`git ls-files`), read ALL of them, report
  `filesRead` honestly.
- Report ONLY objective, verifiable problems: dead code (prove with
  repo-wide grep before asserting), tautologies, useless wrappers (only if
  they add nothing: no typing, no default, no used extension point), layer
  violations (the import must actually exist in the wrong direction),
  substantial duplication, real bugs, incoherences (doc/config contradicted
  by code).
- FORBIDDEN: style preferences, naming opinions, "could be improved",
  hypothetical problems.
- Every finding cites exact code and proof (e.g. "grep -r 'X' returns only
  the definition").
- Final answer is structured JSON via the schema, not a human message.

## Verifier prompt (per finding)

Give the verifier the finding (file, line, category, title, evidence) and
instruct: try to REFUTE it — reread the file, redo the greps, hunt for
usages the auditor missed (dynamic imports, re-exports, barrels, stories,
tests, config, framework conventions, front-side consumers of API
procedures). Subjective or hypothetical → `isReal=false`. In doubt →
`isReal=false`. Return `{isReal, reason, correctedEvidence?, severity}`.

## Workflow best practices

- `export const meta` with named phases matching `phase()` calls.
- JSON Schemas on every `agent()` call (`findings[]` with
  file/line/category/title/evidence/severity + `filesRead`;
  verdict schema for verifiers). Validation retries free you from parsing.
- `pipeline()` by default; a barrier (`parallel()` between stages) ONLY for
  the dedup step, which genuinely needs all findings at once.
- `.filter(Boolean)` on every parallel result; agents can die.
- `opts.phase` on every agent so progress groups correctly.
- Explicit `model` on every agent — see role split; Fable stays in the
  main loop only.
- Carry corrected evidence: confirmed finding = `{...finding, severity:
  verdict.severity ?? finding.severity, evidence: verdict.correctedEvidence
  ?? finding.evidence}`.
- Return `{confirmed, rejected}` — rejected findings with the refutation
  reason are part of the deliverable (they prove the filter worked).
- **Failure recovery**: on agent errors (connection closed, stall), do NOT
  shrug. Re-run the missing piece — resume the workflow from its runId, or
  redo it inline yourself if the spawn path is unavailable. When re-running
  a finder, list the already-known findings in its prompt so it doesn't
  repeat them.
- Read `journal.jsonl` in the transcript dir before diagnosing an empty or
  odd result.
- Scale = every unit covered + every finding independently verified, not a
  vanity agent count. If the task is small, a small swarm is correct.

## Deliverable

Synthesis in the chat (lead with the verdict, then findings by severity,
then rejected + remarks). If the user asked for persistence (/brain, HTML,
file), apply the corresponding skill on top.
