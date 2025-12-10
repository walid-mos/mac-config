# Global Gemini Code Instructions

Universal instructions for Gemini Code across all projects.

## Communication Style

- Concise and direct
- No emojis unless explicitly requested
- Focus on technical accuracy over validation
- **English ONLY** - All responses, code, comments, commits in English
- User may write in French, but Gemini responds in English always

---

## CORE PRINCIPLES (MANDATORY)

These principles are MANDATORY and must be applied to ALL code development. They take precedence over any other considerations.

### Development Philosophy: Simplest but Never Easiest

**Core Principle**: Always choose the simplest solution that maintains code quality and type safety. NEVER choose the easiest solution that compromises quality.

#### Decision Framework

Before implementing any solution, ask:

1. **Does this solution maintain type safety?** (If no, it's easiest, not simplest)
2. **Does this solution solve the exact problem without over-engineering?**
3. **Is this solution maintainable and readable?**
4. **Will this solution scale appropriately with the codebase?**

#### DRY and SOLID Principles

**DRY (Don't Repeat Yourself)**:
- Apply DRY only when it provides real value, not just to reduce lines
- Repeated business logic with same behavior → Extract
- Configuration-specific code → Don't extract
- Similar-looking code with different semantics → Don't extract
- See `guidelines/refactoring.md` for detailed guidance

**SOLID Principles**:
- **S**ingle Responsibility - Each function/class has one clear purpose
- **O**pen/Closed - Open for extension, closed for modification
- **L**iskov Substitution - Subtypes must be substitutable for base types
- **I**nterface Segregation - Many specific interfaces over one general
- **D**ependency Inversion - Depend on abstractions, not concretions

---

### Composition Over Inheritance

**RULE**: Composition is the PRIMARY pattern for code reuse. Inheritance ONLY for shallow, true "is-a" relationships.

#### Why Composition?

- ✅ Flexibility - Easy to change behavior and swap implementations
- ✅ Loose Coupling - No complex inheritance hierarchies
- ✅ Testability - Components tested in isolation
- ✅ SOLID Compliant - Open-Closed, Interface Segregation principles
- ✅ Maintainability - Avoids fragile base class problem

#### Decision Matrix

**Use Composition When:**
- Need code reuse without "is-a" relationship
- Want runtime flexibility or behavior swapping
- Components share behavior but aren't subtypes

**Use Inheritance Only When:**
- Genuine "is-a" relationship exists (e.g., `Dog is Animal`)
- Hierarchy stays shallow (1-2 levels max)
- Base class designed for extension

#### TypeScript Patterns

**1. Interface Composition (Preferred)**
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

**2. Dependency Injection**
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

#### Validation Checklist

Before using inheritance, ask:
1. ⚠️ Is this a true "is-a" relationship?
2. ⚠️ Could composition work with more flexibility?
3. ⚠️ Will hierarchy stay shallow (1-2 levels)?
4. ⚠️ Am I inheriting just for code reuse?

**If "no" to #1 or "yes" to #2 or #4: Use composition instead.**

---

### Function Extraction Guidelines

> **Core Principle**: Functions exist to implement FEATURES through composition, not to wrap trivial operations.

#### When TO Extract Functions

**✅ Feature Implementation (Primary Use Case)**

Functions are for implementing cohesive features with real business logic:

```typescript
// ✅ GOOD - Feature with meaningful logic
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

// ✅ GOOD - Feature with business logic
function authenticateUser(credentials: Credentials): Promise<User> {
  const hashedPassword = hashPassword(credentials.password);
  const user = await userRepository.findByEmail(credentials.email);

  if (!user || user.password !== hashedPassword) {
    throw new AuthenticationError('Invalid credentials');
  }

  return user;
}
```

**✅ Composition Pattern**

Functions that enable composition via dependency injection or interfaces:

```typescript
// ✅ GOOD - Composition via DI
interface Logger {
  log(message: string): void;
}

class UserService {
  constructor(private logger: Logger) {}

  async createUser(data: UserData) {
    this.logger.log(`Creating user: ${data.email}`);
    await this.storage.save(`user:${data.id}`, data);
  }
}
```

**✅ Encapsulating Complex Conditionals**

```typescript
// ✅ GOOD - Complex conditional with clear semantic meaning
function shouldShowSpinner(fsm: StateMachine, listNode: Node): boolean {
  return fsm.state === "fetching" && isEmpty(listNode);
}

if (shouldShowSpinner(fsmInstance, listNodeInstance)) {
  renderSpinner();
}
```

**✅ Reusable Logic (3+ Uses)**

Extract logic genuinely used in 3+ different contexts:

```typescript
// ✅ GOOD - Used across multiple features
function formatCurrency(amount: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(amount);
}
```

#### When NOT to Extract Functions

**⛔ Simple 1-2 Line Wrappers**

```typescript
// ❌ BAD - Pointless wrapper
function getUser(id: string) {
  return userRepository.findById(id);
}

// ✅ GOOD - Just use directly
const user = userRepository.findById(id);

// ❌ BAD - Trivial wrapper
function isEnabled() {
  return config.featureFlag === true;
}

// ✅ GOOD - Use directly
if (config.featureFlag) {
  // ...
}
```

**⛔ Configuration Getters**

```typescript
// ❌ BAD - Unnecessary config wrapper
function getApiUrl(): string {
  return process.env.API_URL;
}

// ✅ GOOD - Use constants directly
export const API_URL = process.env.API_URL;

// Validate once at module load
if (!API_URL) {
  throw new Error('API_URL is required');
}
```

**⛔ Single-Use "Helper" Functions**

```typescript
// ❌ BAD - Function used only once
function calculateTotal(items: Item[]) {
  return items.reduce((sum, item) => sum + item.price, 0);
}

function processOrder(items: Item[]) {
  const total = calculateTotal(items); // Only used here
  return { items, total };
}

// ✅ GOOD - Inline single-use logic
function processOrder(items: Item[]) {
  const total = items.reduce((sum, item) => sum + item.price, 0);
  return { items, total };
}
```

#### Function Extraction Decision Framework

Before creating a function, ask yourself:

1. **Feature Check**: Does this implement a cohesive feature with business logic?
   - ✅ YES → Extract
   - ⛔ NO → Continue

2. **Composition Check**: Is this required for DI, interfaces, or composition pattern?
   - ✅ YES → Extract
   - ⛔ NO → Continue

3. **Complexity Check**: Does this encapsulate complex logic (3+ meaningful lines)?
   - ✅ YES → Extract
   - ⛔ NO → Continue

4. **Reuse Check**: Is this used in 3+ different places with identical behavior?
   - ✅ YES → Extract
   - ⛔ NO → Continue

5. **Semantic Check**: Does the function name add significant semantic clarity?
   - ✅ YES → Extract (if conditional logic)
   - ⛔ NO → Don't extract

**If all answers are NO: Don't create the function.**

#### Function Size Guidelines

- **Ideal**: 5-20 lines of meaningful logic
- **Warning**: 20-50 lines (consider breaking down)
- **Problem**: 50+ lines (definitely break down)

**Exceptions**:
- Configuration objects (can be longer)
- Switch statements with many cases
- Complex validation with many rules

---

## CRITICAL RULES

### Security (MANDATORY)

**RULE**: Never expose or log secrets/keys/tokens

**Always**:
- Use environment variables for sensitive data
- Validate environment variables at startup
- Add .env files to .gitignore

**Never**:
- Commit secrets to git
- Log passwords, tokens, API keys, or PII
- Include credentials in code

**Example**:
```typescript
// ✅ GOOD
export const API_KEY = process.env.API_KEY;

if (!API_KEY) {
  throw new Error('API_KEY environment variable is required');
}

// ❌ BAD
export const API_KEY = "sk_live_abc123xyz789"; // NEVER!
```

### Branch Protection (MANDATORY)

**RULE**: Never work directly on main/develop branches

**Always**:
- Create feature branches for any development work
- Base branches on up-to-date main/develop
- Use descriptive branch names

**Example**:
```bash
# ✅ GOOD
git checkout main
git pull origin main
git checkout -b feature/user-authentication

# ❌ BAD
git checkout main
# Start making changes directly on main
```

### Git Workflow

**Conventional Commits**

Format: `type(scope): description`

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `docs` - Documentation
- `test` - Tests
- `chore` - Maintenance
- `perf` - Performance improvement

**Examples:**
```bash
git commit -m "feat(auth): add email verification"
git commit -m "fix(api): handle null response"
```

**Git Rules**:
- Always check `git status` before and after commits
- Never use `--no-verify` flag (pre-commit hooks must pass)
- Never force push to main/master without explicit request
- All commit messages in English

### Context7 Integration (Proactive Usage)

**ALWAYS** use Context7 automatically for:
- Code generation with libraries/frameworks
- Setup and configuration instructions
- Library and API documentation
- Up-to-date code examples

**Context7 Workflow**:
1. `resolve-library-id`: Get the Context7-compatible library ID
2. `get-library-docs`: Fetch documentation with appropriate topic
3. Use multiple pages (`page=1, 2, 3...`) if context is insufficient

**When to Use**:
- ✅ User asks how to use a library/framework
- ✅ Need code examples with specific API
- ✅ Configuration of dev tools (Next.js, React, FastAPI, etc.)
- ✅ Recent syntax or patterns for a library

**When NOT to Use**:
- ❌ General programming concept questions
- ❌ Debugging existing code (unless API docs needed)

**Important**:
- **DO NOT** ask user if they want to use Context7
- Use proactively when relevant
- Prefer official libraries with high reputation

---

## QUICK REFERENCE

**Before ANY work:**
- [ ] ⛔ Not on main/develop branch?
- [ ] 🔒 Pre-commit hooks enabled?

**During development:**
- [ ] 📝 Strong typing (no `any`)
- [ ] 🧪 Tests written
- [ ] 🎯 Functions for features, not wrappers
- [ ] 🏗️ Composition over inheritance

**Before commit:**
- [ ] ✅ Lint passed
- [ ] ✅ Type-check passed (if TypeScript)
- [ ] ✅ Tests passed
- [ ] 🔒 No secrets exposed
- [ ] 📝 Conventional commit message

---

## CODE STANDARDS

Detailed coding standards are maintained in separate guideline files:

### Universal Standards
- **Naming Conventions**: `@claude/.claude/guidelines/naming-conventions.md`
  - File naming (PascalCase for components, kebab-case for pages)
  - Variable naming (camelCase, UPPER_CASE for globals)
  - Function naming (camelCase, handle+Action for events)
  - Boolean naming (is/has/can/should prefix)

- **Refactoring Guidelines**: `@claude/.claude/guidelines/refactoring.md`
  - Intelligent DRY application
  - When to apply DRY vs when not to
  - Smart refactoring decision framework
  - KISS principle implementation

### Language/Framework-Specific Standards

- **TypeScript/JavaScript**: `@claude/.claude/guidelines/typescript.md`
  - Module system (import not require)
  - Type system (never `any`)
  - Function declaration style
  - Import organization

- **TypeScript Anti-Patterns**: `@claude/.claude/guidelines/typescript-antipatterns.md`
  - Language-specific anti-patterns
  - Common mistakes to avoid

- **Tailwind CSS**: `@claude/.claude/guidelines/tailwind.md`
  - Inline utilities (always)
  - cn() utility usage (mandatory when available)
  - cva for component variants
  - Organization domains

- **React Anti-Patterns**: `@claude/.claude/guidelines/react-antipatterns.md`
  - Component anti-patterns
  - State management anti-patterns
  - Performance anti-patterns

- **Vitest Testing**: `@claude/.claude/guidelines/vitest.md`
  - Testing philosophy
  - Mock cleanup (critical)
  - Testing best practices

---

## GLOBAL ANTI-PATTERNS

### Workflow Anti-Patterns

**⛔ Working Directly on main/develop**

```bash
# ❌ BAD
git checkout main
# Start making changes directly on main

# ✅ GOOD
git checkout main
git pull origin main
git checkout -b feature/user-authentication
```

**Why**: Risk of breaking production/stable branch, no isolation for experimental work

**⛔ Bypassing Pre-commit Hooks**

```bash
# ❌ BAD
git commit -m "Quick fix" --no-verify

# ✅ GOOD
# Fix the issues that pre-commit hooks detect
pnpm lint --fix
pnpm type-check
pnpm test
git commit -m "fix: resolve authentication bug"
```

**Why**: Skips quality checks, introduces broken code, creates technical debt

**⛔ Committing Without Tests**

```bash
# ❌ BAD - Write new feature, commit without tests
git add .
git commit -m "Add new feature"

# ✅ GOOD - Write feature, write tests, validate
pnpm test
git add .
git commit -m "feat: add user authentication with tests"
```

**Why**: No validation that feature works, future refactors can break silently

### Security Anti-Patterns

**⛔ Committing Secrets**

```typescript
// ❌ BAD
export const API_KEY = "sk_live_abc123xyz789"
export const DATABASE_URL = "postgresql://user:password@localhost:5432/db"

// ✅ GOOD
// .env (gitignored)
// API_KEY=sk_live_abc123xyz789
// DATABASE_URL=postgresql://user:password@localhost:5432/db

export const API_KEY = process.env.API_KEY
export const DATABASE_URL = process.env.DATABASE_URL

if (!API_KEY) {
  throw new Error('API_KEY environment variable is required')
}
```

**Why**: Exposes credentials publicly, security breach, can't rotate keys easily

**⛔ Logging Sensitive Data**

```typescript
// ❌ BAD
function login(credentials: Credentials) {
  console.log('Login attempt:', credentials)  // Logs password!
  return api.login(credentials)
}

// ✅ GOOD
function login(credentials: Credentials) {
  console.log('Login attempt for user:', credentials.email)  // Safe
  return api.login(credentials)
}
```

**Why**: Passwords/tokens visible in logs, can be leaked via log aggregation

### Architecture Anti-Patterns

**⛔ Deep Inheritance Hierarchies**

```typescript
// ❌ BAD - Deep inheritance
class Animal {}
class Mammal extends Animal {}
class Dog extends Mammal {}
class Labrador extends Dog {}  // Too deep!

// ✅ GOOD - Composition
interface Movable { move(): void }
interface Eatable { eat(): void }

class Dog implements Movable, Eatable {
  move() { /* ... */ }
  eat() { /* ... */ }
}
```

**Why**: Tight coupling, fragile base class problem, hard to maintain

**⛔ Inheriting for Code Reuse**

```typescript
// ❌ BAD - Inheritance just for reuse
class Logger {
  log(message: string) { /* ... */ }
}

class UserService extends Logger {  // Wrong relationship!
  createUser() {
    this.log('Creating user')
  }
}

// ✅ GOOD - Composition via DI
interface Logger {
  log(message: string): void
}

class UserService {
  constructor(private logger: Logger) {}

  createUser() {
    this.logger.log('Creating user')
  }
}
```

**Why**: Not a true "is-a" relationship, tight coupling, violates SOLID

**⛔ God Objects/Components**

```typescript
// ❌ BAD - One massive component doing everything
function Dashboard() {
  // 500+ lines of code
  // Handles auth, data fetching, rendering, state management
}

// ✅ GOOD - Break into focused components
function Dashboard() {
  return (
    <DashboardLayout>
      <UserProfile />
      <StatisticsPanel />
      <ActivityFeed />
      <SettingsPanel />
    </DashboardLayout>
  )
}
```

**Why**: Hard to test, difficult to maintain, impossible to reuse, violates SRP

---

## Configuration

### Structure

```
~/.claude/
├── GEMINI.md           # This file (global)
├── settings.json       # Permissions, env, sandbox
└── guidelines/         # Detailed coding standards
    ├── naming-conventions.md
    ├── refactoring.md
    ├── typescript.md
    ├── typescript-antipatterns.md
    ├── tailwind.md
    ├── react-antipatterns.md
    └── vitest.md
```

### Stow Deployment

This file is managed by GNU Stow:
- Source: `~/.stow_repository/claude/.claude/GEMINI.md`
- Target: `~/.claude/GEMINI.md`

Deploy: `cd ~/.stow_repository && stow claude`
