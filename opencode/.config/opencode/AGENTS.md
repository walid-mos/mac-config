# Global OpenCode Instructions

## Communication Style

- Concise and direct
- No emojis unless explicitly requested
- Technical accuracy over validation
- **English ONLY** - All responses, code, comments, commits in English
- User may write in French, but always respond in English

---

## CORE PRINCIPLES (MANDATORY)

### Simplest but Never Easiest

Choose the simplest solution maintaining code quality and type safety. NEVER choose the easiest solution that compromises quality.

**Decision Framework:**

1. Does this maintain type safety? (If no, it's easiest, not simplest)
2. Does this solve the exact problem without over-engineering?
3. Is this maintainable and readable?
4. Will this scale appropriately?

### Composition Over Inheritance

Composition is PRIMARY for code reuse. Inheritance ONLY for shallow, true "is-a" relationships.

```typescript
// GOOD: Interface composition
interface User extends Identifiable, Timestamped {
  name: string;
}

// GOOD: Dependency injection
class UserService {
  constructor(
    private logger: Logger,
    private storage: Storage,
  ) {}
}

// BAD: Inheritance for code reuse
class UserService extends BaseService {} // Tight coupling
```

### Early Returns & No Else

Handle simple/edge cases first with early returns. Almost NEVER use `else`.

```typescript
// GOOD
function getDiscount(user: User): number {
  if (user.isPremium) return 0.2;
  if (user.isVeteran) return 0.15;
  return 0;
}

// BAD
if (condition) {
  /* complex */
} else {
  /* simple */
}
```

### No Fallbacks (MANDATORY)

NEVER add fallback values or defensive defaults unless EXPLICITLY requested.

**FORBIDDEN without explicit request:**

- `?? 'default'`, `|| fallback`
- Fallback UI states ("No data available")
- `process.env.X || 'value'`

```typescript
// FORBIDDEN
const name = user?.name ?? "Unknown";

// CORRECT - Let it fail explicitly
const name = user.name;
if (!name) throw new Error("Name required");
```

### Function Extraction Rules

Functions exist to implement FEATURES, not wrap trivial operations.

**Extract when:**

- Feature with real business logic (3+ meaningful lines)
- Composition via DI/interfaces
- Reused in 3+ places with identical behavior
- Complex conditional with clear semantic meaning

**Don't extract:**

- Simple 1-2 line wrappers
- Configuration getters
- Single-use "helper" functions

---

## SECURITY (MANDATORY)

**NEVER:**

- Expose or log secrets/keys/tokens/PII
- Commit secrets to git
- Include credentials in code

**ALWAYS:**

- Use environment variables for sensitive data
- Validate env vars at startup
- Add .env files to .gitignore

---

## BRANCH PROTECTION (MANDATORY)

**NEVER** work directly on main/develop branches.

```bash
# GOOD
git checkout main && git pull && git checkout -b feature/new-feature

# BAD - Direct work on main
git checkout main && # start making changes
```

---

## GIT WORKFLOW

**Conventional Commits:** `type(scope): description`

Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`

```bash
git commit -m "feat(auth): add email verification"
git commit -m "fix(api): handle null response"
```

**Rules:**

- Check `git status` before/after commits
- NEVER use `--no-verify` flag
- NEVER force push to main/master without explicit request
- All commit messages in English

---

## CONTEXT7 (CRITICAL)

**ALWAYS use Context7 proactively** for:

- Code generation with libraries/frameworks
- Library/API documentation
- Up-to-date code examples
- Configuration of dev tools

**Workflow:**

1. `resolve-library-id` - Get Context7-compatible library ID
2. `get-library-docs` - Fetch documentation with appropriate topic
3. Use multiple pages if context insufficient

**When to use:**

- User asks how to use a library/framework
- Need code examples with specific API
- Configuration of dev tools (Next.js, React, Astro, etc.)
- Recent syntax or patterns

**Anti-Hallucination Rules:**

- NEVER claim Context7 is unavailable without calling the tool
- If `[Context7: ...]` appears in prompt, you MUST call the tool
- If first call fails, RETRY
- FORBIDDEN phrases without actual tool call:
  - "Context7 isn't available"
  - "I don't have access to Context7"
  - "Let me search manually instead"

---

## WORKFLOW RULES

### Development Pipeline

```
Develop -> Lint -> Typecheck -> Test -> Review -> Commit
```

**Before commit:**

- Zero lint errors/warnings
- Zero type errors
- All tests pass
- `git diff` review (no debug statements, no commented code)

### Package Manager Detection

1. `pnpm-lock.yaml` -> pnpm
2. `package-lock.json` -> npm
3. `yarn.lock` -> yarn
4. Default -> pnpm

NEVER mix package managers.

### Interactive Commands

Claude's subshells do NOT support interactive input.

1. Check Context7 for non-interactive flags (`--yes`, `-y`, `--no-input`)
2. If exists, use non-interactive mode
3. If truly interactive, ask user to run manually

```bash
# BAD - Interactive
npx create-next-app

# GOOD - Non-interactive
npx create-next-app my-app --typescript --tailwind --eslint --app --use-pnpm
```

---

## SUBAGENTS

Mention these agents when needed:

| Agent                | When to Use                                             |
| -------------------- | ------------------------------------------------------- |
| `@fallback-detector` | Before `git commit` to scan for error-masking fallbacks |
| `@nextnode-brand`    | When working on NextNode projects                       |
| `@code-refactor`     | For comprehensive refactoring with 100% coverage        |
| `@security-review`   | For OWASP-based security audits                         |
| `@project-scanner`   | For codebase analysis & improvement plans               |

---

## QUICK REFERENCE

**Before ANY work:**

- [ ] Not on main/develop branch?

**During development:**

- [ ] Strong typing (no `any`)
- [ ] Functions for features, not wrappers
- [ ] Composition over inheritance
- [ ] Early returns, no else
- [ ] No fallbacks without explicit request

**Before commit:**

- [ ] Lint passed
- [ ] Type-check passed
- [ ] Tests passed
- [ ] No secrets exposed
- [ ] Conventional commit message
- [ ] @fallback-detector scan (for important commits)

---

## Stow Deployment

This file is managed by GNU Stow:

- Source: `~/.stow_repository/opencode/.config/opencode/AGENTS.md`
- Target: `~/.config/opencode/AGENTS.md`

Deploy: `cd ~/.stow_repository && stow opencode`
