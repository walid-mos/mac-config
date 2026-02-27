# Swarm Driver System — Spec

## Overview

Backend abstraction layer for the swarm orchestrator. Defines a unified `Driver` interface for invoking AI agents, then implements two concrete drivers: Claude Code (`claude -p`) and OpenCode (`opencode run`). Includes model routing from the TOML config to dispatch each agent role to the correct backend and model.

## Context

Swarm uses multiple LLMs for different tasks: Claude for planning and review, Codex for backend code, Gemini for frontend code, GPT-5.3 for testing and security, Kimi K2.5 for documentation. These models are accessed through two CLI tools:

- **Claude Code** (`claude -p`): for Anthropic models (Claude Opus, Sonnet)
- **OpenCode** (`opencode run --format json`): for everything else (OpenAI, Google, Moonshot models via provider routing)

The driver system abstracts these differences behind a single interface. The orchestration engine (separate spec) calls `driver.invoke()` without knowing which backend is running underneath.

This spec depends on the config system from `swarm-cli-config-events.spec.md` for model routing.

## Functional Requirements

- **FR-1**: Define a `Driver` TypeScript interface with two methods:
  - `invoke(request: AgentRequest): Promise<AgentResult>` — send a prompt to an AI agent and get a structured response. The promise never rejects — errors are encoded in the `AgentResult` discriminated union.
  - `checkAvailability(): Promise<DriverAvailability>` — verify the backend CLI is installed and accessible, returning version or diagnostic error
- **FR-2**: Implement a `ClaudeDriver` that invokes `claude -p` as a child process. It must:
  - Build the command: `claude -p --output-format json --verbose --permission-mode bypassPermissions --no-session-persistence --cwd <projectDir> --model <model>`
  - Add `--agent <name>` when an agent definition is specified
  - Add `--json-schema <content>` when a JSON schema is provided (content must be valid JSON, validated before passing)
  - Pipe the prompt via stdin
  - Unset env vars that trigger nested session detection: `CLAUDECODE`, `CLAUDE_CODE_ENTRYPOINT`, `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`
  - Parse Claude's streaming event array output to extract the result using the shared output parser (see Source File Structure)
  - Handle multiple fallback extraction strategies: direct `.result`, raw content, markdown fence stripping
- **FR-3**: Implement an `OpenCodeDriver` that invokes `opencode run` as a child process. It must:
  - Build the command: `opencode run --format json --model <provider/model>`
  - Support `--file <path>` for attaching context files (paths must be validated — see Security Constraints)
  - Parse OpenCode's JSON event stream to extract the final result using the shared output parser
  - Support `--attach <url>` for connecting to a persistent `opencode serve` instance (URL must be validated — see Security Constraints)
- **FR-4**: Implement a `createDriverRegistry()` factory function that:
  - Instantiates both `ClaudeDriver` and `OpenCodeDriver` eagerly at creation time. Drivers are stateless (no connections, no resource pooling), so eager instantiation has no cost.
  - Maps backend names (`claude`, `opencode`) to driver instances
  - Accepts a `SwarmConfig` and `SwarmEventEmitter`, resolves which driver to use for each `AgentRole` + optional tag
  - Returns a `DriverResolution` (driver + model) for a given agent role via `getDriver(role, tag?)`
- **FR-5**: When a JSON schema is provided in the request, the driver must append a directive to the prompt instructing the model to output ONLY raw JSON matching the schema — no markdown fences, no narrative text, no commentary.
- **FR-6**: The driver must validate the extracted result as valid JSON when a schema was provided. If extraction fails after all fallback strategies, return a structured error with the raw output attached for debugging.
- **FR-7**: The driver must emit `agent:invoke` and `agent:result` (or `agent:error`) events via the `SwarmEventEmitter` from the events spec. Event payloads match the types defined in `swarm-cli-config-events.spec.md`. Note: `model` is serialized as plain string in NDJSON events (the `ModelId` brand is erased during serialization), matching the foundation spec's `AgentInvokeEvent.data.model: string` type.
- **FR-8**: The driver must enforce a configurable timeout per agent invocation (default: 10 minutes). If the child process exceeds the timeout, kill it and return a timeout error. The child process must be spawned with `detached: true` and killed via process group (`process.kill(-pid, signal)`) to prevent orphan child processes.
- **FR-9**: Implement a `checkAvailability()` method for each driver that verifies:
  - The CLI binary exists in PATH (`which claude` / `which opencode`)
  - The CLI responds to a version check (`claude --version` / `opencode --version`) within a 10-second hard timeout. If the command does not produce output within this window, return `{ available: false, error: '<binary> --version timed out' }`
  - Return the appropriate `DriverAvailability` discriminated union variant

## Data Model

```typescript
// Branded primitive — validated against /^[a-zA-Z0-9._\/-]{1,64}$/ at config parse time.
// The single `as ModelId` cast lives in resolveSwarmConfig(), matching SessionId precedent.
declare const _modelId: unique symbol
type ModelId = string & { readonly [_modelId]: true }

type BackendName = 'claude' | 'opencode'

// Driver interface
interface Driver {
  name: BackendName
  invoke(request: AgentRequest): Promise<AgentResult>
  checkAvailability(): Promise<DriverAvailability>
}

interface AgentRequest {
  prompt: string              // The prompt content (markdown)
  role: AgentRole             // Agent role — needed for event emission (agent:invoke, agent:result, agent:error)
  agent?: string              // Agent definition name — validated against /^[a-zA-Z0-9_-]{1,64}$/
  schema?: string             // JSON schema content for structured output — validated as parseable JSON before use
  model: ModelId              // Branded — must originate from a validated ModelAssignment
  projectDir: string          // Canonicalized absolute path (runtime-validated via realpathSync; not branded — canonicalization is inherently runtime)
  timeout?: number            // Timeout in ms (default: 600_000, min: 10_000, max: 3_600_000)
  contextFiles?: string[]     // OpenCode only (--file <path>). ClaudeDriver ignores this field. Canonicalized and verified under projectDir (DS-2).
  attachUrl?: string          // OpenCode only: URL for --attach to a persistent opencode serve instance (validated per DS-3)
  signal?: AbortSignal        // Node.js built-in global (not DOM). When aborted, driver kills child process immediately.
}

interface TokenUsage {
  input: number
  output: number
}

type AgentResult =
  | {
      success: true
      output: string            // The extracted result (raw text or JSON string)
      rawOutput: string         // Full raw stdout from the backend (truncated to 1MB max)
      stderr: string            // Captured stderr (truncated to 64KB max)
      model: ModelId
      backend: BackendName
      durationMs: number
      tokenUsage?: TokenUsage
    }
  | {
      success: false
      errorCode: 'timeout' | 'aborted' | 'crash' | 'empty_output' | 'invalid_json' | 'spawn_error'
      error: string             // Human-readable error message
      rawOutput: string         // Partial stdout captured before failure (truncated to 1MB max)
      stderr: string            // Captured stderr (truncated to 64KB max)
      model: ModelId
      backend: BackendName
      durationMs: number
      // tokenUsage intentionally absent: backends that error mid-run do not guarantee token counts.
    }

type DriverAvailability =
  | { available: true; version: string }
  | { available: false; error: string }

// Returned by DriverRegistry.getDriver() — named to allow future extension without breaking call sites.
interface DriverResolution {
  driver: Driver
  model: ModelId
}

// Registry
interface DriverRegistry {
  getDriver(role: AgentRole, tag?: string): DriverResolution
  // Both BackendName keys are always present. Unconfigured drivers return { available: false, error: 'not configured' }.
  checkAll(): Promise<Record<BackendName, DriverAvailability>>
}
```

## Source File Structure

```
src/
  drivers/
    driver.ts           # Driver interface, AgentRequest, AgentResult, DriverAvailability, DriverResolution, BackendName, ModelId, TokenUsage types
    claude-driver.ts     # createClaudeDriver() factory — spawns claude -p, parses streaming event output
    opencode-driver.ts   # createOpenCodeDriver() factory — spawns opencode run, parses JSON events
    driver-registry.ts   # createDriverRegistry() factory — resolves role+tag to driver+model
    output-parser.ts     # Shared structured output extraction: ParseResult type, parseStructuredOutput()
```

Test files follow the `*.test.ts` convention co-located with source or in a `tests/` directory, consistent with the foundation spec's Vitest setup.

No `index.ts` — no barrel exports. Consumers import directly: `import { createDriverRegistry } from './drivers/driver-registry.ts'`.

## API Contract

```typescript
// Driver factories (factory functions, not classes) — src/claude-driver.ts, src/opencode-driver.ts
function createClaudeDriver(emitter: SwarmEventEmitter): Driver
function createOpenCodeDriver(emitter: SwarmEventEmitter): Driver

// Creating the registry (factory function, not class)
const registry = createDriverRegistry(config, emitter)

// Check all backends are available before starting
const availability = await registry.checkAll()

// Get the right driver for a role (with optional tag for model override)
const { driver, model } = registry.getDriver('code', 'frontend')

// Invoke an agent — promise never rejects, errors are in the result
const result = await driver.invoke({
  prompt: plannerPromptContent,
  role: 'plan',
  agent: 'planification-agent',
  schema: planificationSchema,
  model,
  projectDir: '/path/to/project'
})

if (result.success) {
  const parsedOutput = JSON.parse(result.output)
} else {
  // result.errorCode tells you what failed (timeout, aborted, crash, etc.)
  console.error(result.error)
}
```

## Business Logic

### Model Names

The TOML config stores backend-specific model identifiers directly. No mapping table is needed — the driver passes the `model` string through to the CLI verbatim. Examples:

```toml
# swarm.toml — model names are backend-specific
[models]
plan     = { backend = "claude",   model = "opus" }           # claude -p --model opus
code     = { backend = "opencode", model = "openai/gpt-5.3-codex" }  # opencode run --model openai/gpt-5.3-codex
docs     = { backend = "opencode", model = "moonshot/kimi-k2.5" }     # opencode run --model moonshot/kimi-k2.5
```

This eliminates a mapping table, removes a source of drift, and makes adding new models a config-only change (no code modification required).

### Shared Output Parser

Both drivers use a shared `parseStructuredOutput()` function for JSON extraction. The function is format-agnostic — callers decide whether to require valid JSON based on whether a schema was provided.

```typescript
// src/drivers/output-parser.ts
type ParseResult =
  | { ok: true; output: string; strategy: 'event-array' | 'result-field' | 'direct' | 'fence-strip' | 'brace-extract' }
  | { ok: false; raw: string }

function parseStructuredOutput(raw: string): ParseResult
```

**Claude output format**: Claude with `--output-format json` emits a JSON array of streaming events. The result is in an element with `type === "result"`, under the `.result` field.

**OpenCode output format**: OpenCode with `--format json` emits a single JSON object with a `result` field containing the model's text response.

Extraction strategy (applied in order, first success wins):
1. Parse as JSON array, find element with `type === "result"`, extract `.result` (Claude event stream format) → `strategy: 'event-array'`
2. Parse as JSON object with `.result` field (OpenCode format, also matches single-element Claude output) → `strategy: 'result-field'`
3. Treat raw output as direct JSON (`JSON.parse(raw)`) → `strategy: 'direct'`
4. Strip markdown code fences (` ```json ... ``` `) and retry JSON parse → `strategy: 'fence-strip'`
5. Extract first `{` to last `}` as a JSON object candidate, fed to `JSON.parse()` — if it fails, this strategy fails. This is a best-effort heuristic for malformed output; upstream schema validation (orchestrator-level) provides the actual trust boundary. → `strategy: 'brace-extract'`
6. If all extraction fails, return `{ ok: false, raw }`

### Environment Sanitization (Claude Driver)

When spawning `claude -p`, the following environment variables must be unset to prevent nested session detection:
- `CLAUDECODE`
- `CLAUDE_CODE_ENTRYPOINT`
- `CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS`

The child process inherits `process.env` minus the three variables above. Backend CLIs require their own API keys (e.g., `ANTHROPIC_API_KEY`, `OPENAI_API_KEY`) from the inherited environment. DS-5 applies to the driver's own logging — the driver must never log the inherited environment object or individual key values.

### Timeout Handling

- The child process is spawned with `detached: true` for process group management.
- On timeout: send `SIGTERM` to the process group (`-pid`), allow stdout to drain for up to 5 seconds, then send `SIGKILL` to the process group if still alive. Returns `errorCode: 'timeout'`.
- Close stdin immediately on timeout to signal the process to stop.
- The timeout error includes the partial output captured so far. During the 5-second drain window, incoming stdout data continues to be appended to the buffer (subject to the 10MB cap). The buffer state at the end of the drain window becomes the final `rawOutput`.
- When an `AbortSignal` fires, apply the same SIGTERM → SIGKILL sequence immediately. Returns `errorCode: 'aborted'` (distinct from `'timeout'` so the caller can distinguish user cancellation from deadline expiry).
- All `process.kill(-pid, signal)` calls must be wrapped in `try/catch` to handle `ESRCH` (process already exited). This prevents crashes when the process terminates between the timeout trigger and the kill attempt.
- The shutdown sequence (SIGTERM → drain → SIGKILL) must be guarded by a `let killStarted = false` flag so that only the first trigger (timeout or abort, whichever fires first) executes the kill sequence. The second trigger is a no-op. The `errorCode` is determined by whichever trigger fires first.

### Input Validation (at invoke boundary)

Before spawning the child process, `invoke()` validates:
1. `signal` (if provided) is not already aborted — if `signal.aborted` is `true`, return `{ success: false, errorCode: 'aborted', ... }` immediately without spawning
2. `timeout` (if provided) is a positive integer between 10,000 (10s) and 3,600,000 (1h) — prevents nonsensical timer values
3. `model` matches `/^[a-zA-Z0-9._\/-]{1,64}$/` — defense-in-depth validation consistent with SC-7 from the foundation spec
4. `agent` (if provided) matches `/^[a-zA-Z0-9_-]{1,64}$/` — prevents argument injection (DS-1)
5. `schema` (if provided) is valid JSON (`JSON.parse()` succeeds) — prevents malformed CLI arguments
6. `contextFiles` (if provided) are canonicalized via `fs.realpathSync()` and verified to be under `projectDir` — prevents path traversal (DS-2)
7. `projectDir` is a real directory (`fs.statSync().isDirectory()`)
8. `attachUrl` (if provided) is parsed via `new URL()`. Verify `url.protocol === 'http:'` AND `url.hostname` is strictly one of `'localhost'`, `'127.0.0.1'`, or `'[::1]'`. Reject URLs with non-empty `username` or `password` components (prevents credential smuggling). Prevents SSRF (DS-3).

If any validation fails, return `{ success: false, errorCode: 'spawn_error', ... }` immediately without spawning. Exception: pre-aborted signal returns `errorCode: 'aborted'`.

## Edge Cases

- Claude CLI not installed: `checkAvailability()` returns `{ available: false, error: "claude not found in PATH" }`. The orchestrator can still run if no roles are assigned to the Claude backend.
- OpenCode not installed: same pattern.
- Backend process crashes (non-zero exit): capture stderr, return `{ success: false, errorCode: 'crash', ... }` with stderr and partial stdout.
- Backend produces empty output: return `{ success: false, errorCode: 'empty_output', ... }`.
- Backend produces valid JSON that doesn't match the schema: the driver does NOT validate against the schema — it only ensures the output is valid JSON. Schema compliance is the agent's responsibility.
- Very large output (>10MB): truncate `rawOutput` to 1MB, truncate `stderr` to 64KB, log a warning.
- Network errors during API calls (backend-level): the backend CLI handles retries internally. The driver only sees the final exit code.
- CLI binary disappears between `checkAll()` and `invoke()`: `invoke()` handles `ENOENT`/spawn errors gracefully, returning `{ success: false, errorCode: 'spawn_error', ... }`.
- Pre-aborted `AbortSignal`: if `signal.aborted` is already `true` when `invoke()` is called, return `errorCode: 'aborted'` immediately without spawning a child process.
- Concurrent timeout and abort: only the first trigger executes the kill sequence; the second is a no-op. `errorCode` reflects whichever fired first.
- `checkAvailability()` hangs: version check commands have a 10-second hard timeout. If exceeded, return `{ available: false, error: '<binary> --version timed out' }`.
- Truncation timing: `rawOutput` truncation (1MB) happens AFTER `parseStructuredOutput()` has processed the full buffer. The truncation applies only to the `rawOutput` field stored in the returned `AgentResult`, not to the internal buffer used for parsing.

## Security Constraints

- **DS-1 — Agent name validation**: `AgentRequest.agent` must match `/^[a-zA-Z0-9_-]{1,64}$/` when provided. Reject with `spawn_error` at the `invoke()` boundary.
- **DS-2 — Context file containment**: `AgentRequest.contextFiles` paths must be canonicalized via `fs.realpathSync()` and verified to be under `projectDir`. Prevents reading arbitrary files.
- **DS-3 — Attach URL restriction**: `--attach <url>` must be parsed via `new URL(attachUrl)`. Verify `url.protocol === 'http:'` AND `url.hostname` is strictly one of `'localhost'`, `'127.0.0.1'`, or `'[::1]'` (note: `new URL('http://[::1]:8080').hostname` returns `'[::1]'` with brackets in Node.js — check against the bracketed form). Reject all other hostnames (including encoded/octal/hex IP representations). Reject URLs with non-empty `username` or `password` components (prevents credential smuggling). Prevents SSRF.
- **DS-4 — No prompt logging**: Never log the full prompt content (may contain source code). Log only agent name, model, and prompt byte size.
- **DS-5 — No credential logging**: Never log API keys or tokens from the child process environment.
- **DS-6 — Raw output sensitivity**: `rawOutput` must never appear in NDJSON events (per SC-5 from foundation spec). It is available only in the in-memory `AgentResult` for the orchestrator's use.
- **DS-7 — Process group kill**: Child processes must be spawned with `detached: true` and killed via `-pid` (process group) to prevent orphaned sub-processes.
- **DS-8 — Bypass permissions rationale**: The `bypassPermissions` mode for Claude is intentional — swarm agents need full file system access. Acceptable because swarm operates in a worktree (isolated git branch).
- **DS-9 — Model name validation at invoke boundary**: `AgentRequest.model` must match `/^[a-zA-Z0-9._\/-]{1,64}$/` (same as SC-7 from foundation spec). Defense-in-depth — prevents injection if model values bypass config-time validation.

## Dependencies

### Internal (other specs in this project)
- `swarm-cli-config-events.spec.md`: `SwarmConfig`, `AgentRole`, `ModelAssignment`, `SwarmEventEmitter`, `getModelAssignment()`, `SessionContext`. `BackendName` is defined in this spec (`driver.ts`) and re-used by the foundation spec's `ModelAssignment.backend`.

### External (libraries, services)
- Node.js `child_process` (built-in) — for spawning CLI processes
- `claude` CLI — Claude Code (must be installed on the system)
- `opencode` CLI — OpenCode (must be installed on the system)

## Out of Scope

- Agent prompt templates and schemas (see `swarm-planification-tdd.spec.md`)
- Orchestration logic that decides which agents to call (see other specs)
- Worktree/git management
- Adding new backends beyond Claude and OpenCode
- Driver-level retry logic (the orchestration engine owns retry decisions)

## Acceptance Criteria

- [ ] `Driver` interface is defined with `invoke()` and `checkAvailability()` methods
- [ ] `invoke()` never rejects — errors are encoded in the `AgentResult` discriminated union
- [ ] `AgentResult` is a discriminated union with `success: true` and `success: false` variants
- [ ] `DriverAvailability` is a discriminated union with `available: true` and `available: false` variants
- [ ] `ClaudeDriver` spawns `claude -p` with correct flags and parses streaming event output
- [ ] `OpenCodeDriver` spawns `opencode run --format json` with correct flags and parses output
- [ ] `createDriverRegistry()` factory function resolves the correct driver + model for each agent role + tag from config
- [ ] Schema-enforced prompts append the JSON output directive
- [ ] Output parsing is shared via `output-parser.ts` — no duplication between drivers
- [ ] Output parsing handles all fallback strategies (event array, direct result, raw, fence stripping, brace extraction)
- [ ] Environment sanitization prevents nested session detection in Claude (3 env vars)
- [ ] Timeout kills the entire process group after the configured duration (SIGTERM → 5s → SIGKILL)
- [ ] `checkAvailability()` verifies the CLI binary exists and responds
- [ ] Agent names are validated against `/^[a-zA-Z0-9_-]{1,64}$/` at invoke boundary (DS-1)
- [ ] Context file paths are canonicalized and verified under projectDir (DS-2)
- [ ] `--attach` URLs are restricted to localhost (DS-3)
- [ ] `agent:invoke` and `agent:result`/`agent:error` events are emitted for every invocation
- [ ] `stderr` is captured and included in `AgentResult`
- [ ] `AbortSignal` cancellation kills the child process immediately and returns `errorCode: 'aborted'`
- [ ] Pre-aborted `AbortSignal` returns `errorCode: 'aborted'` immediately without spawning
- [ ] Concurrent timeout + abort triggers only one kill sequence (kill-guard flag)
- [ ] `AgentRequest.role` is passed through to event emission (no role guessing in drivers)
- [ ] `AgentRequest.attachUrl` is validated per DS-3 (parsed via `new URL()`, hostname strictly localhost/127.0.0.1/[::1])
- [ ] `parseStructuredOutput()` returns a discriminated `ParseResult` union with strategy tracking
- [ ] Process group kill calls handle `ESRCH` gracefully (process already exited)
- [ ] `ModelId` branded type is used for model identifiers (validated at config parse time, cast in `resolveSwarmConfig()`)
- [ ] `DriverResolution` named type is returned by `getDriver()` (not an anonymous object)
- [ ] `model` is validated at invoke boundary against `/^[a-zA-Z0-9._\/-]{1,64}$/` (DS-9)
- [ ] `timeout` values outside 10s-1h range are rejected at the invoke boundary
- [ ] `rawOutput` truncation (1MB) happens AFTER output parsing, not before
- [ ] `checkAvailability()` version check has a 10-second hard timeout
- [ ] `createClaudeDriver()` and `createOpenCodeDriver()` are factory functions (not classes)
- [ ] All tests pass with `pnpm test`
