# Swarm CLI, Config & Event System — Spec

## Overview

Foundation module for the swarm orchestrator. Provides the CLI entry point, TOML-based configuration system, NDJSON event emitter for real-time observability, and JSON state persistence for resume support. This module is the skeleton that all other modules plug into.

## Context

Swarm is a TypeScript CLI tool that orchestrates multiple AI agents to develop software autonomously from a spec. This spec covers the project scaffold, CLI framework, config resolution, and the event/state infrastructure that the orchestration engine (separate spec) relies on.

The project lives in `scripts/` in the stow repository. It uses a shim + dist/ pattern: TypeScript source compiles to `scripts/.local/share/swarm/dist/`, and a thin shim at `scripts/.local/bin/swarm` runs the compiled entry point. After `stow scripts`, the `swarm` command is available in PATH via `~/.local/bin/`.

## Functional Requirements

- **FR-1**: Scaffold the TypeScript project with package.json, tsconfig.json (strict: true), vitest config, and a build script that compiles to `scripts/.local/share/swarm/dist/` using tsup or esbuild
- **FR-2**: Implement a CLI entry point at `src/cli.ts` (NOT `src/index.ts` — no barrel exports) with the following subcommands using a CLI framework (commander or citty):
  - `swarm run` — execute a swarm session (main workflow)
  - `swarm resume` — resume an interrupted session
  - `swarm status` — show status of a session
  - `swarm config` — print resolved configuration for a project
  - `swarm version` — print version
- **FR-3**: Implement a TOML config parser that reads `swarm.toml` and resolves model routing. The parser must handle sections and inline tables with `backend` and `model` keys. Use `smol-toml` for parsing. Validate the parsed result at runtime using a schema validator (Zod or Valibot) — never trust raw parse output as `SwarmConfig`.
- **FR-4**: Implement config resolution with the following precedence chain (first found wins, no merging):
  1. `$PROJECT_DIR/swarm.toml` (project-specific)
  2. `~/.config/swarm/default.toml` (user global)
  3. `$SWARM_HOME/default.toml` (built-in defaults shipped with the package)
- **FR-5**: Implement an NDJSON event emitter (factory function, not a class) that writes structured events to stdout. Each event is a discriminated union with `type`, `timestamp`, `sessionId`, and a typed `data` payload. The emitter must support all event types defined in the `SwarmEventType` union (see Data Model). Events are also accumulated in memory so downstream modules can query past events.
- **FR-6**: Implement a JSON state persistence module (factory function, not a class) that writes the current session state to `$TMPDIR/swarm-<sessionId>-state.json` after each phase transition. State writes must be atomic: write to `<path>.tmp`, then `rename()` to the final path. The state file must contain enough information to resume a session from the last completed phase. Include a `schemaVersion` field for forward-compatible validation.
- **FR-7**: The `swarm run` subcommand must accept the following options:
  - `--session <name>` — session identifier (required, validated against `/^[a-zA-Z0-9_-]{1,64}$/`)
  - `--spec <path>` — path to the spec file to implement (required, canonicalized, must be under project-dir)
  - `--project-dir <path>` — target project directory (required, canonicalized, must not be a system root)
  - `--config <path>` — explicit config file path (optional, overrides resolution chain)
  - `--dry-run` — validate config and print execution plan without running
- **FR-8**: The `swarm resume` subcommand must accept `--session <name>` and `--project-dir <path>`, read the state file, validate it (schema version, required fields, spec file exists, project dir matches, session not already completed), and resume from the last completed phase using the persisted config.
- **FR-9**: The `swarm status` subcommand must accept `--session <name>` and print the current phase, iteration number, and any error state from the state file.
- **FR-10**: The `swarm config` subcommand must accept `--project-dir <path>` and print the fully resolved configuration showing which backend and model is assigned to each agent role, along with the source file path.
- **FR-11**: Create a `.stow-local-ignore` file that excludes `src/`, `tests/`, `package.json`, `tsconfig.json`, `node_modules/`, and other non-distributable files from stow. Only `.local/` gets stowed.
- **FR-12**: Create the shim file at `scripts/.local/bin/swarm` that resolves `SWARM_HOME` and executes the compiled entry point via Node.js.
- **FR-13**: Create a `default.toml` at `scripts/.local/share/swarm/default.toml` that maps all agent roles to the Claude backend with model `opus` as the fallback default.
- **FR-14**: Perform pre-flight checks before any session work begins: verify `$TMPDIR` is writable, spec file exists and is readable, project dir exists and is a directory, config resolves without errors, lock file is not held by a live process. If any check fails, exit with a clear error message and exit code 1.

## Data Model

### Branded Primitives

```typescript
declare const _sessionId: unique symbol
type SessionId = string & { readonly [_sessionId]: true }

function createSessionId(raw: string): SessionId
// Validates against /^[a-zA-Z0-9_-]{1,64}$/, throws on invalid input.
// This is the ONLY place where `as` cast is used — at the trust boundary.
```

### Domain Unions

```typescript
type AgentRole = 'plan' | 'test' | 'code' | 'review' | 'security' | 'merge' | 'docs'

// Config keys can include tag-suffixed roles for per-tag model routing
// Tag suffix restricted to /^[a-zA-Z0-9_-]{1,32}$/ — validated at runtime, NOT enforceable by this type
// Runtime validation lives in getModelAssignment() and resolveSwarmConfig()
type ConfigRoleKey = AgentRole | `code-${string}`

type Phase =
  | 'init'
  | 'plan'
  | 'tdd'
  | 'code'
  | 'review'
  | 'commit'
  | 'docs'
```

### Config

```typescript
interface ModelAssignment {
  backend: 'claude' | 'opencode'  // BackendName is defined in the driver spec (driver.ts) and re-used here
  model: string // Validated at parse time against /^[a-zA-Z0-9._\/-]{1,64}$/. Allows `/` for provider-prefixed models (e.g., "openai/gpt-5.3"). The driver spec brands this as ModelId — the `as ModelId` cast lives in resolveSwarmConfig() after validation.
}

interface SwarmConfig {
  models: {
    /** Base role assignments — key is AgentRole. All base roles are guaranteed present after resolution. */
    agents: Record<AgentRole, ModelAssignment>
    /** Tagged variant overrides — key must match /^code-[a-zA-Z0-9_-]{1,32}$/, validated at runtime */
    tagged: Record<string, ModelAssignment>
  }
}

interface ResolvedConfig {
  config: SwarmConfig
  resolvedFrom: string // file path or "builtin-defaults"
}
```

### TOML Format

The user-facing config file uses a flat `[models]` section. Keys are either base agent role names or tag-suffixed overrides:

```toml
# swarm.toml — example with all sections

[models]
plan     = { backend = "claude",   model = "opus" }
test     = { backend = "opencode", model = "gpt-5.3" }
code     = { backend = "opencode", model = "codex" }
review   = { backend = "claude",   model = "opus" }
security = { backend = "opencode", model = "gpt-5.3" }
merge    = { backend = "claude",   model = "opus" }
docs     = { backend = "opencode", model = "kimi-k2.5" }

# Tag-suffixed overrides (optional)
[models.code-frontend]
backend = "opencode"
model   = "gemini"

[models.code-backend]
backend = "opencode"
model   = "codex"
```

During parsing, `resolveSwarmConfig()` partitions the flat TOML `[models]` map: keys matching a base `AgentRole` populate `config.models.agents`; keys matching the tag override pattern populate `config.models.tagged`; all other keys trigger a warning to stderr.

### Events (Discriminated Union)

```typescript
type SwarmEventType =
  | 'session:start' | 'session:end' | 'session:error'
  | 'phase:start' | 'phase:end' | 'phase:error'
  | 'agent:invoke' | 'agent:result' | 'agent:error'
  | 'test:red' | 'test:green' | 'test:fail'
  | 'iteration:start' | 'iteration:end'
  | 'review:findings'
  | 'commit'
  | 'file:changed'

interface BaseEvent {
  type: SwarmEventType
  timestamp: string // ISO-8601
  sessionId: SessionId
}

interface PhaseStartEvent extends BaseEvent {
  type: 'phase:start'
  data: { phase: Phase; iteration?: number }  // iteration only present for phases that loop (code, review)
}

interface PhaseEndEvent extends BaseEvent {
  type: 'phase:end'
  data: { phase: Phase; durationMs: number; taskCount?: number }  // taskCount when phase produces countable results
}

interface PhaseErrorEvent extends BaseEvent {
  type: 'phase:error'
  data: { phase: Phase; reason: string }
}

interface AgentInvokeEvent extends BaseEvent {
  type: 'agent:invoke'
  data: { role: AgentRole; backend: 'claude' | 'opencode'; model: string }
}

interface AgentResultEvent extends BaseEvent {
  type: 'agent:result'
  data: { role: AgentRole; durationMs: number }
}

interface AgentErrorEvent extends BaseEvent {
  type: 'agent:error'
  data: { role: AgentRole; reason: string }
}

interface SessionStartEvent extends BaseEvent {
  type: 'session:start'
  data: { specPath: string; projectDir: string }
}

interface SessionEndEvent extends BaseEvent {
  type: 'session:end'
  data: { success: boolean; durationMs: number }
}

interface SessionErrorEvent extends BaseEvent {
  type: 'session:error'
  data: { reason: string }
}

interface TestRedEvent extends BaseEvent {
  type: 'test:red'
  data: { totalTests: number; passingTests: number; failingTests: number }
}

interface TestGreenEvent extends BaseEvent {
  type: 'test:green'
  data: { totalTests: number; passingTests: number }
}

interface TestFailEvent extends BaseEvent {
  type: 'test:fail'
  data: { totalTests: number; failingTests: number; reason: string }
}

interface IterationStartEvent extends BaseEvent {
  type: 'iteration:start'
  data: { iteration: number; batchCount: number }
}

interface IterationEndEvent extends BaseEvent {
  type: 'iteration:end'
  data: { iteration: number; success: boolean }
}

interface ReviewFindingsEvent extends BaseEvent {
  type: 'review:findings'
  data: { critical: number; important: number; suggestion: number }
}

interface CommitEvent extends BaseEvent {
  type: 'commit'
  data: { hash: string; message: string; filesChanged: number }
}

interface FileChangedEvent extends BaseEvent {
  type: 'file:changed'
  data: { path: string; action: 'created' | 'modified' | 'deleted' }
  // path must be relative to projectDir. The emitter must reject or relativize absolute paths.
}

type SwarmEvent =
  | PhaseStartEvent | PhaseEndEvent | PhaseErrorEvent
  | AgentInvokeEvent | AgentResultEvent | AgentErrorEvent
  | SessionStartEvent | SessionEndEvent | SessionErrorEvent
  | TestRedEvent | TestGreenEvent | TestFailEvent
  | IterationStartEvent | IterationEndEvent
  | ReviewFindingsEvent
  | CommitEvent
  | FileChangedEvent
```

### State

```typescript
interface SwarmState {
  schemaVersion: 1
  sessionId: SessionId
  specPath: string
  projectDir: string
  config: SwarmConfig
  currentPhase: Phase
  currentIteration: number
  currentSpecItem: number
  totalSpecItems: number
  completedPhases: Phase[]
  phaseResults: Partial<Record<Phase, unknown>>
  // Each phase module validates and narrows its own entry via Zod/Valibot.
  // e.g., the plan module writes PlanPhaseResult to phaseResults.plan
  // and validates it on read. This keeps the foundation spec agnostic
  // about phase-specific data while giving downstream specs a well-defined
  // extension point.
  errors: PhaseError[]
  // Capped at 50 entries (most recent). Older errors remain in the NDJSON event stream.
  startedAt: string
  updatedAt: string
}

type LoadResult =
  | { found: false; reason: 'missing' | 'inaccessible' }
  | { found: true; valid: true; state: SwarmState }
  | { found: true; valid: false; error: string }
```

### CLI Options

```typescript
interface RunOptions {
  session: string  // Raw CLI input — branded to SessionId inside the run handler, NOT at parse time
  spec: string     // Canonicalized absolute path, must be under projectDir
  projectDir: string // Canonicalized absolute path, must not be a system root
  config?: string
  dryRun?: boolean
}

interface ResumeOptions {
  session: string  // Raw CLI input — branded to SessionId inside the resume handler, NOT at parse time
  projectDir: string
}
```

### Auxiliary Types

```typescript
interface LockFile {
  pid: number
  startedAt: string  // ISO-8601
  hostname: string
}

interface PhaseError {
  phase: Phase
  message: string    // Max 2048 characters, sanitized (no stack traces or env vars)
  timestamp: string  // ISO-8601
}
```

### Error Types

```typescript
class ConfigValidationError extends Error {
  constructor(
    message: string,
    readonly filePath: string,
    readonly validationErrors: string[]
  ) {
    super(message)
    this.name = 'ConfigValidationError'
  }
}
```

### File Artifacts

All files are created under `$TMPDIR` (resolved via `os.tmpdir()`):

| File | Pattern | Lifecycle | Content | Permissions |
|------|---------|-----------|---------|-------------|
| State file | `swarm-<sessionId>-state.json` | Created at session start, updated after each phase transition | `SwarmState` JSON | 0o600 |
| Lock file | `swarm-<sessionId>-lock` | Created atomically at session start, removed on exit | `{ pid, startedAt, hostname }` | 0o600 |
| Done marker | `swarm-<sessionId>-done` | Created on any exit (success or failure) | Exit code as plain text | 0o600 |

## Source File Structure

```
src/
  cli.ts               # CLI entry point — actual implementation, NOT a re-export barrel
  config-resolver.ts    # resolveSwarmConfig(), getModelAssignment()
  event-emitter.ts      # createEventEmitter() factory
  state-manager.ts      # createStateManager() factory
  types.ts              # All type definitions (SessionId, Phase, AgentRole, SwarmEvent, etc.)
  validation.ts         # Runtime validators (Zod/Valibot schemas for config and state)
  errors.ts             # ConfigValidationError and other domain errors
```

No `index.ts` — no barrel exports. All consumers import directly from the relevant module.

## API Contract

This module exposes internal TypeScript APIs consumed by other swarm modules:

```typescript
// Config — src/config-resolver.ts
function resolveSwarmConfig(projectDir: string, explicitPath?: string): ResolvedConfig
// Parses TOML, validates via runtime schema. Throws ConfigValidationError on malformed input.
// After resolution, fills any missing base AgentRole keys in models.agents with the built-in
// default ({ backend: 'claude', model: 'opus' }). Tag-suffixed keys are never auto-filled.
// Keys in models that do not match a base AgentRole and do not match the tag override pattern
// /^(?:code|test|plan|review|security|merge|docs)-[a-zA-Z0-9_-]{1,32}$/ emit a warning to stderr.

function getModelAssignment(config: SwarmConfig, role: AgentRole, tag?: string): ModelAssignment
// Pure lookup, no I/O. Resolves tag fallback: config.models.tagged["code-<tag>"] → config.models.agents[role].
// Tag is validated at runtime against /^[a-zA-Z0-9_-]{1,32}$/ — throws on invalid tag.
// Base roles are guaranteed present in config.models.agents (filled by resolveSwarmConfig).

// Events — src/event-emitter.ts
function createEventEmitter(
  sessionId: SessionId,
  options?: { output?: NodeJS.WritableStream }  // Defaults to process.stdout. Overridable for testing.
): SwarmEventEmitter

interface SwarmEventEmitter {
  emit(event: SwarmEvent): void        // Writes NDJSON to stdout, accumulates in memory
  getEvents(filter?: { type?: SwarmEventType }): SwarmEvent[]  // Query past events
}

// State — src/state-manager.ts
function createStateManager(
  sessionId: SessionId,
  options?: { tmpDir?: string }  // Defaults to os.tmpdir(). Overridable for testing.
): SwarmStateManager

interface SwarmStateManager {
  load(): LoadResult                   // Discriminated result: not-found vs valid vs corrupt
  save(state: SwarmState): void        // Atomic write (tmp + parse-back + rename), mode 0o600. Throws on failure.
  acquireLock(): void                  // Atomic O_CREAT|O_EXCL, PID-based stale detection. Throws on failure.
  releaseLock(): void                  // Synchronous. Swallows ENOENT (idempotent). Called in finally/exit handler.
}

// Exhaustiveness helper — src/types.ts
function assertNever(x: never, message?: string): never
// Must be used as the default case in every switch over SwarmEvent.type or Phase.
// Ensures compile-time exhaustiveness: adding a new event type without handling it is a type error.

// Session bootstrap — created by the swarm run handler after pre-flight checks pass.
// Passed to the orchestration engine (separate spec) as its entry point.
interface SessionContext {
  sessionId: SessionId
  config: ResolvedConfig
  emitter: SwarmEventEmitter
  state: SwarmStateManager
  specPath: string       // Canonicalized via fs.realpathSync()
  projectDir: string     // Canonicalized via fs.realpathSync()
  dryRun: boolean
}
```

## Business Logic

### Pre-flight Checks

Before any session work begins, `swarm run` performs these checks in order:
1. Validate `--session` against `/^[a-zA-Z0-9_-]{1,64}$/` (prevents path traversal in derived file paths).
2. Canonicalize `--spec` and `--project-dir` via `fs.realpathSync()` (resolves symlinks, unlike `path.resolve()`). Verify `--spec` is under `--project-dir` using the resolved paths. Verify `--project-dir` is not a system root (`/`, `/etc`, `/var`, `/usr`). If `--config` is provided, canonicalize it via `fs.realpathSync()` and verify it ends in `.toml` (SC-8).
3. Verify `$TMPDIR` is writable (create and delete a temp file via `os.tmpdir()`).
4. Verify spec file exists and is readable.
5. Verify project dir exists and is a directory.
6. Resolve config (TOML parse + runtime validation).
7. Acquire session lock (see Lock Protocol).

If any check fails, exit with a clear error message and exit code 1. No state file, lock file, or events are created before all checks pass.

### Config Resolution

- Resolution is first-match, not merge. If `swarm.toml` exists in the project, the entire config comes from it — no fallback to user/default config for missing keys.
- If no config file is found at any level, use hardcoded defaults (all Claude, model opus).
- After resolving the config (from file or defaults), `resolveSwarmConfig()` fills any missing base `AgentRole` keys in `models.agents` with the built-in default (`{ backend: 'claude', model: 'opus' }`). This guarantees that `getModelAssignment()` never encounters a missing base role. Tag-suffixed keys in `models.tagged` are never auto-filled — they are optional overrides.
- The TOML parse result (`unknown`) is validated at runtime via a schema validator (Zod/Valibot). Invalid structure or types cause a `ConfigValidationError` with the file path and validation details.
- Keys in the config that do not match a base `AgentRole` and do not match the tag override pattern `/^(?:code|test|plan|review|security|merge|docs)-[a-zA-Z0-9_-]{1,32}$/` emit a warning to stderr with the unrecognized key name and config file path.
- Unknown backends (anything other than `claude` or `opencode`) cause a hard error.
- `resolveSwarmConfig()` returns `ResolvedConfig` which includes both the config and the source file path.

### Config Trust Boundary

`$PROJECT_DIR/swarm.toml` is an untrusted input when the project directory comes from an external source (webhook, CI). For automated/unattended execution, a future `--trusted-config-only` flag should bypass project-level config. Document this threat in comments.

### Resume Behavior

When a session is resumed via `swarm resume`, the config is loaded from the persisted `SwarmState.config`, not re-resolved from disk. This ensures the session runs with the same model routing it started with. If the on-disk config has changed, a warning is emitted to stderr but the persisted config is used.

### Event Emission

- Events are written to stdout as NDJSON (one JSON object per line, no trailing comma).
- All other output (logs, diagnostics) goes to stderr.
- Events are emitted synchronously — no buffering, no batching. Each event hits stdout immediately for real-time streaming.
- Events are accumulated in an in-memory array for querying by downstream modules (e.g., documentation spec reads accumulated events).
- The in-memory accumulator is bounded to 10,000 events. When the limit is reached, the oldest events are evicted in FIFO order, except `session:start`, `session:end`, `session:error`, `phase:start`, and `phase:end` events which are always retained. A warning is emitted to stderr when eviction begins.
- The event emitter must install an `error` handler on the output stream. If a write fails (`EPIPE`, closed stream), log the failure to stderr and continue. Event emission must never crash the orchestrator.
- No single event may exceed 64KB. Event data payloads must not contain raw file contents or full prompts — use truncation or path references for large data.

### State Persistence

- State is written after every phase transition (not during a phase).
- State writes must be atomic: write to `<path>.tmp`, read it back and `JSON.parse()` to verify it is valid JSON and non-empty, then `rename()` to the final path. If the read-back parse fails, log the error to stderr, delete the temp file, and do NOT overwrite the existing state file. Never write directly to the state file.
- State files are stored in `$TMPDIR` (resolved via `os.tmpdir()` — no hardcoded `/tmp` fallback).
- All files created in `$TMPDIR` use mode `0o600` (owner read/write only).
- On `load()`, validate the deserialized state at runtime (check `schemaVersion`, required fields, correct types). The embedded `SwarmState.config` must be re-validated through the same runtime schema (Zod/Valibot) used by `resolveSwarmConfig()` — this prevents tampered state files from injecting config values that bypass parse-time validation. If any validation fails, return `{ found: true, valid: false, error: string }`.
- A done marker file `swarm-<sessionId>-done` is written on any exit with the exit code.
- Include `schemaVersion: 1` in `SwarmState` for detecting version mismatches on resume.

### Lock Protocol

- Before initializing a session, create a lock file at `$TMPDIR/swarm-<sessionId>-lock` containing `{ pid, startedAt, hostname }`.
- Lock file must be created atomically using exclusive-create semantics (`fs.openSync(path, 'wx')` with `O_CREAT | O_EXCL`). This prevents TOCTOU race conditions.
- If the file already exists, read the PID and check liveness via `process.kill(pid, 0)`:
  - If alive → hard error: "Session `<id>` is already running (PID `<pid>`)."
  - If dead → stale lock. Emit warning to stderr, overwrite the lock.
- Shutdown ordering: (1) write done marker, (2) remove lock file. This ensures the done marker is always visible if the lock is gone.
- The lock is removed on clean exit via `process.on('exit')` handler and on `SIGTERM`/`SIGINT`/`SIGHUP` cleanup.
- All file operations in signal and exit handlers MUST use synchronous APIs (`fs.writeFileSync`, `fs.unlinkSync`). Async I/O in `process.on('exit')` is silently dropped by Node.js.
- Cleanup must be idempotent: use a `let cleanupDone = false` guard to ensure the shutdown sequence (done marker + lock removal) runs at most once. Each `unlinkSync` call must be wrapped in `try/catch` to swallow `ENOENT` (file already removed). Signal handlers fire, then `process.exit()` triggers the `exit` handler — without idempotency, writes and deletes happen twice.
- `SIGKILL` cannot be caught. After a SIGKILL, neither the done marker nor the lock file will exist. `swarm status` must detect this state: if a state file exists but neither lock nor done marker is present, report the session as "interrupted (process killed)."

## Edge Cases

- Config file exists but is empty: treated as valid, all defaults apply.
- `$TMPDIR` is not writable: hard error during pre-flight checks.
- State file is corrupted (invalid JSON or failed schema validation): `load()` returns `{ found: true, valid: false }` with error details.
- Multiple concurrent sessions with the same ID: detected via atomic lock file (see Lock Protocol).
- Session resume with a different spec path than the original: hard error, session IDs are bound to specs.
- Session resume when done marker exists (already completed): hard error: "Session `<id>` already completed. Use `swarm status` to view results or start a new session."
- Session ID contains path traversal characters: rejected at CLI parse time by the `/^[a-zA-Z0-9_-]{1,64}$/` validator.
- `EPIPE` on stdout during event emission: logged to stderr, swarm continues.
- State file exists but neither lock nor done marker present: `swarm status` reports "interrupted (process killed)" — indicates SIGKILL or abnormal termination.

## Security Constraints

- **SC-1 — Session ID validation**: `--session` must match `/^[a-zA-Z0-9_-]{1,64}$/`. Reject at CLI parse time. Prevents path traversal in all derived file paths.
- **SC-2 — Atomic lock file creation**: Lock file created via `fs.openSync(path, 'wx')`. Check-then-create patterns are prohibited.
- **SC-3 — Restrictive file permissions**: All files in `$TMPDIR` (state, lock, done marker) created with mode `0o600`.
- **SC-4 — Path canonicalization**: `--spec` and `--project-dir` canonicalized via `fs.realpathSync()` (resolves symlinks). `--spec` must resolve under `--project-dir`. `--project-dir` must not be a filesystem root or system directory.
- **SC-5 — Event payload limits**: No single event may exceed 64KB. No raw file contents, full prompts, or stack traces in event data.
- **SC-6 — Config trust boundary**: `$PROJECT_DIR/swarm.toml` is untrusted when the project comes from an external source. Future `--trusted-config-only` flag for automated execution.
- **SC-7 — Model name validation**: `ModelAssignment.model` must match `/^[a-zA-Z0-9._\/-]{1,64}$/`. Reject at config parse time. Allows `/` for provider-prefixed models (e.g., `openai/gpt-5.3`). Prevents injection when model names are interpolated into shell commands or API calls by downstream driver modules.
- **SC-8 — Config path validation**: `--config <path>` must be canonicalized via `fs.realpathSync()` and verified to end in `.toml`. This prevents reading arbitrary files (e.g., `/etc/shadow`) through the TOML parser, which could leak file contents in `ConfigValidationError.validationErrors`.

## Dependencies

### Internal (other specs in this project)
- None — this is a foundation spec.

### External (libraries, services)
- `commander` or `citty` — CLI framework
- `smol-toml` — TOML parser
- `zod` or `valibot` — runtime validation
- `tsup` or `esbuild` — bundler/compiler
- `vitest` — test runner
- `typescript` — type checking (strict: true)

## Out of Scope

- Driver implementation (see `swarm-driver-system.spec.md`)
- Orchestration logic (see `swarm-planification-tdd.spec.md` and `swarm-development-loop.spec.md`)
- Agent prompts and schemas
- Git operations (branch, commit, PR)
- Documentation generation

## Acceptance Criteria

- [ ] `pnpm build` compiles TypeScript to `scripts/.local/share/swarm/dist/` without errors
- [ ] `tsconfig.json` has `strict: true` enabled
- [ ] After `stow scripts`, `swarm version` prints the version from package.json
- [ ] `swarm config --project-dir /path/to/project` prints resolved config with source file path
- [ ] Config resolution follows the 3-level precedence chain correctly
- [ ] Config is validated at runtime via Zod/Valibot — malformed TOML triggers typed errors
- [ ] NDJSON events match the discriminated union types (compile-time enforcement)
- [ ] Events are accumulated in memory and queryable via `getEvents()`
- [ ] `EPIPE` on stdout does not crash the process
- [ ] State file is created atomically (write-to-tmp + rename) with mode 0o600
- [ ] State file includes `schemaVersion` and is validated on load
- [ ] `load()` returns a discriminated `LoadResult` (not-found vs valid vs corrupt)
- [ ] Lock file uses atomic `O_CREAT | O_EXCL` creation
- [ ] Stale lock detection checks PID liveness
- [ ] Session IDs are validated against `/^[a-zA-Z0-9_-]{1,64}$/`
- [ ] `--spec` and `--project-dir` are canonicalized and validated
- [ ] `swarm run --dry-run` validates config and prints plan without invoking agents
- [ ] `swarm resume` on a completed session (done marker exists) returns a clear error
- [ ] `.stow-local-ignore` excludes all non-distributable files
- [ ] No `index.ts` barrel exports — all imports are direct
- [ ] `SwarmConfig.models` splits into `agents` (base roles) and `tagged` (overrides) maps
- [ ] `resolveSwarmConfig()` fills missing base roles with defaults — `getModelAssignment()` never misses
- [ ] Model names are validated against `/^[a-zA-Z0-9._\/-]{1,64}$/` at parse time (SC-7)
- [ ] `SwarmState.phaseResults` provides extensible storage for phase-specific data
- [ ] In-memory event accumulator is bounded to 10,000 events with FIFO eviction
- [ ] Signal handlers (`SIGTERM`/`SIGINT`/`SIGHUP`) use synchronous APIs only
- [ ] `swarm status` detects interrupted sessions (state file exists, no lock/done marker)
- [ ] `SessionContext` is created after pre-flight checks and passed to orchestration engine
- [ ] `assertNever` exhaustiveness helper is used in all `SwarmEvent.type` switch statements
- [ ] All tests pass with `pnpm test`
