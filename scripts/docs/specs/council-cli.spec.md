# Council CLI + Monorepo Extraction — Spec

## Overview

Build a `council` CLI that replaces the existing `/council` skill, following the same architecture as the `swarm` CLI. The council CLI spawns 5 core sages + conditional sages in parallel, runs deliberation rounds (min 3, max 5) with convergence checking, synthesizes feedback via a dedicated LLM agent, and outputs a refined document with a deliberation log.

This spec also covers extracting shared code from `swarm` into a `@nns/common` package within the existing monorepo workspace.

## Context

The current `/council` skill is implemented entirely within a Claude skill file (`~/.claude/skills/council/SKILL.md`). It orchestrates sage agents directly from the conversation context, which has several limitations:
- Consumes the user's context window with sage outputs
- No state persistence across interruptions
- No NDJSON event stream for observability
- No TOML-based configuration
- Cannot reuse the driver abstraction (claude/opencode backends)

The `swarm` CLI (`scripts/.local/share/packages/swarm/`) already solves all of these problems for code implementation workflows. Council needs the same infrastructure for document deliberation workflows.

### Already Completed (branch `swarm/council`)

The monorepo workspace has been scaffolded:
- `.local/share/pnpm-workspace.yaml` with `packages: [packages/*]`
- Root `package.json` (`@nns/root`), `tsconfig.base.json`, `tsconfig.json`
- Swarm source moved from `.local/share/swarm/` to `.local/share/packages/swarm/`
- `.local/bin/swarm` binary updated to point to `packages/swarm/dist/cli.js`

## Functional Requirements

### Monorepo Completion

- **FR-1**: Extract shared code from `swarm` into a `@nns/common` workspace package at `.local/share/packages/common/`. Shared modules: drivers (claude, opencode, registry), output-parser, event-emitter, state-manager, config-resolver, model-registry, types, errors, validation, tech-stack detection.
- **FR-3**: Update all swarm imports to use `@nns/common` instead of local relative paths.
- **FR-4**: Create `.local/bin/council` binary pointing to `packages/council/dist/cli.js`.
- **FR-5**: Swarm must remain fully functional after the extraction — all existing tests pass, the binary works identically.

### Council CLI Core

- **FR-6**: Implement a `council run` command using Commander.js that accepts: `--session <name>`, `--doc <path>` (input document), `--project-dir <path>`, `--config <path>` (optional, for `council.toml`).
- **FR-7**: Classify the input document as `spec` (contains `FR-*` items, `## Functional Requirements`) or `plan` (contains `PLAN-*` / `## Implementation Phases`) or `generic`. Preserve the detected format throughout all rounds.
- **FR-8**: Auto-detect the project's tech stack (reusing `@nns/common`'s `tech-stack.ts`) to activate conditional sages. Currently one conditional sage: **TypeScript Master** (activated when `tsconfig.json` exists or `.ts`/`.tsx` files are detected).
- **FR-9**: Validate CLI inputs with Zod: session ID matches `/^[a-zA-Z0-9_-]{1,64}$/`, doc path exists and is a file, project dir exists and is a directory.

### Sage Orchestration

- **FR-10**: Spawn all active sages (5 core + conditional) in parallel via the driver abstraction in each deliberation round.
- **FR-11**: Each sage is session-persistent: round 1 uses `--session-id <UUID>`, round 2+ uses `--resume <UUID>`. This preserves context across rounds for token efficiency.
- **FR-12**: Sage prompts use a minimal shared base (project context: tech stack, directory structure, document type) plus a large sage-specific lens section that defines the sage's expertise area, scoring criteria, and output format.
- **FR-13**: Each sage must output a structured JSON response:
  ```typescript
  interface SageOutput {
    sageName: string
    score: number          // 1-10
    criticalIssues: Finding[]
    suggestions: Finding[]
    strengths: string[]
    revisedSections?: Record<string, string>  // section name → rewritten content
  }

  interface Finding {
    id: string             // e.g., "ARCH-1", "SEC-3"
    severity: 'critical' | 'major' | 'minor'
    description: string
    fix: string            // concrete fix recommendation
    section?: string       // which document section this applies to
  }
  ```

### Synthesizer Agent

- **FR-14**: After all sages complete a round, spawn a dedicated synthesizer agent (opus-level) to merge findings and produce the revised document.
- **FR-15**: The synthesizer is session-persistent (same `--session-id` / `--resume` pattern as sages).
- **FR-16**: Round 1 synthesizer input: the full original document + all sage outputs (structured JSON).
- **FR-17**: Round 2+ synthesizer input (via `--resume`): the changelog of what it changed in the previous round + all new sage outputs for this round. The session context already contains the document history.
- **FR-18**: The synthesizer must output:
  ```typescript
  interface SynthesizerOutput {
    revisedDocument: string     // full markdown content
    changelog: ChangelogEntry[] // what was changed and why
    appliedFindings: string[]   // finding IDs that were addressed
    rejectedFindings: Array<{   // findings intentionally not addressed
      id: string
      reason: string
    }>
  }

  interface ChangelogEntry {
    section: string
    change: string
    reason: string
    sourceFindings: string[]    // which sage findings drove this change
  }
  ```

### Convergence Logic

- **FR-19**: Run a minimum of 3 deliberation rounds (MIN_ROUNDS = 3), regardless of scores.
- **FR-20**: Hard stop after 5 rounds (MAX_ROUNDS = 5).
- **FR-21**: Convergence is reached when ALL of: (a) all sage scores >= threshold (default 8), (b) total critical issues across all sages == 0, (c) total new suggestions across all sages <= 3.
- **FR-22**: Convergence parameters are configurable via `council.toml` `[convergence]` section.

### Output & Artifacts

- **FR-23**: Overwrite the input document in-place with the final refined version.
- **FR-24**: Write a deliberation log to `$TMPDIR/council-<session>-deliberation.md` containing: per-round score table (sage × round), findings summary, changes applied, convergence status per round.
- **FR-25**: Emit NDJSON events to stdout (reusing `@nns/common`'s event-emitter): session start/end, round start/end, sage invoke/result, synthesizer invoke/result, convergence check.
- **FR-26**: Persist state to `$TMPDIR/council-<session>-state.json` (reusing `@nns/common`'s state-manager) for crash observability. State includes: current round, sage scores per round, convergence status, document versions.
- **FR-27**: Optionally commit the refined document at the end if `--commit` flag is passed. Commit message: `docs(council): refine <doc-basename> — <session>`.

### TOML Configuration

- **FR-28**: Council resolves config with the same precedence as swarm: (1) explicit `--config` path, (2) `<projectDir>/council.toml`, (3) `~/.config/council/default.toml`, (4) built-in defaults.
- **FR-29**: Config schema:
  ```toml
  [sages]
  architect   = { backend = "claude", model = "opus" }
  security    = { backend = "claude", model = "opus" }
  clean-code  = { backend = "claude", model = "sonnet" }
  reliability = { backend = "claude", model = "opus" }
  standards   = { backend = "claude", model = "sonnet" }
  synthesizer = { backend = "claude", model = "opus" }

  # Conditional sages (auto-activated, same config format)
  typescript  = { backend = "claude", model = "sonnet" }

  [convergence]
  min_rounds = 3
  max_rounds = 5
  threshold  = 8
  max_new_suggestions = 3
  ```

### Skill Launcher Update

- **FR-30**: Update `~/.claude/skills/council/SKILL.md` to become a thin launcher (mirroring swarm's skill). The updated skill: (1) accepts a document path from the user (or asks for one), (2) derives a session name, (3) invokes `council run` via Bash, (4) reports results (refined doc path + deliberation log summary).

## Data Model

### State Schema

```typescript
interface CouncilState {
  schemaVersion: 1
  sessionId: string
  docPath: string
  projectDir: string
  docType: 'spec' | 'plan' | 'generic'
  config: CouncilConfig
  currentRound: number
  activeSages: string[]
  rounds: RoundResult[]
  converged: boolean
  errors: PhaseError[]
  startedAt: string
  updatedAt: string
}

interface RoundResult {
  round: number
  sageOutputs: Record<string, SageOutput>
  synthesizerOutput: SynthesizerOutput
  convergenceCheck: {
    allAboveThreshold: boolean
    criticalIssueCount: number
    newSuggestionCount: number
    converged: boolean
  }
}
```

### Session Registry

Each agent (sage or synthesizer) gets a stable UUID session ID that persists across rounds:
```typescript
interface AgentSessions {
  [agentName: string]: string  // agent name → UUID
}
```

## API Contract

Not applicable — this is a CLI tool, not a web service. The CLI's interface is defined by Commander.js options in FR-6.

## UI/UX Requirements

Not applicable — CLI tool. Output is NDJSON events to stdout and files to disk.

## Edge Cases

- **Document < 20 lines**: Run full deliberation loop anyway (sages may identify missing sections)
- **Document > 500 lines**: Log a warning event, proceed normally
- **All sages score 10/10 on round 1**: Still run MIN_ROUNDS (3 rounds minimum)
- **Sage agent fails**: Retry once. If still fails, log error, exclude that sage's output from synthesis for this round, continue with remaining sages. Do NOT abort the entire session.
- **Synthesizer agent fails**: Retry once. If still fails, use the previous round's document (or original if round 1) and log a fatal error. Abort session.
- **Non-markdown input**: Reject with clear error — council only processes `.md` files
- **Empty document**: Reject with error — nothing to deliberate on
- **Interrupted session**: State file preserves progress. User can inspect `$TMPDIR/council-<session>-state.json` but there is no `resume` command — re-run from scratch.

## Security

- Sage prompts must not include secrets or credentials from the project
- State files written with 0o600 permissions (user-only)
- Config file paths validated for containment (no path traversal)
- The `--commit` flag only commits to the current branch — no force push, no branch creation

## Performance

- All sages run in parallel (Promise.all) — each round's wall-clock time is bounded by the slowest sage
- Session persistence (`--resume`) reduces token usage by ~40-60% in rounds 2+ (sages retain prior context)
- Typical session: 5-6 agents × 3-5 rounds = 15-30 agent invocations
- Expected wall-clock time: 3-8 minutes depending on document size and round count

## Dependencies

### Shared (`@nns/common`)
- `commander@13.1.0` — CLI framework (only needed in CLI packages, but types shared)
- `smol-toml@1.3.1` — TOML parser
- `zod@3.24.2` — Schema validation

### Council-specific
- No additional runtime dependencies beyond `@nns/common`

### Dev (workspace root)
- `tsup@8.4.0+` — Bundler
- `typescript@5.7.3+` — Compiler
- `vitest@3.0.5+` — Test runner
- `@types/node@22+` — Node types

### External tools (spawned at runtime)
- `claude` — Claude CLI
- `opencode` — OpenCode CLI (optional, if configured)
- `git` — Git operations (only for `--commit`)

## Out of Scope

- **Resume command**: Sessions are short enough that re-running is acceptable
- **Worktree isolation**: Council modifies a single document, not a codebase
- **PR creation**: Council doesn't produce code changes worthy of a PR
- **Per-sage score thresholds**: Global threshold only (configurable in TOML)
- **Dry-run mode**: Not implemented in v1
- **Custom sage definitions via TOML**: Only core + auto-detected conditional sages
- **Non-markdown documents**: Only `.md` files are supported

## Open Questions

None — all design decisions have been resolved through the interview.
