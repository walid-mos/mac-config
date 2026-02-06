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

- [ ] **T-13**: Implement auto-detection of tech stack → specialist routing (FR-21)
- [ ] **T-14**: Implement `.swarm.json` config override for specialists (FR-22)
- [ ] **T-15**: Wire existing skills as specialist context (typescript, react, astro, etc.) (FR-23)
- [ ] **T-16**: Implement parallel Task spawning for independent work items (FR-20)
- [ ] **T-17**: Handle interconnected tasks — serialize with shared context (FR-25)

## Phase 5: Review Agents

- [ ] **T-18**: Write the Code Review Agent prompt — DRY, dead code, bad patterns (FR-27)
- [ ] **T-19**: Write the Security Agent prompt — OWASP, injection, insecure defaults (FR-32)
- [ ] **T-20**: Implement quick-fix flow — review agent directly spawns code agent (FR-28)
- [ ] **T-21**: Implement significant issue flow — write to `fixes.md` (FR-29)
- [ ] **T-22**: Implement big bug escalation to `troubleshooting.md` (FR-34)
- [ ] **T-23**: Wire parallel execution of Code Review + Security agents (FR-31)

## Phase 6: Main Loop

- [ ] **T-24**: Implement inner loop — review updates → Code Agents + Tests (FR-35)
- [ ] **T-25**: Implement outer loop — more spec items → back to Lead Agent (FR-36)
- [ ] **T-26**: Implement context compression between iterations (FR-39)
- [ ] **T-27**: Implement exit condition logic — auto vs user confirmation (FR-40)
- [ ] **T-28**: Implement iteration logging to `iterations.md` with session headers

## Phase 7: Completion

- [ ] **T-29**: Implement `loopsummary.md` generation (FR-41)
- [ ] **T-30**: Implement git commit with descriptive message (FR-42)
- [ ] **T-31**: Implement PR creation via `gh pr create` (FR-43)

## Phase 8: Testing & Validation

- [ ] **T-32**: Create a dummy test project with a small spec
- [ ] **T-33**: End-to-end test — run `/swarm` on the test project
- [ ] **T-34**: Validate loop behavior — intentionally leave issues for review agents to catch
- [ ] **T-35**: Validate doc output — check all 4 doc files are correctly populated
- [ ] **T-36**: Validate git output — commit message and PR content

---

## Progress

| Phase | Status | Notes |
|-------|--------|-------|
| 1. Core Skeleton    | **Done** | SKILL.md created, skill verified working via `/swarm test skill` |
| 2. Planification    | **In progress** | T-5, T-7, T-8 done (agent description written). T-6 pending (wire `/interview` at implementation time) |
| 3. Test Agent       | **Done** | T-9 to T-12 done (agent description written) |
| 4. Code Agents      | Not started | |
| 5. Review Agents    | Not started | |
| 6. Main Loop        | Not started | |
| 7. Completion       | Not started | |
| 8. Testing          | Not started | |
