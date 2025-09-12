## Development Workflow

After each phase of a feature is developed, you must:
1. Lint (`pnpm lint` or package-specific lint command)
2. Typecheck (if project is in typescript : `pnpm type-check` or package-specific typecheck command)
3. Test (`pnpm test` or package-specific test command)
4. Run security review with @agent-security-commit-guardian
5. Run code refactoring with @agent-code-refactor-specialist
6. Check and update project documentation if necessary:
   - Search for README.md and CLAUDE.md files in the project
   - For README.md: Add new features to feature list, update installation/setup instructions if changed, document new environment variables or configuration, update API documentation for new endpoints, add new commands or scripts to usage section
   - For CLAUDE.md: Update project-specific instructions to reflect changes in workflow, add new conventions or patterns used, document any new tools or dependencies
7. Commit changes with descriptive message   

## Code Refactor Specialist Agent Instructions

### Output Format Requirements
- **NEVER create any .md files** (REFACTORING_SUMMARY.md, ANALYSIS.md, etc.)
- **Always provide summary directly in chat** with clear, concise bullet points
- Focus on actionable changes and their business value
- Include before/after code snippets only when necessary for clarity

### Intelligent DRY Application Guidelines

**Core Principle**: Apply DRY only when it provides real value, not just for the sake of reducing lines.

### When TO Apply DRY:
✅ **Repeated business logic with same behavior**
```typescript
// ✅ GOOD - Same validation logic used everywhere
const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
```

✅ **Complex calculations or transformations used multiple times**
```typescript
// ✅ GOOD - Complex date formatting logic
const formatUserDate = (date: Date, timezone: string) => { /* complex logic */ }
```

✅ **Error handling patterns with consistent behavior**
```typescript
// ✅ GOOD - Consistent API error handling
const handleApiError = (error: ApiError) => { /* standardized handling */ }
```

### When NOT to Apply DRY:

❌ **Configuration-specific code that looks similar but serves different purposes**
```typescript
// ❌ BAD - Don't create "lib/env.ts" for Dockerfile-specific env vars
// Dockerfile env vars ≠ Node.js env vars ≠ Browser env vars

// ❌ BAD - Don't create "lib/paths.ts" for import paths
// Import paths are context-specific and not reusable logic
```

❌ **Similar-looking code with different semantics or future evolution paths**
```typescript
// ❌ BAD - User validation vs Product validation
// They might look similar now but will diverge with business requirements

// ❌ BAD - Development configs vs Production configs
// Similar structure but completely different purposes and lifecycles
```

❌ **Platform or environment-specific implementations**
```typescript
// ❌ BAD - Sharing code between server-side and client-side
// Different execution contexts require different approaches

// ❌ BAD - Mobile vs Desktop UI components that look similar
// Different interaction patterns and constraints
```

❌ **Temporary or transitional code**
```typescript
// ❌ BAD - Extracting utilities during migration periods
// Code in transition should not be abstracted until the migration is complete
```

### Smart Refactoring Decision Framework:

1. **Semantic Analysis**: Is the code truly doing the same thing, or just looking similar?
2. **Evolution Prediction**: Will these pieces likely evolve together or separately?
3. **Context Dependency**: Are the dependencies and constraints the same?
4. **Maintenance Burden**: Does the abstraction reduce or increase complexity?
5. **Team Boundaries**: Are these used by the same team or different teams?

### Refactoring Priorities (in order):

1. **Remove actual duplication** - Same logic, same purpose, same context
2. **Improve code clarity** - Extract meaningful abstractions with clear names
3. **Optimize performance** - Only if there are measurable bottlenecks
4. **Enhance type safety** - Strengthen TypeScript types without compromising readability
5. **Update patterns** - Apply modern patterns only if they improve maintainability

### Forbidden Abstractions:

- **Generic utilities** that serve one specific use case
- **Config/environment wrappers** unless there's complex transformation logic
- **Path/routing abstractions** that are just string concatenation
- **Type-only modules** that don't add semantic value
- **Over-parameterized functions** with multiple boolean flags
- **Premature abstractions** for code that might change

### Quality Gates Before Extraction:

1. **Usage Count**: Is it used in 3+ different contexts with identical behavior?
2. **Stability**: Has the pattern been stable for at least 2 weeks?
3. **Complexity**: Does the extraction simplify or complicate the codebase?
4. **Testing**: Can the extracted code be easily unit tested in isolation?
5. **Documentation**: Can the purpose be explained in one clear sentence?

## Important note
- You should always use pnpm, never npm or yarn, pnpm is the main package manager.
- **YAML validation**: Always use `yamllint` for YAML file validation. NEVER use other Python YAML validators.
- **Fallback management**: Only implement fallbacks in case of absolute necessity or explicit user request. Default fallback implementations are generally inadequate and should be avoided.
- **NEVER bypass pre-commit hooks, linting, or type checking**: All checks must pass before committing. Fix all issues identified by pre-commit hooks, lint-staged, or any other validation tools. Bypassing these checks with flags like `--no-verify` is strictly forbidden.

## Protected Branches Policy
- **main** and **develop** branches are ALWAYS protected
- **NEVER work directly on main or develop branches**
- If you find yourself on main or develop branch, you MUST:
  1. Ask the user which branch they want to base their work on
  2. Create a new feature branch from the up-to-date base branch
  3. Switch to the new branch before making any changes
- Always ensure the base branch is up-to-date before creating the new branch

### JavaScript/TypeScript specific rules:
- **ALWAYS use `import`** - NEVER use `require()`
- **Always prioritize ES6/ESNext over CommonJS**
- **Always use arrow functions**: `const functionName = () => {}` instead of `function functionName() {}`
- **FORBIDDEN**: Never use IIFE syntax like `;(function() { ... })()`
- **Prioritize destructuring** whenever possible for cleaner code
- **NEVER use any in typescript** - any is completely forbidden, there is no case where any should be used
- **Always prioritize strong typing over unknown** - use unknown as last resort only
- **Avoid `as` casting** - use as casting as last resort, always try to avoid `as` (`as const` is acceptable)
- **Always prioritize reusability** - strong typed hardcoded values are only for specific use cases 
- **TypeScript imports**: When importing in TypeScript, if there are more than `../` in the path, use TypeScript paths with `@/` prefix instead
- **Import organization rules**:
  - **Always separate import and import type** - Put type imports at the end of imports section
  - **NEVER import React entirely** - Import only what you use: `import { useState, useEffect }` instead of `import React`
  - Use specific imports like `import type { ComponentRef }` instead of `React.ComponentRef`
- **Vitest testing**: When using Vitest, follow comprehensive best practices for reliable, maintainable tests. See detailed Vitest Best Practices section below
- **Control flow priority**: Use early returns to minimize indentation and simplify functions. Prefer simple `if` statements over complex nested conditions. Use `switch` statements only as a last resort when multiple conditions need to be evaluated
- **Code structure**: Avoid excessive nesting and indentation. Keep functions flat and readable through early returns and guard clauses
- **Unused variables**: Always remove unused variables that generate warnings rather than using workarounds to keep them
- **Deprecation policy**: Only deprecate APIs used by external applications. For internal code, remove unused code instead of deprecating

## Solution Philosophy: Simplest but Never Easiest

**Core Principle**: Always choose the simplest solution that maintains code quality and type safety. NEVER choose the easiest solution that compromises quality.

### TypeScript Type Issues:
- ❌ **EASIEST (FORBIDDEN)**: Remove types, use `any`, or ignore TypeScript errors
- ❌ **TOO COMPLEX**: Over-engineered generics with multiple constraints and complex utility types
- ✅ **SIMPLEST**: Add minimal, functional, strongly-typed solution that solves the exact problem

**Example - API Response Typing**:
```typescript
// ❌ EASIEST (FORBIDDEN)
const data: any = await response.json()

// ❌ TOO COMPLEX
type ApiResponse<T, K extends keyof T, U = Pick<T, K>> = {
  data: U extends infer R ? R : never
  meta: Record<string, unknown>
}

// ✅ SIMPLEST
type UserResponse = {
  data: User
  meta: { total: number }
}
```

### Error Handling:
- ❌ **EASIEST (FORBIDDEN)**: Ignore errors, use empty catch blocks, or suppress warnings
- ❌ **TOO COMPLEX**: Complex error hierarchies with multiple inheritance levels
- ✅ **SIMPLEST**: Proper error handling with clear, actionable error messages and appropriate error types

### State Management:
- ❌ **EASIEST (FORBIDDEN)**: Global variables, direct DOM manipulation, or uncontrolled mutations
- ❌ **TOO COMPLEX**: Over-abstracted state machines for simple boolean flags
- ✅ **SIMPLEST**: Use appropriate state management for the scope (local state for components, context for shared state, proper state managers for complex apps)

### Function Design:
- ❌ **EASIEST (FORBIDDEN)**: Huge functions that do everything, copy-paste code
- ❌ **TOO COMPLEX**: Micro-functions for every operation, over-abstracted utilities
- ✅ **SIMPLEST**: Single-responsibility functions with clear names and proper abstraction level

### Import Management:
- ❌ **EASIEST (FORBIDDEN)**: Import entire libraries for one function (`import * as _`)
- ❌ **TOO COMPLEX**: Create elaborate barrel exports for simple utilities
- ✅ **SIMPLEST**: Import only what you need with clear, descriptive imports

### Performance Optimization:
- ❌ **EASIEST (FORBIDDEN)**: Ignore performance issues, use `setTimeout` hacks
- ❌ **TOO COMPLEX**: Premature optimization with complex memoization everywhere
- ✅ **SIMPLEST**: Profile first, optimize bottlenecks with appropriate techniques (useMemo, useCallback only when needed)

### Testing:
- ❌ **EASIEST (FORBIDDEN)**: Skip tests, mock everything to avoid real testing
- ❌ **TOO COMPLEX**: Test every internal implementation detail with complex mocks
- ✅ **SIMPLEST**: Test behavior and public APIs, mock external dependencies only

## Vitest Best Practices: Complete Testing Guide

### Core Testing Philosophy
- **Test behavior, not implementation**: Focus on what your code does, not how it does it
- **Isolate dependencies**: Mock external dependencies to test your code in isolation
- **Maintain test independence**: Each test should run independently without relying on others
- **Keep tests simple**: One assertion per test when possible, clear test names

### Mock Cleanup (CRITICAL)
**ALWAYS clean up mocks between tests** - This is the #1 cause of flaky tests:

```typescript
// ✅ CORRECT - Automatic cleanup in vitest.config.ts
export default defineConfig({
  test: {
    restoreMocks: true,    // Automatically restore vi.spyOn mocks
    clearMocks: true,      // Clear mock history and reset implementation
    unstubGlobals: true,   // Clean vi.stubGlobal between tests
  }
})

// ✅ CORRECT - Manual cleanup in test files
describe('Test Suite', () => {
  afterEach(() => {
    vi.clearAllMocks()     // Clear call history but keep implementation
    vi.restoreAllMocks()   // Restore original implementations
    vi.unstubAllGlobals()  // Restore global properties
    vi.useRealTimers()     // Restore real timers if using fake ones
  })
})

// ❌ WRONG - No cleanup leads to test interference
describe('Flaky Tests', () => {
  // Tests influence each other, causing random failures
})
```

### Function Mocking Strategies

**vi.fn() vs vi.spyOn() - When to Use Each:**

```typescript
// ✅ vi.fn() - Create standalone mock functions
const mockCallback = vi.fn()
const mockFetch = vi.fn().mockResolvedValue({ ok: true })

// ✅ vi.spyOn() - Observe existing functions while keeping original behavior
const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
const mathSpy = vi.spyOn(Math, 'random').mockReturnValue(0.5)

// ✅ Partial mocking - Mock only specific methods
vi.spyOn(MyClass.prototype, 'method').mockReturnValue('mocked')

// ❌ WRONG - Don't create unnecessary spies
const unnecessarySpy = vi.spyOn(obj, 'method') // If you don't need to observe
```

### Module Mocking Best Practices

**Hoisted Mocks for Better Control:**
```typescript
// ✅ CORRECT - Use vi.hoisted() for shared mock references
const mockLogger = vi.hoisted(() => ({
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn()
}))

vi.mock('./logger', () => mockLogger)

describe('Tests', () => {
  it('should log info', () => {
    myFunction()
    expect(mockLogger.info).toHaveBeenCalledWith('Expected message')
  })
})

// ✅ CORRECT - Partial module mocking
vi.mock('./utils', async () => {
  const actual = await vi.importActual('./utils')
  return {
    ...actual,
    dangerousFunction: vi.fn().mockReturnValue('safe-value')
  }
})

// ❌ WRONG - Don't mock everything when you need some real functionality
vi.mock('./utils', () => ({
  // This breaks all other functions you might need
  onlyMockingThis: vi.fn()
}))
```

### Global Property Mocking

**Environment-Safe Global Mocking:**
```typescript
// ✅ CORRECT - Use vi.stubGlobal() for clean mocking
describe('Environment Detection', () => {
  it('should detect browser environment', () => {
    vi.stubGlobal('process', undefined)
    vi.stubGlobal('window', { location: { href: 'https://example.com' } })
    vi.stubGlobal('document', { createElement: vi.fn() })
    
    expect(detectEnvironment()).toBe('browser')
  })

  it('should detect Node.js environment', () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    vi.stubGlobal('process', { 
      versions: { node: '18.0.0' },
      env: { NODE_ENV: 'test' }
    })
    
    expect(detectEnvironment()).toBe('nodejs')
  })
})

// ❌ WRONG - Manual property manipulation
Object.defineProperty(globalThis, 'window', { value: undefined }) // Hard to clean up
delete globalThis.process // Can cause issues
```

### Time and Timer Mocking

**Proper Timer Mocking:**
```typescript
// ✅ CORRECT - Mock timers properly with cleanup
describe('Async Operations', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers() // CRITICAL: Always restore real timers
  })

  it('should handle delayed operations', async () => {
    const callback = vi.fn()
    setTimeout(callback, 1000)
    
    await vi.advanceTimersByTimeAsync(1000)
    expect(callback).toHaveBeenCalled()
  })

  it('should mock system time', () => {
    const mockDate = new Date('2024-01-01')
    vi.setSystemTime(mockDate)
    
    expect(new Date()).toEqual(mockDate)
  })
})

// ❌ WRONG - Forgetting to restore timers affects other tests
vi.useFakeTimers()
// Test code...
// Forgot vi.useRealTimers() - breaks subsequent tests
```

### Network Request Mocking

**API Mocking Strategies:**
```typescript
// ✅ CORRECT - Mock fetch with proper error handling
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

it('should handle API success', async () => {
  mockFetch.mockResolvedValue({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: 'success' })
  })
  
  const result = await apiCall('/users')
  expect(result.data).toBe('success')
})

it('should handle API errors', async () => {
  mockFetch.mockResolvedValue({
    ok: false,
    status: 404,
    statusText: 'Not Found'
  })
  
  await expect(apiCall('/nonexistent')).rejects.toThrow('Not Found')
})

// ✅ CORRECT - Use MSW for complex API mocking
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'

const server = setupServer(
  http.get('/api/users', () => {
    return HttpResponse.json({ users: [] })
  })
)

beforeAll(() => server.listen())
afterAll(() => server.close())
afterEach(() => server.resetHandlers())
```

### File System Mocking

**Safe File System Testing:**
```typescript
// ✅ CORRECT - Use memfs for file system mocking
import { fs } from 'memfs'

vi.mock('node:fs/promises', () => fs.promises)
vi.mock('node:fs', () => fs)

describe('File Operations', () => {
  beforeEach(() => {
    // Create in-memory file system
    fs.mkdirSync('/test', { recursive: true })
    fs.writeFileSync('/test/config.json', '{"setting": "value"}')
  })

  afterEach(() => {
    fs.rmSync('/test', { recursive: true, force: true })
  })

  it('should read configuration', async () => {
    const config = await readConfig('/test/config.json')
    expect(config.setting).toBe('value')
  })
})

// ❌ WRONG - Don't mock with incomplete implementations
vi.mock('fs', () => ({
  readFileSync: vi.fn().mockReturnValue('{}') // Too simplistic
}))
```

### Advanced Assertions

**Use Vitest's Powerful Assertions:**
```typescript
// ✅ CORRECT - Use specific assertions
expect(mockFunction).toHaveBeenCalledTimes(1)
expect(mockFunction).toHaveBeenCalledWith('exact', 'arguments')
expect(mockFunction).toHaveBeenNthCalledWith(2, 'second', 'call')
expect(mockFunction).toHaveBeenLastCalledWith('last', 'call')
expect(mockFunction).toHaveReturnedWith('expected-value')

// ✅ CORRECT - Use asymmetric matchers
expect(apiCall).toHaveBeenCalledWith({
  id: expect.any(String),
  timestamp: expect.any(Number),
  metadata: expect.objectContaining({
    source: 'test'
  })
})

// ❌ WRONG - Manual call inspection
expect(mockFunction.mock.calls).toHaveLength(1) // Use toHaveBeenCalledTimes instead
expect(mockFunction.mock.calls[0]).toEqual([...]) // Use toHaveBeenCalledWith instead
```

### Common Anti-Patterns to Avoid

**Testing Implementation vs Behavior:**
```typescript
// ❌ WRONG - Testing implementation details
it('should call private method', () => {
  const spy = vi.spyOn(instance, '_privateMethod')
  instance.publicMethod()
  expect(spy).toHaveBeenCalled() // Don't test private methods
})

// ✅ CORRECT - Test behavior and outcomes
it('should process data correctly', () => {
  const result = instance.publicMethod(inputData)
  expect(result).toEqual(expectedOutput) // Test what the user sees
})
```

**Over-Mocking:**
```typescript
// ❌ WRONG - Mocking everything makes tests brittle
vi.mock('./utils', () => ({
  validate: vi.fn().mockReturnValue(true),
  transform: vi.fn().mockReturnValue('transformed'),
  save: vi.fn().mockResolvedValue(undefined)
}))

// ✅ CORRECT - Mock only external dependencies
vi.mock('./database') // Mock I/O
vi.mock('./logger') // Mock side effects
// Keep pure functions and business logic real
```

### Configuration Best Practices

**Optimal vitest.config.ts:**
```typescript
export default defineConfig({
  test: {
    globals: true,           // Use global describe, it, expect
    environment: 'node',     // Or 'jsdom' for DOM testing
    restoreMocks: true,      // Auto-restore spies
    clearMocks: true,        // Auto-clear mock history
    unstubGlobals: true,     // Auto-unstub globals
    mockReset: false,        // Keep false to preserve mock implementations
    coverage: {
      provider: 'v8',        // Use V8 for better performance
      reporter: ['text', 'html', 'json'],
      exclude: ['**/*.test.ts', '**/*.spec.ts', '**/node_modules/**']
    },
    setupFiles: ['./test/setup.ts'], // Global test setup
  }
})
```

### Testing Decision Framework
1. **Does this test verify user-facing behavior?** (If no, reconsider the test)
2. **Are mocks minimal and necessary?** (Mock I/O, keep business logic real)
3. **Will this test catch real bugs?** (Integration tests often catch more bugs)
4. **Is the test independent and deterministic?** (No shared state between tests)
5. **Does the test fail for the right reasons?** (Test the failure cases too)

**Decision Framework**:
1. Does this solution maintain type safety? (If no, it's easiest, not simplest)
2. Does this solution solve the exact problem without over-engineering? 
3. Is this solution maintainable and readable?
4. Will this solution scale appropriately with the codebase?

## Global instructions

### Comments guidelines:
- Add comments sparingly, only for complex features requiring explanation
- Comments should be concise and comprehensible
- **Comments MUST be in English only** - never use other languages
- **NEVER add comments in JSON files** - JSON does not support comments and they will make the file invalid

## Claude Code Advanced Features

### Custom Commands
The following custom commands are available for streamlined development:

#### Development Workflow Commands
- **`/check-pr`** - Complete PR pipeline: lint → typecheck → test → security review → refactor → commit → create PR with gprc
- **`/quick-fix`** - Quick fix for small changes: lint + commit + push (skips tests for speed)
- **`/feature-start [name]`** - Start new feature: create branch from updated base and initialize todos
- **`/feature-complete`** - Complete feature: run full checks, squash commits if needed, and create PR

#### Testing and Analysis Commands
- **`/test-watch [pattern]`** - Launch Vitest in watch mode with coverage and smart filtering
- **`/deps-check`** - Comprehensive dependency analysis: outdated, audit, unused imports, suggestions
- **`/perf-check`** - Performance analysis: build time, bundle size, optimization suggestions

#### Dotfiles Management Commands
- **`/stow-sync`** - Synchronize dotfiles with GNU Stow, checking conflicts and ensuring proper linking

### Automatic Hooks
The following hooks run automatically to enhance your workflow:

#### PostToolUse Hooks
- **log-commands** - Logs all bash commands with timestamp and git context to `~/.claude/command-history.log`

#### PreToolUse Hooks
- **validate-imports** - Validates import statements before editing files to enforce coding standards:
  - Blocks `require()` usage in favor of `import`
  - Warns about deep relative imports (`../../../`) suggesting `@/` paths
  - Detects React default imports suggesting specific imports
  - Prevents IIFE syntax usage
  - Blocks `any` type usage in TypeScript

#### UserPromptSubmit Hooks
- **context-enhancer** - Automatically adds git context and branch warnings to prompts:
  - Shows current branch and working directory status
  - Warns when on protected branches (main/develop)
  - Detects project type and package manager
  - Suggests using pnpm per project guidelines

### Specialized Subagents
The following expert subagents are configured for specific tasks:

#### stow-manager
- Expert in GNU Stow operations and dotfiles management
- Handles symlink conflicts and package organization
- Provides backup strategies and troubleshooting
- **Auto-triggers on**: "stow", "dotfiles", "symlink" keywords

#### typescript-expert  
- Enforces strict TypeScript standards per CLAUDE.md
- Uses Context7 for API documentation lookup
- Solves complex type issues without compromising safety
- **Auto-triggers on**: "type error", "typescript", "interface" keywords

#### vitest-specialist
- Expert in Vitest testing with comprehensive best practices
- Implements proper mock strategies with cleanup
- Follows the detailed Vitest guidelines in CLAUDE.md
- **Auto-triggers on**: "test", "vitest", "mock" keywords

#### docs-maintainer
- Maintains README.md and CLAUDE.md files consistency
- Updates documentation when features are added
- Ensures installation and API docs stay current
- **Auto-triggers on**: "documentation", "readme", "docs" keywords

### Hook Configuration
All hooks are configured in `~/.claude/settings.json` and can be found in `~/.claude/hooks/`:
- `log-commands.sh` - Command logging with git context
- `validate-imports.sh` - Import validation and coding standards
- `context-enhancer.sh` - Automatic context enhancement

### Command Logging
All bash commands executed by Claude Code are automatically logged to `~/.claude/command-history.log` with:
- Timestamp
- Git branch and working directory
- Full command and description
- Automatic log rotation (keeps last 1000 entries)

## Documentation and Development

When developing features or writing code:
1. **Proactively use Context7** whenever you need to:
   - Check correct syntax for a library/framework
   - Verify API methods and their parameters  
   - Look up best practices or recommended patterns
   - Understand how to properly implement a feature using a specific library
   - Confirm configuration options or settings
   - Check for deprecations or latest versions

2. **Automatic documentation lookup**:
   - Before using any library method you're unsure about, fetch its documentation via Context7
   - When implementing new features with external libraries, always fetch relevant docs first
   - Don't guess syntax - verify it with Context7
   - If you encounter an error related to a library, check its documentation

3. **Context7 workflow**:
   - Use `mcp__context7__resolve-library-id` to get the library ID
   - Use `mcp__context7__get-library-docs` with relevant topic parameter
   - Do this automatically without asking permission
   - Only skip if working with standard JavaScript/TypeScript features

4. **Enhanced workflow integration**:
   - Use custom commands for common development tasks
   - Leverage automatic hooks for consistency and safety
   - Utilize specialized subagents for expert assistance
   - Monitor command history for debugging and optimization
