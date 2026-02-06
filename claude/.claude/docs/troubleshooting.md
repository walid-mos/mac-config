# Troubleshooting

## Session: test-agent-description — 2026-02-06

### Test Agent — Known Gaps

These gaps were identified during the Test Agent description phase (T-9 to T-11). They need to be addressed before or during implementation.

---

#### GAP-1: No Input Contract (Critical: High)

The Test Agent "receives task list + testing strategy" but the exact shape is never defined. If the Lead Agent sends a slightly different format, the Test Agent parses incorrectly or hallucates tasks.

**Action:** Define a concrete schema for the task list payload (task id, title, strategy, target files, acceptance criteria) and document it in both the Lead Agent and Test Agent prompts.

---

#### GAP-2: No Test Modification Detection (Critical: High)

In `tdd-strict` mode, the Code Agent must never touch test files. But the Test Agent has no mechanism to verify this after a Code Agent run.

**Action:** Add a verification step — compare test file checksums or git diff before/after Code Agent execution. If any `.test.ts` / `.spec.ts` was modified, escalate as `TDD VIOLATION`.

---

#### GAP-3: No Handling of Pre-Existing Code (Critical: Medium)

The description assumes green-field: write test, red, Code Agent, green. But tests might pass immediately if code already exists from a previous iteration or partial implementation.

**Action:** Add a decision tree: if tests pass before Code Agent runs, determine whether this is expected (post-code strategy) or suspicious (strict TDD — test might not be testing new behavior). Define behavior for partial passes (3/5 green).

---

#### GAP-4: No File Discovery After Code Agent (Critical: High)

After a Code Agent finishes, the Test Agent needs to re-run tests but doesn't know what files were created or modified.

**Action:** Define a discovery mechanism — either the Code Agent reports modified files, the Test Agent runs `git diff --name-only`, or the Lead Agent passes the Code Agent output. Pick one and standardize.

---

#### GAP-5: Inconsistent Placeholder Format (Critical: Low)

The description mentions both `// TODO: implement` and `it.todo('test name')` for flexible mode skeletons without specifying when to use which.

**Action:** Standardize: `it.todo('description')` for pending test cases (Vitest-native, visible in test reports), never `// TODO` inside test files. `it.skip()` only for temporarily disabled tests.

---

#### GAP-6: No Teammate Name Discovery (Critical: CRITICAL)

`SendMessage` requires a `recipient` field with the exact teammate name. The Test Agent has no way to discover teammate names for hybrid communication (FR-19).

**Action:** Define the discovery mechanism — either the Lead Agent passes names in the initial prompt, or the Test Agent reads `~/.claude/teams/{team-name}/config.json`. This blocks ALL hybrid communication until resolved.

---

#### GAP-7: No Async Flow After Spec Feedback (Critical: Medium)

When the Test Agent sends `SPEC FEEDBACK` to Planification, the expected behavior is undefined — block and wait? Continue with assumptions? Hand back to Lead?

**Action:** Define the async protocol: what happens after sending feedback, timeout behavior, and how control flows back. Consider that blocking wastes the agent's turn while continuing risks wrong assumptions.

---

#### GAP-8: No Response Handling from Planification (Critical: Medium)

When Planification responds to spec feedback, the Test Agent has no protocol for processing the response — how does the updated spec arrive, and does the Test Agent rewrite all tests or only affected ones?

**Action:** Define response handling: message format, partial vs full test rewrite, and behavior for "proceed as-is" responses.

---

### Priority Order

| Priority | Gaps | Reason |
|----------|------|--------|
| P0 | GAP-6 | Blocks hybrid communication entirely |
| P1 | GAP-1, GAP-2, GAP-4 | Silent failures or broken guarantees |
| P2 | GAP-7, GAP-8, GAP-3 | Incomplete flows, edge cases |
| P3 | GAP-5 | Cosmetic consistency |
