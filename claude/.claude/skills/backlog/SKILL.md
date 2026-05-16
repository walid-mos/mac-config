---
name: backlog
description: >-
  Build a Linear backlog from a plan that emerged from a Claude ↔ user
  discussion. Splits the plan into atomic issues organized by phase,
  generates a tasks.json bundle, then runs a bundled idempotent Python
  worker DETACHED so the conversation does not burn tokens waiting on N
  HTTP round-trips. Load when the user wants to turn a plan, design doc,
  audit, or roadmap into a Linear backlog of actionable issues -
  typically right after a planning conversation.
user-invocable: true
argument-hint: "[path to plan file]"
---

# backlog

This skill complements `/nextnode-linear` - it APPLIES those conventions (atomicity, `[P{N}-{step}]` phase prefix, project mapping, detached execution) to the specific workflow of "plan → backlog".

## Arguments

- `$ARGUMENTS` (optional) - path to a plan file. If omitted, use the plan from the current conversation context.

## Workflow

Execute the phases below in order. Stop and confirm with the user between Phase 4 and Phase 5 - never push to Linear without an explicit go.

### Phase 1 - Load context

1. **Read `/nextnode-linear` workspace map** (`~/.stow_repository/claude/.claude/skills/nextnode-linear/workspace.md`) to know team IDs, project IDs, and naming conventions.
2. **Load the plan**. Three input shapes, in order of preference:
   - **a. Backlog bundle** (`backlog-bundle.json`) — canonical handoff from `/interview` § 5.b. Detection: `$ARGUMENTS` points at a file ending in `backlog-bundle.json`, OR at a `docs/interviews/<slug>/` folder that contains one, OR (no `$ARGUMENTS`) the most recent `docs/interviews/*/backlog-bundle.json` modified in this conversation. Parse it as JSON. Refuse if `schema_version != "1"`. Keep the parsed bundle in memory — it drives the rest of the phases (project hint, decisions, decision_refs, enrichment).
   - **b. Plan file** — if `$ARGUMENTS` is any other file path → `Read` it.
   - **c. Conversation context** — otherwise use the planning thread already in context (the user's previous turn, the latest large markdown the assistant produced, etc.).
3. **Verify `LINEAR_API_KEY`** is set: `test -n "$LINEAR_API_KEY"`. If not, REFUSE and tell the user to set it (see `/nextnode-linear api`).

### Phase 2 - Identify the target project

**If a bundle was loaded in Phase 1** and `target.linear_project_hint` is non-empty: resolve it directly against `workspace.md` (the bundle has already done the matching during `/interview` § 5.b). Skip the heuristics below. If the hint resolves cleanly, proceed silently; if it doesn't match any known project, fall back to asking via `AskUserQuestion`.

Otherwise (no bundle, or empty hint), match the plan's subject to a Linear project from `workspace.md`:

- Plan mentions `core/packages/<x>` → the matching `NextNode <X>` project (INT team).
- Plan mentions a product name (YSumAI, Kicked, Adiffi, NextNode Landing) → the SAS project of that name.
- Plan mentions a client → the CLI project.
- Plan covers infra/deploy/CI/Hetzner/Cloudflare → `NextNode Infrastructure`.
- Plan is multi-repo → ask the user; we likely need an Initiative (out of scope here, redirect to `/nextnode-linear`).

If ambiguous, load `AskUserQuestion` via `ToolSearch query="select:AskUserQuestion"` and ask the user to pick the project from the candidate list.

Resolve and remember:
- `projectId` (UUID from workspace.md)
- `teamId` (UUID from workspace.md, derived from the project's team)
- A short slug for the temp directory, e.g. `infra`, `monitoring`.

### Phase 3 - Break the plan into phases + atomic tasks

**Two-pass generation.** Phase 3 is structured as: Pass 1 = explosion (rules 1–7 below produce a draft that is intentionally too fine — every artifact, every method, every table, every UI state gets its own candidate task). Pass 2 = conditional merge in Phase 3.3 (atomicity audit). The default bias is **more tasks, not fewer** — merging requires explicit justification. A skill that produces N tasks where the bundle's Mechanism cells imply ~M atoms and N < M without flagging it is buggy. If you catch yourself consolidating because the list "feels too long", stop and let Phase 3.3 do the merging on explicit conditions.

Apply `/nextnode-linear` Rule 2 (atomicity) and Rule 3 (phase naming) ruthlessly:

1. **Identify phases** from the plan's structure. The plan often labels them itself (`Phase A/B/C/D`, `Étape 1/2/3`, `1./2./3.`, an explicit table). Use those when present. Otherwise group tasks by dependency boundaries.
2. **Number phases starting at 1** (reserve `0` for setup/scaffolding tasks that pre-exist or are foundational and not in the plan itself). Phase numbers are integers.
3. **Each task = one commit. Each phase = one PR.** A task is the unit of an atomic commit (single logical change, one artifact-scoped diff); a phase aggregates the tasks that ship together as a single reviewable PR. No `and` / `et` / `+` / `puis` / `,` in titles. If the plan describes "do X and Y", split into 2 tasks (= 2 commits). If a task covers more than one logical change or its `WHERE` scope implies >300 changed lines, split it further.
4. **Phase boundaries are dictated by parallelization, not size.** No min/max task count per phase — a phase can hold 3 tasks or 50, both are fine. The only reason to split a phase is to **enable parallel execution**: if two groups of tasks within the same phase have no dependency between them, split them into two phases so they can ship as two parallel PRs. Conversely, tasks that MUST run sequentially (same migration chain, same dependency layer, output of one feeds input of the next) belong in the same phase. Grouping signal: a dependency edge between tasks → same phase ; no edge → candidate split for parallelization.
5. **Title format**: titles are short imperative sentences, NO `[P{N}-{step}]` prefix in the JSON - the worker script adds it automatically based on phase number + task index.
   - GOOD: `Add port allocator state to R2`
   - BAD: `[P1-01] Add port allocator state to R2` (worker adds the prefix)
   - BAD: `Implement port allocation and persistence` (two concepts → split)
6. **Description** is mandatory and self-contained:
   - WHAT to do (one sentence)
   - WHY (one sentence linking to the plan's reasoning)
   - WHERE in the codebase (file paths if known)
   - DONE WHEN (acceptance criteria, ≤ 3 bullets)

Quoting / formatting in description: plain markdown is fine, Linear renders it. Avoid HTML, avoid raw URLs without anchor text.

7. **Bundle-sourced backlogs MUST carry `decision_refs[]` on every task.** If Phase 1 loaded a `backlog-bundle.json`:
   - Every generated task carries a `decision_refs: ["D1", "D2", ...]` field referencing the Decisions it realizes — **at least one ref** (exception: plumbing tasks generated in Phase 3.2 carry `decision_refs: []` AND `theme: "plumbing"`; demo-path tasks generated in Phase 3.1 carry `theme: "demo-path"` and the refs of the chain they reproduce). The refs are appended to the description as a footer line (`_Decision refs_: D1, D2`) so they show up in Linear; the JSON field stays for the coverage check.
   - **Forward coverage** — every Decision must produce tasks: compute `uncovered = {D.id for D in bundle.decisions} − ⋃(t.decision_refs for t in all_tasks)`. If non-empty, abort and list which Decisions have no implementation path. **Never proceed to Phase 4 with uncovered Decisions** — a Decision with no task is dead architecture rationale.
   - **Reverse coverage 1 — Mechanism artifacts** (extracted in Phase 3.1): every concrete artifact extracted from a `Decision.mechanism` must appear in at least one task's `WHERE` or `DONE WHEN`. Uncovered artifacts block Phase 4.
   - **Reverse coverage 2 — Verification chains**: every `Decision.verification` containing a sequence (`→`, `puis`, "ensuite", "à la fin", ≥3 ordered steps) must have at least one task with `theme: "demo-path"` reproducing the full chain. Missing demo paths block Phase 4.
   - **Reverse coverage 3 — Tasks-per-Decision floor**: for each Decision, `tasks_count_covering_D ≥ ceil(decision.atoms_count × 1.3)` (atoms count from Phase 3.1). Decisions below the floor must be split further, or the deviation justified in chat ("D5 has 3 atoms sharing one file, merging confirmed — 1 task").
   - **Orphans**: tasks with empty `decision_refs` AND no `theme: "plumbing"` are orphans. Drop them or attach to a Decision. Orphans block Phase 4.
   - **Phase grouping defaults to topological order from `Decision.order`**: parse the prose of each Decision's Order cell, identify prerequisites, and group Decisions sharing a dependency layer into the same phase. Decisions with no prerequisite → phase 1.

For plain-text plans (no bundle), `decision_refs` is omitted and the coverage checks do not apply — the other Phase 3 rules stay unchanged.

### Phase 3.1 - Mechanism decomposition (bundle-sourced only)

**Skip this phase entirely if no bundle was loaded in Phase 1** — plain-text plans have no structured Mechanism cell to parse.

This is the heart of Pass 1 (explosion). For each Decision in the bundle:

1. **Parse `mechanism` into atoms**. Identify each of these as one atom:
   - Enumerated items: `(a)`, `(b)`, `(c)` ; `1.`, `2.`, `3.` ; bullets ; comma-joined verb phrases in series.
   - Concrete artifacts: file paths, function names, types, tables, refs, commands, env vars, API endpoints, UI components, IPC handlers.
   - Architectural layers touched: UI / IPC / backend / persistence / VCS / CI — each distinct layer counts as one atom (a Decision spanning UI + backend has ≥2 layer-atoms).
   Record per Decision: `decision.atoms = [{key: "a", desc: "bouton Run agent qui spawn Claude Code"}, {key: "b", desc: "commit-snapshot ref refs/agent-cockpit/sessions/<id>"}, ...]`. Keep this list in memory — Phase 3 rule 7 (reverse coverage 1 + 3) and Phase 4 preview read it.

2. **Compute the target task count** for each Decision: `target = ceil(len(atoms) × 1.3)` (round up). This is the **floor**. Generating fewer tasks than `target` requires explicit justification in chat before Phase 4 (e.g. "D5 has 3 atoms but they share `schema.sql` and one migration — confirmed merge to 1 task").

3. **Generate ≥1 candidate task per atom** (explosion). Each atom maps to at least one task whose `WHERE` cites the atom's concrete artifact and whose `DONE WHEN` is verifiable on that artifact alone. Do **not** merge here — merging happens in Phase 3.3 on explicit conditions.

4. **Generate a `theme: "demo-path"` task** when `Decision.verification` describes an end-to-end chain of ≥3 ordered steps (regex hints: `→`, `puis`, "ensuite", "à la fin", numbered steps). One task reproduces the full chain — its `DONE WHEN` is the literal verification clause. This task carries the Decision's refs.

5. **Tag scope hints**. If `Decision.edge` or `Decision.order` contains "V2", "post-MVP", "future", "vNext", or "hors V1", mark each task derived from that Decision with `scope: "vnext"` in the JSON (default is `scope: "mvp"` and the field can be omitted). The Phase 4 preview shows the mvp/vnext split so the user can decide what to push now vs park.

### Phase 3.2 - Cross-cutting plumbing checklist

**Mandatory when `bundle.source.change_kind == "greenfield"`. Recommended when the change touches a user-facing surface in an existing project.**

The Decisions cover the architectural CORE choices but inevitably miss generic plumbing every shippable artifact needs. These concerns are almost never mentioned in a Mechanism cell — generate them here, explicitly.

Generated tasks carry `decision_refs: []` and `theme: "plumbing"`. They are **exempt from forward coverage** (Phase 3 rule 7) but contribute to total task count and to the histogram.

**Greenfield desktop / web app (Tauri, Electron, Vite SPA, Next.js):**

- App identity: bundle id, app icon, window title / default size / min size.
- IPC type bindings (specta, ts-rs, trpc — match the stack). Without this every `invoke()` is `any`.
- Settings panel + persistence (theme, last project, user prefs).
- Logging — one task for the backend runtime (Rust/Node), one for the frontend if applicable.
- Global error boundary (React/Vue) + crash reporter or log surface.
- Empty / loading / error states for each major view (1 task per view).
- Cancel / stop UI for any operation > 1s (long-running agents, file scans, network calls).
- User input surfaces: prompt input, file picker, project picker, command palette — pick whichever apply.
- Distribution if user-facing binary: code signing, notarization (macOS), auto-updater config — 1 task each.

**Greenfield server / CLI / worker:**

- Config loader + validation (zod, serde, envalid — match the stack).
- Structured logging with levels and request IDs.
- Graceful shutdown (signal handling, in-flight request drain).
- Health endpoint or `--version` flag.
- CI smoke: lint stage, test stage, build stage — separate tasks.

**Feature work in an existing project:**

- Integration test on the golden path (one happy-path E2E).
- Data migration with rollback (if schema or persistent state touched).
- Feature flag or kill-switch (if user-facing).
- User-facing documentation update (if UI touched).

Skip a concern only if it is **demonstrably** covered by an existing Decision — note the mapping in chat ("App identity → D3 already specifies bundle id"). Never skip silently.

### Phase 3.3 - Per-task atomicity audit (Pass 2 = conditional merge)

This is Pass 2 of the two-pass generation. Take the candidate task list from Phases 3 + 3.1 + 3.2 and run the audit below on each task. Default action: **keep separate**. Merging requires all conditions to be met simultaneously.

**Reject patterns — split before Phase 4:**

Title checks (regex/keyword):

- Concrete plural: `tables`, `methods`, `commands`, `views`, `routes`, `endpoints`, `migrations`, `functions`, `tests`, `flags`, `panels`, `pages` → split per item.
- Count token: `3 functions`, `4 tables`, `the 5 endpoints`, `all N <thing>` → split into N tasks.

Description checks:

- `WHERE` cites > 3 distinct files → split per file or per coherent cluster.
- `DONE WHEN` has > 3 bullets → at least one bullet is a hidden task → extract.
- Estimated LOC > 300 based on `WHERE` scope → split.

**Forbidden batching patterns** (explicit, hard reject — no exceptions outside `theme: "demo-path"`):

- "Create all N tables" → 1 task per table.
- "Implement `<Trait>` trait" where the trait has > 2 methods → 1 task per method, or per coherent pair (≤2 methods sharing the same private helper).
- "Setup CI" → 1 task per stage (lint, test, build, release, sign, notarize).
- "Add error handling" → 1 task per error boundary.
- "Implement `<feature>` end-to-end" → except for `theme: "demo-path"` tasks, this signals missing decomposition — refuse and ask Phase 3.1 to re-explode the source Decision.

**Merge conditions — ALL must hold to merge two or more candidate tasks:**

- Same file in `WHERE` for every merge candidate.
- Same conceptual surface (CRUD on same type, reads/writes of same table, public API of same module).
- Combined LOC estimate < 100.
- The merged tasks would be covered by the same test (one test asserts the merged outcome).

If any condition fails, **keep separate**. When in doubt, the skill must produce more tasks rather than fewer — under-decomposition is the failure mode this audit fixes.

### Phase 3.5 - Codebase enrichment per phase (bundle-sourced only)

**Skip this phase entirely if no bundle was loaded in Phase 1** — plain-text plans don't have the structured input to enrich reliably, and the cost-benefit is poor.

For each phase produced in Phase 3:

1. **Compute the phase surface** = union of all `WHERE` paths mentioned by the phase's tasks + the `Mechanism` and `Edge` cells of the Decisions covered by the phase (look them up by `decision_refs` → `bundle.decisions`).

2. **Launch one `Explore` agent** for that phase via the `Agent` tool (`subagent_type: "Explore"`, search breadth: `medium`). Prompt template:

   ```
   You are scoping codebase context for Phase <N>: <phase name>.
   Change kind: <bundle.source.change_kind>.
   Surface (files / packages the phase touches):
     - <path1>
     - <path2>
     ...
   Decisions covered by this phase:
     - D<i> — fact: "<fact>" — mechanism: "<mechanism>" — edge: "<edge>"
     ...

   Find, within that surface only:
   - Reuse pointers — existing functions / types / modules the phase should
     EXTEND rather than duplicate. Format per entry: { symbol, path:line, why }.
   - Patterns to follow — sibling files / modules implementing the same kind
     of work, so the new code stays consistent. Format: { pattern, path:line, why }.
   - Traps to avoid — anti-patterns, deprecated paths, ADR notes, comments
     saying "don't do X here". Format: { trap, path:line, why }.
   - Test scaffolding — fixture helpers, test utils, existing fixture files
     relevant to the surface. Format: { helper, path:line, why }.

   Cap at ≤5 entries per section. Skip a section entirely if nothing matches.
   Return compact JSON only — no prose.
   ```

3. **Persist the dossier** to `/tmp/claude/backlog-<slug>-<ts>/phase-contexts/phase-<N>-<kebab-name>.md` as a readable markdown file. Layout:

   ```markdown
   # Phase <N> — <name>
   # Decisions: <D1, D2, …>
   # Surface: <comma-separated paths>

   ## Reuse
   - `<symbol>` @ `<path:line>` — <why>

   ## Follow pattern
   - <pattern> @ `<path:line>` — <why>

   ## Avoid
   - <trap> @ `<path:line>` — <why>

   ## Test scaffolding
   - `<helper>` @ `<path:line>` — <why>
   ```

   Omit any section that has no entries.

4. **Inject into task descriptions**. For each task in the phase, pick the dossier entries that match its specific `WHERE` paths or `decision_refs` and append four optional sections to the description (omit any section with no matches):

   ```markdown
   **Reuse**:
   - `<symbol>` @ `<path:line>` — <why>

   **Follow pattern**:
   - <pattern> @ `<path:line>` — <why>

   **Avoid**:
   - <trap> @ `<path:line>` — <why>

   **Test scaffolding**:
   - `<helper>` @ `<path:line>` — <why>
   ```

5. **Reference the dossier** at the bottom of the task description so the implementing agent can read the shared context:

   ```
   _Phase context_: `/tmp/claude/backlog-<slug>-<ts>/phase-contexts/phase-<N>-<name>.md`
   ```

**Skip enrichment** for trivial tasks (version bumps, doc-only edits, file renames, dependency upgrades). The signal-to-noise ratio is bad on these and the implementing agent doesn't need pointers to bump a number. Mark them with a comment in the description like `_Enrichment skipped: trivial._` so the absence is intentional, not a bug.

**Token discipline**:
- One `Explore` agent **per phase**, not per task. Typical V8 backlog = 4–6 phases = 4–6 agents.
- Batching key is phase, not theme — phases are the unit of code surface for the implementing agents.
- Cap descriptions to ≤5 entries per section. Pointers are a head-start, not exhaustive — the implementing agent validates by reading the actual code at PR time.

### Phase 4 - Generate `tasks.json`

Write to `/tmp/claude/backlog-<slug>-<timestamp>/tasks.json` using the schema below. Use `mkdir -p` first.

```json
{
  "project_id": "01860302-1e60-4876-ac21-c2c512be5616",
  "team_id": "113334ef-299c-4929-85ae-c78cc49972ce",
  "default_priority": 3,
  "source_bundle": "/abs/path/to/backlog-bundle.json",
  "phases": [
    {
      "number": 1,
      "name": "Multi-apps support",
      "tasks": [
        {
          "step": "01",
          "title": "Add port allocator state to R2",
          "description": "...",
          "decision_refs": ["D1", "D2"],
          "priority": 2
        },
        {
          "step": "02",
          "title": "Allocate host port on first deploy of a project",
          "description": "...",
          "decision_refs": ["D2"]
        },
        {
          "step": "03",
          "title": "Configure global error boundary",
          "description": "...",
          "decision_refs": [],
          "theme": "plumbing"
        },
        {
          "step": "04",
          "title": "E2E: deploy app, allocate port, verify R2 entry",
          "description": "...",
          "decision_refs": ["D1", "D2"],
          "theme": "demo-path"
        },
        {
          "step": "05",
          "title": "Render allocated ports in the admin dashboard",
          "description": "...",
          "decision_refs": ["D2"],
          "scope": "vnext"
        }
      ]
    }
  ]
}
```

`source_bundle`, `decision_refs`, `theme`, and `scope` are optional fields ignored by the worker — they exist for traceability and the coverage/diagnostic checks. Omit `source_bundle` for plain-text plans. Omit `decision_refs` on individual tasks only for plain-text plans (bundle-sourced tasks always carry refs OR `theme: "plumbing"` — Phase 3 rule 7). `theme` values currently used: `"plumbing"` (Phase 3.2 cross-cutting) and `"demo-path"` (Phase 3.1 end-to-end verification chain). `scope` defaults to `"mvp"` and is omitted; set `"vnext"` for tasks that the bundle marked V2 / post-MVP.

After writing, **show the user a diagnostic preview**. Bundle-sourced runs render every section below; plain-text plans skip the bundle-specific sections (3, 4, 5).

1. **Header**:
   - `Project: <name> (id ...)` (resolved from workspace.md).
   - Bundle-sourced only: `Bundle: <path> — N decisions — change_kind: <kind>`.

2. **Phase breakdown** — one bullet per phase:
   `Phase N - <name> - X tasks (Y mvp · Z plumbing · W demo-path)`.

3. **Decision coverage** (bundle-sourced only) — render a per-Decision histogram:

   ```
   D1  ██████░░  5 / 4 target ✓
   D6  ███░░░░░  2 / 5 target ⚠ under
   ```

   Bar = actual tasks covering the Decision. Target = `ceil(decision.atoms_count × 1.3)` from Phase 3.1. Any `⚠ under` blocks push — split or justify in chat. Below the histogram, list each Decision with its fact preview and covering task IDs: `D<i> — <fact preview> — covered by [T1.01, T1.02, T3.04]`.

4. **Mechanism artifacts uncovered** (bundle-sourced only) — list each Decision's atoms whose concrete artifact does not appear in any task's `WHERE` or `DONE WHEN`:

   ```
   D1: capture_stdout (atom c), ref_session_create (atom b)
   D10: <DiffPanel> selector state
   ```

   Block push if non-empty — these are unimplemented atoms.

5. **Verification chains missing demo task** (bundle-sourced only) — list each Decision whose `verification` is a multi-step chain (≥3 steps) but no `theme: "demo-path"` task reproduces it. Block push if non-empty.

6. **Plumbing checklist** (when Phase 3.2 ran) — one line per concern from the applicable checklist:

   ```
   ✓ App identity → T1.02
   ✓ Logging Rust → T1.06
   ✗ MISSING: prompt input surface
   ✗ MISSING: code signing
   ```

   Any `✗` blocks push unless explicitly waived in chat ("waive: prompt input lives in cmux for V1").

7. **Orphans** — list any task with empty `decision_refs` AND no `theme: "plumbing"`. Block push if non-empty.

8. **Footer**:
   - Total task count, with the `mvp / vnext` split if any task carries `scope: "vnext"`.
   - Path to the generated `tasks.json`.
   - Path to the `phase-contexts/` folder (if enrichment ran).

Then ask for explicit confirmation: `Lance le worker en détaché ?` — wait for `oui` / `go` / `yes` before Phase 5. **If any blocker is present** (sections 3 ⚠ under, 4 non-empty, 5 non-empty, 6 ✗, 7 non-empty), the default is to refuse the push. The user can override with `force` but the override must be logged in chat ("forcé malgré 2 atomes uncovered sur D1").

### Phase 5 - Copy worker + launch detached

This phase MUST follow `/nextnode-linear` Rule 10 (no inline waits).

```bash
TASK_DIR="/tmp/claude/backlog-<slug>-<timestamp>"
cp ~/.stow_repository/claude/.claude/skills/backlog/create_issues.py "$TASK_DIR/create_issues.py"

nohup python3 -u "$TASK_DIR/create_issues.py" "$TASK_DIR/tasks.json" \
  > "$TASK_DIR/run.log" 2>&1 &
disown
echo "Started PID $!"
```

The launch command MUST exit immediately. Do NOT pipe to `tee`/`tail`, do NOT chain `wait`, do NOT poll in a loop.

### Phase 6 - Hand off

Tell the user, in one short message:

- `Worker lancé en détaché (PID <pid>).`
- `Log: tail -50 <TASK_DIR>/run.log`
- `Tasks écrites: grep -c '^OK ' <TASK_DIR>/run.log`
- `Quand tu veux le rapport final, lance tail.`

Then STOP. Do not poll, do not sleep-then-tail. The user comes back when ready.

If the user comes back later asking "où ça en est", THEN run a single `tail -50 <log>` (cheap, returns instantly) - never a `sleep N && tail` chain.

## Rules

1. **Never push to Linear without confirmation.** Phase 4 generates JSON, Phase 5 needs the user's go.
2. **Always launch detached.** No inline polling. The user pings back for status; only then run `tail`.
3. **Atomicity is non-negotiable: 1 task = 1 commit, 1 phase = 1 PR.** No "and" / "et" / "+" / "puis" in titles. Concrete plurals (`tables`, `methods`, `commands`) and counts in titles are split markers — Phase 3.3 enforces. If you cannot describe the task in one imperative verb phrase on one artifact (= one commit), split it. Phase boundaries are decided by parallelization (Phase 3 rule 4), never by size — split a phase only when its tasks can run as two independent parallel PRs.
4. **Two-pass generation by default.** Pass 1 (Phases 3 + 3.1 + 3.2) explodes — one task per mechanism atom, per plumbing concern, per demo-path. Pass 2 (Phase 3.3) merges only when all four merge conditions hold. The skill's failure mode is under-decomposition, never over-decomposition.
5. **Both directions of coverage.** Forward (every Decision → ≥1 task) AND reverse (every Mechanism atom → ≥1 task, every Verification chain → ≥1 demo-path task, every Decision ≥ `ceil(atoms × 1.3)` tasks). Phase 4 preview must show all three reverse checks; blockers abort the push.
6. **The worker is the single source of truth for the `[P{N}-{step}]` prefix.** Do NOT pre-prefix titles in the JSON. All scratch in `/tmp/claude/backlog-<slug>-<timestamp>/`.
7. **NEVER create a Linear task that updates a Claude skill.** Anything whose `WHERE` points at `~/.claude/skills/...` or `~/.stow_repository/claude/.claude/skills/...` is hard-banned — personal tooling, lives in a separate repo (`mac-config`). Drop these tasks entirely.
