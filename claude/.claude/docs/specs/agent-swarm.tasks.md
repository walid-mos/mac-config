# Agent Swarm — Implementation Tasks

## Phase 1: Core Skill Skeleton

- [x] **T-1**: Create `.claude/skills/swarm/SKILL.md` with frontmatter (name, description, allowed-tools)
- [x] **T-2**: Implement argument parsing — derive kebab-case session name from free-form input
- [x] **T-3**: Implement initialization phase — check existing specs, detect tech stack, read `.swarm.json`
- [x] **T-4**: Implement doc initialization — create/append headers to `iterations.md`, `troubleshooting.md`

## Phase 2: Planification Agent

- [x] **T-5**: Write the Planification Agent prompt — smart spec detection logic
- [ ] **T-6**: Wire `/interview` invocation when spec gaps are detected (FR-11)
- [x] **T-7**: Implement task list generation with per-item testing strategy (FR-13, FR-14)
- [x] **T-8**: Add troubleshooting.md reading for workflow learning (FR-15)

## Phase 3: Test Agent

- [x] **T-9**: Write the Test Agent prompt — receives task list + testing strategy
- [x] **T-10**: Implement strict TDD mode — full test files before code (FR-17)
- [x] **T-11**: Implement flexible mode — test outlines/skeletons (FR-18)
- [ ] **T-12**: Wire direct communication with Planification Agent (FR-19)

## Phase 4: Code Agents (Specialists)

- [x] **T-13**: Implement auto-detection of tech stack → specialist routing (FR-21)
- [x] **T-14**: Implement `.swarm.json` config override for specialists (FR-22)
- [ ] **T-15**: Wire existing skills as specialist context (typescript, react, astro, etc.) (FR-23)
- [x] **T-16**: Implement parallel Task spawning for independent work items (FR-20)
- [x] **T-17**: Handle interconnected tasks — serialize with shared context (FR-25)

## Phase 5: Lead Agent Orchestration

The Lead Agent is the SKILL.md prompt itself — it IS the execution context when `/swarm` is invoked. These tasks define the orchestration logic it uses to drive the full development loop.

### 5a: Agent Spawning & Result Processing

- [ ] **T-18**: Implement Planification Agent spawning — build the full input contract (`taskDescription`, `specItems`, `techStack`, `troubleshootingHistory`, `iterationsHistory`, `swarmConfig`, `codebaseMap`) and parse the structured output (`taskList`, `executionPlan`, `testingBrief`, `reuseMap`, `specUpdates`, `warnings`) (FR-9, FR-10)
- [ ] **T-19**: Implement Test Agent spawning — pass task list + testing strategies + spec sections from Planification output, parse `TestAgentOutput` (`taskResults`, `summary`, `codeAgentContext`), handle spec feedback loop back to Planification if needed (FR-16, FR-19)
- [ ] **T-20**: Implement Code Agent spawning — route each task to the right specialist based on `executionPlan.parallel` / `executionPlan.serial`, load domain skill per specialist (e.g., `typescript`, `react`, `astro`), pass test files + reuse map + anti-pattern directives as context, collect all results (FR-20, FR-21, FR-23, FR-24, FR-25)
- [ ] **T-21**: Implement Review Agent spawning — spawn Code Review + Security agents in parallel via concurrent `Task` calls, pass all changed files, parse categorized issues (`quick-fix` vs `significant`) (FR-26, FR-31)

### 5b: Loop Control & State Management

- [ ] **T-22**: Implement fix cycle processing — for `quick-fix` issues: spawn Code Agent directly; for `significant` issues: write to `docs/fixes.md`; for critical bugs: append to `docs/troubleshooting.md`; log all completed fixes in `docs/iterations.md` (FR-28, FR-29, FR-34)
- [ ] **T-23**: Implement inner loop (short loop) — after review phase, if updates exist, loop back to Code Agents + Tests only (skip re-planning) (FR-35)
- [ ] **T-24**: Implement outer loop (full loop) — after fixes resolved, if more spec items remain, loop back to Planification with updated state (FR-36)
- [ ] **T-25**: Implement iteration state tracking — maintain current iteration number, completed spec items, pending spec items, accumulated file changes, test results across iterations
- [ ] **T-26**: Implement recurring issue detection — track fix patterns across iterations, if same issue type appears 3+ times: stop looping, escalate to user via `AskUserQuestion`, log pattern in `docs/troubleshooting.md`

### 5c: Context Budget Management

- [ ] **T-27**: Implement context compression between iterations — keep latest iteration in full detail, summarize previous iterations to key outcomes only, preserve full task list and progress state (FR-39)
- [ ] **T-28**: Implement iteration logging — append structured session headers and iteration summaries to `docs/iterations.md` after each iteration completes

### 5d: Batching & Spec Item Routing

- [ ] **T-29**: Implement spec item batching — analyze total spec items, determine batch size per iteration (based on complexity and dependencies), pass only the current batch to Planification Agent
- [ ] **T-30**: Implement inter-iteration context passing — when iteration N produces shared types/interfaces, pass them as `existingAssets` to iteration N+1's Planification input

## Phase 6: Review Agents

- [ ] **T-31**: Write the Code Review Agent prompt — DRY, dead code, bad patterns, output categorized as `quick-fix` / `significant` (FR-27)
- [ ] **T-32**: Write the Security Agent prompt — OWASP, injection, insecure defaults, hardcoded secrets, output categorized as `quick-fix` / `significant` (FR-32)
- [ ] **T-33**: Define review agent output contract — shared structure for both agents: `{ issues: [{ type, severity, file, line, description, suggestedFix, category: "quick-fix" | "significant" }] }`

## Phase 7: Completion

- [ ] **T-34**: Implement exit condition logic — `auto`: auto-exit for small tasks (< 5 files, simple spec), ask confirmation for large/risky; `always`: always ask via `AskUserQuestion`; `never`: proceed without confirmation (FR-40)
- [ ] **T-35**: Implement `loopsummary.md` generation — tasks completed, iteration count, files changed, test counts, changes summary, issues encountered (FR-41)
- [ ] **T-36**: Implement git commit — stage only changed files, descriptive message from session name + summary, no `--force` / `--no-verify` (FR-42)
- [ ] **T-37**: Implement PR creation via `gh pr create` — title from session name, body from loopsummary.md session content (FR-43)

## Phase 8: Testing & Validation

- [ ] **T-38**: Create a dummy test project with a small spec (2-3 FRs, single specialist)
- [ ] **T-39**: Smoke test — run `/swarm` on the test project, verify single-iteration happy path (planification → tests → code → review → commit)
- [ ] **T-40**: Loop test — intentionally leave issues for review agents to catch, verify inner loop triggers and resolves
- [ ] **T-41**: Multi-iteration test — spec with 5+ items requiring batching, verify outer loop and inter-iteration context passing
- [ ] **T-42**: Validate doc output — check all 4 doc files are correctly populated with session headers and iteration content
- [ ] **T-43**: Validate git output — commit message, PR content, no destructive operations
- [ ] **T-44**: Edge case test — run with no spec (should trigger interview or inline spec), invalid `.swarm.json`, context pressure (large spec)

---

## Progress

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Core Skeleton    | **Done** | SKILL.md created, skill verified working via `/swarm test skill` |
| 2. Planification    | **In progress** | T-5, T-7, T-8 done (agent description written). T-6 pending (wire `/interview` at implementation time) |
| 3. Test Agent       | **Done** | T-9 to T-12 done (agent description written) |
| 4. Code Agents      | **In progress** | T-13, T-14, T-16, T-17 done (agent description written). T-15 pending (wire skill loading in Lead Agent orchestration) |
| 5. Lead Agent Orch. | Not started | Core orchestration: agent spawning (5a), loop control (5b), context mgmt (5c), batching (5d). This is the implementation heart of the swarm. |
| 6. Review Agents    | Not started | Code Review + Security agent prompts and output contract |
| 7. Completion       | Not started | Exit logic, loopsummary, git commit, PR creation |
| 8. Testing          | Not started | Smoke, loop, multi-iteration, edge case validation |
