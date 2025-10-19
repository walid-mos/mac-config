# Claude Code Configuration

## 🎯 QUICK REFERENCE

**Before ANY work:**
- [ ] ⛔ Not on main/develop branch?
- [ ] 📦 Using PNPM only?
- [ ] 🔒 Pre-commit hooks enabled?

**During development:**
- [ ] 📝 TypeScript strict mode
- [ ] 🎨 Tailwind inline (no constants except cva)
- [ ] 🧪 Tests written

**Before commit:**
- [ ] ✅ Lint passed (`pnpm lint`)
- [ ] ✅ Typecheck passed (`pnpm type-check`)
- [ ] ✅ Tests passed (`pnpm test`)
- [ ] 🔒 Security review (`@agent-security-commit-guardian`)
- [ ] ♻️ Refactor review (`@agent-code-refactor-specialist`)

**[Details below ↓]**

---

## ⚠️ CRITICAL RULES

<critical-rules>

### Branch Protection
**RULE**: Never work directly on main/develop branches
**DETECTION**: Current branch = main|develop
**ACTION**:
1. Ask user which branch to base work on
2. Create new feature branch from up-to-date base
3. Switch to new branch before making changes
**ENFORCEMENT**: PreToolUse hook blocks edits on protected branches

### Package Manager
**RULE**: PNPM only - never use npm or yarn
**DETECTION**: Commands containing `npm install`, `npm add`, `yarn add`, `yarn install`
**ACTION**: Replace with `pnpm add` or `pnpm install`
**ENFORCEMENT**: PreToolUse hook blocks npm/yarn commands

### Pre-commit Hooks
**RULE**: Never bypass with `--no-verify` - all checks must pass
**DETECTION**: Git commands with `--no-verify` flag
**ACTION**: Remove flag, fix issues, retry commit
**ENFORCEMENT**: Mandatory - no exceptions

### Security
**RULE**: Never expose or log secrets/keys/tokens
**DETECTION**: .env files, credentials.json, API keys in code
**ACTION**: Use environment variables, warn user if attempting to commit
**ENFORCEMENT**: Critical - always validate before commit

### YAML Validation
**RULE**: Always use `yamllint` for YAML files
**DETECTION**: .yml or .yaml file modifications
**ACTION**: Run `yamllint <file>` before commit
**ENFORCEMENT**: Required for YAML changes

</critical-rules>

---

## 🔄 MANDATORY WORKFLOW

<mandatory-workflow>

**Essential Pipeline**: Develop → Lint → Typecheck → Test → Security Review → Refactor → Commit

### After Each Development Phase:
1. **Lint** - `pnpm lint` (or package-specific lint command)
2. **Typecheck** - `pnpm type-check` (if TypeScript)
3. **Test** - `pnpm test` (or package-specific test command)
4. **Security Review** - Use `@agent-security-commit-guardian`
5. **Code Refactoring** - Use `@agent-code-refactor-specialist`
6. **Update Documentation** - README.md, CLAUDE.md if necessary
7. **Commit** - Descriptive message with proper format

### Exceptions:
- `/quick-fix` command: Auto-fixes linting, skips tests for speed (small changes only)
- `/check-pr` command: Runs full pipeline automatically

</mandatory-workflow>

---

## 📐 CODE STANDARDS

### TypeScript/JavaScript Rules
@claude/.claude/guidelines/typescript.md

**Quick Reference**:
- Strict mode enabled
- No `any` type (use `unknown` or proper types)
- ES6 imports only (no `require()`)
- Proper error handling with typed catches

### Naming Conventions (MANDATORY)
@claude/.claude/guidelines/naming-conventions.md

**Quick Reference**:
- camelCase: variables, functions
- PascalCase: components, classes, types
- UPPER_SNAKE_CASE: constants
- kebab-case: file names

### Intelligent Refactoring Guidelines
@claude/.claude/guidelines/refactoring.md

**Quick Reference**:
- Apply DRY only when it provides real value
- See `@agent-code-refactor-specialist` for detailed analysis
- Focus on semantic similarity, not visual similarity

### Tailwind CSS (MANDATORY when project uses Tailwind)
@claude/.claude/guidelines/tailwind.md

**Core Rules**:
- ✅ ALWAYS inline utility classes (primary method)
- ⛔ NEVER store in constants (except `cva` for component variants)
- ✅ MANDATORY: Use `cn()` utility when available

**cn() Organization (3 groups)**:
1. **Base**: structure, colors, typography (with dark: variants)
2. **Responsive**: one line per breakpoint (sm:, md:, lg:, xl:)
3. **States**: hover/focus/active (with dark: variants)

**Example**:
```tsx
<div className={cn(
  "flex items-center p-4 bg-white dark:bg-gray-800",  // Base
  "md:p-6 lg:p-8",                                     // Responsive
  "hover:shadow-lg dark:hover:shadow-xl",              // States
  isActive && "bg-blue-500"                            // Conditional
)}>
```

### Testing Guidelines
@claude/.claude/guidelines/vitest.md

**Quick Reference**:
- Test behavior, not implementation
- Always clean up mocks between tests
- Mock I/O, keep business logic real

---

## 🚫 ANTI-PATTERNS (Never Do This)

@claude/.claude/guidelines/anti-patterns.md

**Workflow Anti-Patterns**:
- ⛔ Working directly on main/develop → Always use feature branches
- ⛔ `--no-verify` flag → All pre-commit checks must pass
- ⛔ Committing without tests → Run full pipeline first

**Code Anti-Patterns**:
- ⛔ `const classes = "..."` with Tailwind → Use inline or cva only
- ⛔ `require()` in TypeScript → Use ES6 imports
- ⛔ `any` type → Use proper types or `unknown`
- ⛔ Deep inheritance hierarchies → Prefer composition (see 🏗️ COMPOSITION ARCHITECTURE)
- ⛔ Inheriting for code reuse → Use composition via DI or interfaces

**Tool Anti-Patterns**:
- ⛔ `npm install` or `yarn add` → Use `pnpm add` only
- ⛔ Skipping lint/typecheck → Must run before commit

**Why**: Each violation weakens type safety, consistency, or security.

---

## 🤖 SPECIALIZED SUBAGENTS

**AUTO-TRIGGER**: Use proactively without user asking when conditions match

### @agent-security-commit-guardian
**WHEN**:
- Code development complete
- User says "ready to commit" OR "create PR"
- After all tests pass
**NEVER**: During active development

### @agent-code-refactor-specialist
**WHEN**:
- Feature implementation complete
- Before commit/PR creation
- User says "done with X feature"
**NEVER**: During initial development

### @agent-vitest-specialist
**WHEN**: Keywords detected: "test", "vitest", "mock", "coverage"
**AUTO**: Complex test scenarios or mock setup

### @agent-typescript-expert
**WHEN**: Keywords detected: "type error", "typescript", "interface", "generic"
**AUTO**: Complex type issues, strict type enforcement

### @agent-stow-manager
**WHEN**: Keywords detected: "stow", "dotfiles", "symlink"
**AUTO**: GNU Stow operations, conflict resolution

### @agent-docs-maintainer
**WHEN**: Keywords detected: "documentation", "readme", "docs"
**AUTO**: README.md and CLAUDE.md consistency checks

---

## 💡 DEVELOPMENT PHILOSOPHY

### Core Principle: Simplest but Never Easiest
Always choose the simplest solution that maintains code quality and type safety. NEVER choose the easiest solution that compromises quality.

**Decision Framework**:
1. Does this solution maintain type safety? (If no, it's easiest, not simplest)
2. Does this solution solve the exact problem without over-engineering?
3. Is this solution maintainable and readable?
4. Will this solution scale appropriately with the codebase?

---

## 🏗️ COMPOSITION ARCHITECTURE

### Prefer Composition Over Inheritance

**RULE**: Composition is the PRIMARY pattern for code reuse. Inheritance ONLY for shallow, true "is-a" relationships.

**Why Composition?**
- ✅ Flexibility - Easy to change behavior and swap implementations
- ✅ Loose Coupling - No complex inheritance hierarchies
- ✅ Testability - Components tested in isolation
- ✅ SOLID Compliant - Open-Closed, Interface Segregation principles
- ✅ Maintainability - Avoids fragile base class problem

### Decision Matrix

**Use Composition When:**
- Need code reuse without "is-a" relationship
- Want runtime flexibility or behavior swapping
- Components share behavior but aren't subtypes

**Use Inheritance Only When:**
- Genuine "is-a" relationship exists (e.g., `Dog is Animal`)
- Hierarchy stays shallow (1-2 levels max)
- Base class designed for extension

### TypeScript Patterns

#### 1. Interface Composition (Preferred)
```typescript
// ✅ GOOD: Interface extends (fast, better errors)
interface Identifiable { id: string }
interface Timestamped { createdAt: Date; updatedAt: Date }
interface User extends Identifiable, Timestamped {
  name: string;
  email: string;
}

// ❌ AVOID: Type intersection (slower, worse errors)
type User = Identifiable & Timestamped & { name: string };
```

#### 2. Dependency Injection
```typescript
// ✅ GOOD: Compose via constructor injection
interface Logger { log(message: string): void }
interface Storage { save(key: string, value: any): Promise<void> }

class UserService {
  constructor(
    private logger: Logger,
    private storage: Storage
  ) {}
}

// ❌ AVOID: Inheritance for code reuse
class BaseService { protected log() {} }
class UserService extends BaseService {} // Tight coupling
```

#### 3. Utility Type Composition
```typescript
type PublicUser = Omit<User, 'password'>;
type UserUpdate = Partial<Pick<User, 'name' | 'email'>>;
```

### React Patterns

#### Component Composition
```typescript
// ✅ GOOD: Flexible composition with children
<Card>
  <CardHeader>Title</CardHeader>
  <CardBody>Content</CardBody>
</Card>
```

#### Custom Hooks
```typescript
// ✅ GOOD: Compose behavior via hooks
function SearchComponent() {
  const [query, setQuery] = useLocalStorage('search', '');
  const debouncedQuery = useDebounce(query, 300);
  // Composed behaviors without inheritance
}
```

### Validation Checklist

Before using inheritance, ask:
1. ⚠️ Is this a true "is-a" relationship?
2. ⚠️ Could composition work with more flexibility?
3. ⚠️ Will hierarchy stay shallow (1-2 levels)?
4. ⚠️ Am I inheriting just for code reuse?

**If "no" to #1 or "yes" to #2 or #4: Use composition instead.**

---

## 🛠️ ADVANCED FEATURES & CONFIGURATION

### Custom Commands

**Available commands** (format: Markdown files in `.claude/commands/`):

#### 🚀 Development Workflow
- **`/check-pr`** - Complete PR pipeline: lint → typecheck → test → security review → refactor → commit → create PR
- **`/quick-fix`** - Quick fix: auto-fix linting, smart commit, push (skips tests for speed)
- **`/feature-start [name]`** - Start feature: create branch from updated base with environment setup
- **`/feature-complete`** - Complete feature: full validation, optional squashing, production-ready PR

#### 🔍 Analysis & Testing
- **`/test-watch [pattern]`** - Vitest in watch mode with coverage, smart filtering
- **`/deps-check`** - Dependency analysis: outdated packages, security audit, unused imports
- **`/perf-check`** - Performance analysis: build time, bundle size, asset optimization

#### ⚙️ System Management
- **`/stow-sync`** - Synchronize dotfiles with GNU Stow: conflict detection, backup strategy
- **`/context7-add [libs...]`** - Add technologies to Context7 detection list with auto-resolution and smart categorization

### Automatic Hooks

#### Active Hooks
- **PostToolUse**: `log-commands` - Logs bash commands to `~/.claude/command-history.log`
- **PreToolUse**: `validate-imports` - Enforces import standards (blocks `require()`, `any` type)
- **UserPromptSubmit**: `context7-enhancer` - Detects library mentions and suggests using Context7 MCP for documentation

### Permission Configuration

**Allowed Operations**:
- Standard development tools (git, pnpm, node, docker, cargo)
- Read-only operations (find, grep, ls, cat, etc.)
- GitHub CLI read operations (repo view, pr list, etc.)
- Context7 MCP server, WebSearch, WebFetch
- Ghostty terminal configuration validation

**Restricted Operations**:
- Force push operations (`git push --force`)
- Destructive GitHub operations (repo delete, pr merge)
- Authentication modifications
- Workflow management

### MCP Servers

**Context7** - Library documentation and API reference
- Auto-resolves library IDs
- Fetches up-to-date documentation
- Integrated with TypeScript expert agent

**Workflow**: `resolve-library-id` → `get-library-docs` → implement

**Proactive Usage**:
1. Always fetch docs before using unfamiliar libraries
2. Verify syntax and parameters via Context7
3. Look up recommended patterns and deprecations

### Command Logging

All bash commands logged to `~/.claude/command-history.log`:
- Timestamp and git context
- Full command and description
- Automatic rotation (1000 entries)

### Essential Commands

```bash
pnpm lint              # Lint code
pnpm type-check        # TypeScript checking
pnpm test              # Run tests
yamllint file.yml      # YAML validation
ghostty +validate-config  # Validate Ghostty config
```

### Configuration Locations

- Settings: `~/.claude/settings.json`
- Hooks: `~/.claude/hooks/`
- Status: `~/.claude/statusline-command.sh`
- Guidelines: `~/.claude/guidelines/`
- Templates: `~/.claude/templates/`

---

## 📁 CLAUDE.md ORGANIZATION

### Global (~/.claude/CLAUDE.md) - THIS FILE

**Contains**:
- Universal workflows (Lint → Test → Commit)
- Code standards (TypeScript, naming, styling)
- Tool configuration (PNPM, hooks, subagents)
- Security rules
- Development philosophy

**Does NOT contain**:
- Project architecture
- Business logic patterns
- Project-specific commands
- Tech stack details

### Project (./CLAUDE.md) - IN EACH REPO

**Contains**:
- Repository overview & purpose
- Architecture & folder structure
- Tech stack & dependencies
- Key commands specific to THIS project
- Important files & their locations
- Project-specific workflows

**Does NOT contain**:
- Generic coding standards (use global)
- Tool configurations (use global)
- Universal workflows (use global)

**Template**: `~/.claude/templates/project-CLAUDE.md`

---

## 🎓 ENHANCED WORKFLOW INTEGRATION

- Use custom commands for common development tasks
- Leverage automatic hooks for consistency and safety
- Utilize specialized subagents for expert assistance
- Monitor command history for debugging and optimization
- Proactively use Context7 for library documentation and best practices
- Follow the mandatory workflow for all development work
- Respect critical rules at all times - they exist to maintain code quality and security
