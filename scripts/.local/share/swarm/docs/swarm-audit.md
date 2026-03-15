# Swarm Audit

I audited `scripts/.local/share/swarm` with 6 parallel subagents plus direct source review, and I ran `pnpm test` in `scripts/.local/share/swarm` - 34 test files passed, 691 tests passed, 4 todo, in 1.55s.

## Verdict

- The package has strong test depth and solid low-level driver/state primitives, but the orchestration layer is not fully truthful, not fully incremental, and not machine-first enough for a large swarm.
- The biggest problems are not syntax or missing tests; they are workflow correctness, token/runtime scalability, logging correlation, and report determinism.
- Today, the script is good enough for controlled usage, but not yet robust enough to be a high-confidence, high-scale autonomous execution engine.

## Critical Findings

- Workflow truthfulness is broken: code phase always reports success with `const success = true` in `scripts/.local/share/swarm/src/phases/code/code-phase.ts:251`.
- Task completion truthfulness is broken: every task is marked `green` at the end regardless of final state in `scripts/.local/share/swarm/src/phases/code/dag-executor.ts:467`.
- The main convergence loop has no explicit cap and runs `while (true)` in `scripts/.local/share/swarm/src/phases/code/dag-executor.ts:264`, even though the model supports `max-iterations` and `timeout` outcomes in `scripts/.local/share/swarm/src/phases/phase-results.ts:97`.
- TDD is modeled inconsistently: top-level TDD phase exists in `scripts/.local/share/swarm/src/phases/tdd/tdd-phase.ts:204`, but CLI skips it and jumps from plan to code in `scripts/.local/share/swarm/src/cli.ts:167` and `scripts/.local/share/swarm/src/cli.ts:200`.
- State/schema drift exists: `worktreePath` is persisted in `scripts/.local/share/swarm/src/cli.ts:194`, present in runtime state in `scripts/.local/share/swarm/src/core/types.ts:222`, but missing from validation schema in `scripts/.local/share/swarm/src/core/validation.ts:59`.

## Token Optimization

- Review cost scales badly because every wave re-reviews the cumulative changed set with 3 specialist reviewers plus 1 merge agent in `scripts/.local/share/swarm/src/phases/code/dag-executor.ts:345` and `scripts/.local/share/swarm/src/phases/code/review-merge.ts:215`.
- Reviewer prompts duplicate large shared blocks across `scripts/.local/share/swarm/src/phases/code/review-prompt.ts:75`, `scripts/.local/share/swarm/src/phases/code/security-prompt.ts:65`, and `scripts/.local/share/swarm/src/phases/code/consistency-prompt.ts:38`.
- The merge step pays a second LLM tax to restate already structured reviewer findings in `scripts/.local/share/swarm/src/phases/code/review-merge.ts:233`.
- TDD prompts are oversized and resend full planner output plus broad generic doctrine in `scripts/.local/share/swarm/src/phases/tdd/test-prompt.ts:32`, `scripts/.local/share/swarm/src/phases/tdd/test-prompt.ts:57`, and `scripts/.local/share/swarm/src/phases/tdd/test-prompt.ts:153`.
- Code prompts also resend large static execution policy and growing test-file context in `scripts/.local/share/swarm/src/phases/code/code-agent-prompt.ts:38` and `scripts/.local/share/swarm/src/phases/code/dag-executor.ts:261`.

## Runtime Optimization

- TDD is a wave-wide blocking gate before any code work starts in `scripts/.local/share/swarm/src/phases/code/dag-executor.ts:302`, which reduces parallelism.
- Each wave recomputes git state and global review context through `getChangedFiles()` in `scripts/.local/share/swarm/src/phases/code/dag-executor.ts:346` and `scripts/.local/share/swarm/src/git/git-operations.ts:216`.
- Remote operations are on the critical path twice: draft PR creation pushes early in `scripts/.local/share/swarm/src/git/git-operations.ts:129`, then CLI pushes again at the end in `scripts/.local/share/swarm/src/cli.ts:207`.
- Per-task commits are strictly serial and spawn extra git processes in `scripts/.local/share/swarm/src/phases/code/dag-executor.ts:438` and `scripts/.local/share/swarm/src/git/git-operations.ts:162`.
- State persistence does repeated synchronous load/save cycles in `scripts/.local/share/swarm/src/phases/code/code-phase.ts:273`, `scripts/.local/share/swarm/src/phases/docs/docs-phase.ts:115`, and `scripts/.local/share/swarm/src/core/state-manager.ts`.

## Logging And Real-Time Observability

- Event coverage is conceptually good: typed events exist in `scripts/.local/share/swarm/src/core/types.ts:81`, and emission is centralized in `scripts/.local/share/swarm/src/core/event-emitter.ts:22`.
- Real-time correlation is weak because drivers emit `sessionId: 'driver'` instead of the real swarm session in `scripts/.local/share/swarm/src/drivers/claude-driver.ts:187` and `scripts/.local/share/swarm/src/drivers/opencode-driver.ts:261`.
- Important telemetry types exist but are never emitted: `file:changed` and `build:*` are only defined in `scripts/.local/share/swarm/src/core/types.ts:163` and `scripts/.local/share/swarm/src/core/types.ts:194`.
- Too much operational data bypasses the event stream and goes directly to stderr; there are 32 `process.stderr.write` usages across the package, including `scripts/.local/share/swarm/src/phases/code/review-merge.ts:75`, `scripts/.local/share/swarm/src/phases/code/dag-executor.ts:317`, `scripts/.local/share/swarm/src/phases/docs/docs-phase.ts:234`, and `scripts/.local/share/swarm/src/cli.ts:222`.
- Session observability is incomplete because `resume`, `status`, and `config` are still stubs in `scripts/.local/share/swarm/src/cli.ts:287`.
- Successful runs delete raw agent NDJSON logs in `scripts/.local/share/swarm/src/cli.ts:261`, so post-run forensic value is reduced.

## Documentation And API Usability

- The docs pipeline has good resilience: retry/fallback behavior and deterministic fallback markdown exist in `scripts/.local/share/swarm/src/phases/docs/docs-phase.ts:141` and `scripts/.local/share/swarm/src/phases/docs/fallback-report.ts:15`.
- The primary report is still unconstrained LLM markdown, not schema-validated output, in `scripts/.local/share/swarm/src/phases/docs/docs-phase.ts:155` and `scripts/.local/share/swarm/src/phases/docs/docs-prompt.ts:80`.
- The report is not reliably API-friendly because there is no canonical JSON artifact such as `delivery-report.json` or `iterations.json`; only markdown files are written in `scripts/.local/share/swarm/src/phases/docs/docs-phase.ts:195`.
- Task-level report accuracy is wrong because every task gets the same global `changedFiles` list in `scripts/.local/share/swarm/src/phases/docs/report-builder.ts:54`.
- The report collapses all work into one synthetic spec item in `scripts/.local/share/swarm/src/phases/docs/report-builder.ts:61`, which is weak for automation.
- Output stability is weakened by locale-sensitive formatting in `scripts/.local/share/swarm/src/phases/docs/iteration-log-builder.ts:140`.
- The package root has no README; there is no `scripts/.local/share/swarm/README.md`.

## DRY And Complexity

- There is high orchestration duplication across plan/TDD/code/docs/review for retry handling, phase events, abort logic, and persistence in `scripts/.local/share/swarm/src/phases/plan/plan-phase.ts:41`, `scripts/.local/share/swarm/src/phases/tdd/tdd-phase.ts:53`, `scripts/.local/share/swarm/src/phases/code/code-phase.ts:178`, `scripts/.local/share/swarm/src/phases/code/review-merge.ts:115`, and `scripts/.local/share/swarm/src/phases/docs/docs-phase.ts:89`.
- Prompt duplication is significant across review/security/consistency builders in `scripts/.local/share/swarm/src/phases/code/review-prompt.ts`, `scripts/.local/share/swarm/src/phases/code/security-prompt.ts`, and `scripts/.local/share/swarm/src/phases/code/consistency-prompt.ts`.
- Driver files are too large and duplicate transport/process concerns: `scripts/.local/share/swarm/src/drivers/claude-driver.ts` and `scripts/.local/share/swarm/src/drivers/opencode-driver.ts`.
- `scripts/.local/share/swarm/src/cli.ts` is doing too much: argument parsing, session lifecycle, worktree handling, state mutation, push, cleanup, and exit handling.
- `scripts/.local/share/swarm/src/phases/code/dag-executor.ts` is the main complexity hotspot; it mixes scheduler, TDD coordinator, code execution, review loop, attribution, convergence, and commit logic in one file.
- `scripts/.local/share/swarm/src/phases/phase-results.ts` contains duplicate `CodeAgentOutput` definitions at `scripts/.local/share/swarm/src/phases/phase-results.ts:32` and `scripts/.local/share/swarm/src/phases/phase-results.ts:61`, which is a concrete DRY violation and a type-drift risk.

## What Is Already Strong

- Test coverage is excellent for a prompt-heavy orchestration tool.
- Driver resilience is strong: timeout, abort, parsing, and token accounting are well covered, especially in `scripts/.local/share/swarm/src/drivers/claude-driver.ts`.
- The event model and state manager are clean foundations in `scripts/.local/share/swarm/src/core/event-emitter.ts` and `scripts/.local/share/swarm/src/core/state-manager.ts`.
- The docs fallback path is sensible and safer than many agent-driven reporting systems.

## Priority Order

- `P0` Fix workflow truthfulness: compute real `success`, preserve real task status, add explicit convergence limits.
- `P1` Make review incremental: review wave-local deltas, not the entire accumulated diff every time.
- `P1` Make observability first-class: real session IDs, invocation IDs, task IDs, durable event logs, structured warning events.
- `P1` Make docs machine-first: generate validated JSON artifacts first, then render markdown from them.
- `P2` Extract shared orchestration and prompt-building primitives to cut duplication and reduce complexity.
- `P2` Split `cli.ts`, `dag-executor.ts`, and the drivers into smaller single-purpose modules.
