# Anti-Patterns Guide

This document catalogs common anti-patterns and their correct alternatives. Understanding what NOT to do is as important as knowing what to do.

---

## Workflow Anti-Patterns

### ⛔ Working Directly on main/develop

**Anti-Pattern**:
```bash
git checkout main
# Start making changes directly on main
```

**Why It's Wrong**:
- Risk of breaking production/stable branch
- No isolation for experimental work
- Difficult to collaborate
- Can't easily discard failed attempts

**✅ Correct Approach**:
```bash
git checkout main
git pull origin main
git checkout -b feature/user-authentication
# Now work on feature branch
```

**Rule**: ALWAYS use feature branches for any development work.

---

### ⛔ Bypassing Pre-commit Hooks

**Anti-Pattern**:
```bash
git commit -m "Quick fix" --no-verify
```

**Why It's Wrong**:
- Skips linting, type checking, tests
- Can introduce broken code to repository
- Defeats purpose of automated quality checks
- Creates technical debt

**✅ Correct Approach**:
```bash
# Fix the issues that pre-commit hooks detect
pnpm lint --fix
pnpm type-check
pnpm test

# Then commit normally
git commit -m "fix: resolve authentication bug"
```

**Rule**: Pre-commit hooks exist for a reason. Fix the issues, don't bypass them.

---

### ⛔ Committing Without Tests

**Anti-Pattern**:
```bash
# Write new feature
# Commit immediately without writing tests
git add .
git commit -m "Add new feature"
```

**Why It's Wrong**:
- No validation that feature works
- Future refactors can break feature silently
- Reduces code confidence
- Creates maintenance burden

**✅ Correct Approach**:
```bash
# 1. Write feature
# 2. Write tests
# 3. Run full pipeline
pnpm lint
pnpm type-check
pnpm test

# 4. Commit when all pass
git add .
git commit -m "feat: add user authentication with tests"
```

**Rule**: Follow the full pipeline: Develop → Lint → Typecheck → Test → Commit

---

### ⛔ Skipping Lint/Typecheck

**Anti-Pattern**:
```bash
# Make changes
git add .
git commit -m "Update code"
# Never ran lint or typecheck
```

**Why It's Wrong**:
- Introduces style inconsistencies
- Can have hidden type errors
- Breaks builds for team members
- Wastes CI/CD time

**✅ Correct Approach**:
```bash
# After making changes
pnpm lint
pnpm type-check
pnpm test

# Only commit when clean
git add .
git commit -m "refactor: improve error handling"
```

**Rule**: Always run lint and typecheck before committing.

---

## Code Anti-Patterns

### ⛔ Storing Tailwind Classes in Constants

**Anti-Pattern**:
```tsx
const cardStyles = "flex items-center p-4 bg-white rounded-lg"
const buttonStyles = "px-4 py-2 bg-blue-500 text-white rounded"

function Card() {
  return <div className={cardStyles}>Content</div>
}
```

**Why It's Wrong**:
- Defeats Tailwind's utility-first philosophy
- Harder to scan and modify
- Can't see styles at component usage
- Prevents tailwind-merge from working properly

**✅ Correct Approach**:
```tsx
function Card() {
  return (
    <div className="flex items-center p-4 bg-white rounded-lg">
      Content
    </div>
  )
}

// OR with cn() for conditional logic
function Card({ isActive }: { isActive: boolean }) {
  return (
    <div className={cn(
      "flex items-center p-4 bg-white rounded-lg",
      isActive && "border-2 border-blue-500"
    )}>
      Content
    </div>
  )
}

// ONLY exception: cva for component variants
const buttonVariants = cva(
  "px-4 py-2 rounded font-medium",
  {
    variants: {
      variant: {
        primary: "bg-blue-500 text-white",
        secondary: "bg-gray-500 text-white",
      }
    }
  }
)
```

**Rule**: Inline Tailwind classes always, except when using cva for component variants.

---

### ⛔ Using require() in TypeScript

**Anti-Pattern**:
```tsx
const express = require('express')
const { someUtil } = require('./utils')
```

**Why It's Wrong**:
- CommonJS syntax in ES modules codebase
- Loses TypeScript type inference
- No static analysis for imports
- Can't tree-shake effectively

**✅ Correct Approach**:
```tsx
import express from 'express'
import { someUtil } from './utils'

// For dynamic imports
const module = await import('./dynamic-module')
```

**Rule**: Always use ES6 import/export syntax in TypeScript.

---

### ⛔ Using 'any' Type

**Anti-Pattern**:
```tsx
function processData(data: any) {
  return data.map((item: any) => item.value)
}

const config: any = { port: 3000 }
```

**Why It's Wrong**:
- Defeats TypeScript's type safety
- No autocomplete or IntelliSense
- Runtime errors not caught at compile time
- Makes refactoring dangerous

**✅ Correct Approach**:
```tsx
interface DataItem {
  value: string
  id: number
}

function processData(data: DataItem[]) {
  return data.map(item => item.value)
}

interface Config {
  port: number
  host?: string
}

const config: Config = { port: 3000 }

// If truly unknown, use 'unknown' instead of 'any'
function handleUnknown(data: unknown) {
  if (typeof data === 'string') {
    console.log(data.toUpperCase())
  }
}
```

**Rule**: Never use `any`. Use proper types or `unknown` with type guards.

---

### ⛔ Untyped Error Catching

**Anti-Pattern**:
```tsx
try {
  await fetchData()
} catch (error) {
  console.log(error.message)  // error is 'any'
}
```

**Why It's Wrong**:
- `error` is implicitly `any`
- No guarantee error has a message property
- Can crash with "Cannot read property 'message' of undefined"

**✅ Correct Approach**:
```tsx
try {
  await fetchData()
} catch (error) {
  if (error instanceof Error) {
    console.log(error.message)
  } else {
    console.log('Unknown error occurred')
  }
}

// OR with helper
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

try {
  await fetchData()
} catch (error) {
  console.log(getErrorMessage(error))
}
```

**Rule**: Always handle caught errors with proper type guards.

---

### ⛔ Not Using cn() When Available

**Anti-Pattern**:
```tsx
<div className={`flex items-center ${isActive ? 'bg-blue-500' : 'bg-gray-200'}`}>

// OR
<div className={clsx('flex items-center', isActive && 'bg-blue-500')}>
```

**Why It's Wrong**:
- Missing tailwind-merge functionality
- Tailwind class conflicts not resolved
- Inconsistent with project patterns
- `bg-blue-500` and `bg-gray-200` both applied if not careful

**✅ Correct Approach**:
```tsx
<div className={cn(
  'flex items-center',
  isActive ? 'bg-blue-500' : 'bg-gray-200'
)}>
```

**Rule**: When `cn()` utility exists in project, it's MANDATORY to use it.

---

## Tool Anti-Patterns

### ⛔ Using npm or yarn Instead of pnpm

**Anti-Pattern**:
```bash
npm install lodash
yarn add react
```

**Why It's Wrong**:
- Inconsistent with project configuration
- Creates different lock files (package-lock.json vs pnpm-lock.yaml)
- Can cause dependency conflicts
- Wastes disk space (no shared node_modules)

**✅ Correct Approach**:
```bash
pnpm add lodash
pnpm add react
pnpm install
```

**Rule**: ALWAYS use pnpm as the package manager.

---

### ⛔ Mixing Inline Styles with Tailwind

**Anti-Pattern**:
```tsx
<div className="flex items-center" style={{ padding: '16px', color: 'red' }}>
  Content
</div>
```

**Why It's Wrong**:
- Defeats Tailwind's utility-first approach
- Can't use responsive/hover/dark variants on inline styles
- Harder to maintain consistency
- Inline styles have higher specificity (can cause issues)

**✅ Correct Approach**:
```tsx
<div className="flex items-center p-4 text-red-500">
  Content
</div>

// If dynamic values needed
<div
  className="flex items-center p-4"
  style={{
    '--dynamic-color': color,
    backgroundColor: 'var(--dynamic-color)'
  } as React.CSSProperties}
>
  Content
</div>
```

**Rule**: Use Tailwind utilities for all static styling. Only use inline styles for truly dynamic values.

---

## Testing Anti-Patterns

### ⛔ Testing Implementation Details

**Anti-Pattern**:
```tsx
it('should update internal state correctly', () => {
  const wrapper = mount(<Counter />)
  wrapper.instance().setState({ count: 5 })
  expect(wrapper.state('count')).toBe(5)
})
```

**Why It's Wrong**:
- Tests break when refactoring (even if behavior unchanged)
- Doesn't test user-facing functionality
- Couples tests to implementation
- Provides false confidence

**✅ Correct Approach**:
```tsx
it('should increment counter when button clicked', () => {
  render(<Counter />)
  const button = screen.getByRole('button', { name: /increment/i })
  const count = screen.getByText(/count: 0/i)

  fireEvent.click(button)

  expect(screen.getByText(/count: 1/i)).toBeInTheDocument()
})
```

**Rule**: Test behavior and user interactions, not implementation details.

---

### ⛔ Not Cleaning Up Mocks

**Anti-Pattern**:
```tsx
describe('API tests', () => {
  it('should fetch user data', () => {
    vi.mock('./api')
    // test code
  })

  it('should fetch post data', () => {
    // Previous mock still active! Can cause issues
  })
})
```

**Why It's Wrong**:
- Mocks leak between tests
- Tests become order-dependent
- Hard to debug failures
- Unpredictable test results

**✅ Correct Approach**:
```tsx
describe('API tests', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.resetAllMocks()
  })

  it('should fetch user data', () => {
    vi.mock('./api')
    // test code
  })

  it('should fetch post data', () => {
    // Clean slate
  })
})
```

**Rule**: Always clean up mocks in afterEach hooks.

---

## Function Extraction Anti-Patterns

### ⛔ Unnecessary 1-2 Line Wrapper Functions

**Anti-Pattern**:
```typescript
function getUser(id: string) {
  return userRepository.findById(id);
}

function getUserName(user: User) {
  return user.name;
}

function getApiUrl() {
  return process.env.API_URL;
}

const user = await getUser(userId);
const name = getUserName(user);
```

**Why It's Wrong**:
- Adds no semantic value
- Extra indirection makes code harder to trace
- Bloats codebase with pointless abstractions
- Violates "functions are for features" principle
- Just renaming variables/properties

**✅ Correct Approach**:
```typescript
// Direct calls - clear and simple
const user = await userRepository.findById(userId);
const name = user.name;
const apiUrl = process.env.API_URL;

// OR destructuring for clarity
const { name, email } = user;

// ONLY extract when implementing a real feature
function validateAndCreateUser(data: UserData): Promise<User> {
  if (!validateEmail(data.email)) {
    throw new ValidationError('Invalid email');
  }

  const hashedPassword = hashPassword(data.password);
  return userRepository.create({
    ...data,
    password: hashedPassword
  });
}
```

**Rule**: Functions are for FEATURES with business logic (3+ meaningful lines), not trivial wrappers.

**Exceptions** (allowed 1-2 line functions):
- Encapsulating complex conditionals for readability
- Required by interface/composition contracts
- Creating testing/mocking boundaries
- Platform-specific abstractions

---

## Architecture Anti-Patterns

### ⛔ God Objects/Components

**Anti-Pattern**:
```tsx
function Dashboard() {
  // 500+ lines of code
  // Handles auth, data fetching, rendering, state management
  // Multiple responsibilities
}
```

**Why It's Wrong**:
- Hard to test
- Difficult to maintain
- Impossible to reuse parts
- Violates Single Responsibility Principle

**✅ Correct Approach**:
```tsx
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

// Each component handles one responsibility
```

**Rule**: Break large components into smaller, focused ones.

---

### ⛔ Prop Drilling

**Anti-Pattern**:
```tsx
<App user={user}>
  <Layout user={user}>
    <Header user={user}>
      <UserMenu user={user} />
    </Header>
  </Layout>
</App>
```

**Why It's Wrong**:
- Components become tightly coupled
- Hard to refactor component tree
- Many components receive props they don't use
- Difficult to maintain

**✅ Correct Approach**:
```tsx
// Use Context
const UserContext = createContext()

function App() {
  const [user, setUser] = useState()

  return (
    <UserContext.Provider value={user}>
      <Layout>
        <Header>
          <UserMenu />
        </Header>
      </Layout>
    </UserContext.Provider>
  )
}

function UserMenu() {
  const user = useContext(UserContext)
  // Use user directly
}

// OR use state management (Zustand, Redux, etc.)
```

**Rule**: Use Context, state management, or composition to avoid prop drilling.

---

## Security Anti-Patterns

### ⛔ Committing Secrets

**Anti-Pattern**:
```tsx
// config.ts
export const API_KEY = "sk_live_abc123xyz789"
export const DATABASE_URL = "postgresql://user:password@localhost:5432/db"

// Committed to git!
```

**Why It's Wrong**:
- Exposes credentials publicly
- Security breach
- Can't rotate keys easily
- Violates security best practices

**✅ Correct Approach**:
```tsx
// .env (gitignored)
API_KEY=sk_live_abc123xyz789
DATABASE_URL=postgresql://user:password@localhost:5432/db

// config.ts
export const API_KEY = process.env.API_KEY
export const DATABASE_URL = process.env.DATABASE_URL

// Validate at runtime
if (!API_KEY) {
  throw new Error('API_KEY environment variable is required')
}
```

**Rule**: Never commit secrets. Always use environment variables.

---

### ⛔ Logging Sensitive Data

**Anti-Pattern**:
```tsx
function login(credentials: Credentials) {
  console.log('Login attempt:', credentials)  // Logs password!

  return api.login(credentials)
}
```

**Why It's Wrong**:
- Passwords/tokens visible in logs
- Can be leaked via log aggregation services
- Security audit violations
- Compliance issues (GDPR, etc.)

**✅ Correct Approach**:
```tsx
function login(credentials: Credentials) {
  console.log('Login attempt for user:', credentials.email)  // Safe

  return api.login(credentials)
}

// OR use redaction
function login(credentials: Credentials) {
  console.log('Login attempt:', {
    ...credentials,
    password: '[REDACTED]'
  })

  return api.login(credentials)
}
```

**Rule**: Never log sensitive data (passwords, tokens, API keys, PII).

---

## Performance Anti-Patterns

### ⛔ Unnecessary Re-renders

**Anti-Pattern**:
```tsx
function Parent() {
  const [count, setCount] = useState(0)

  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
      <ExpensiveComponent data={heavyData} />  {/* Re-renders on every count change! */}
    </>
  )
}
```

**Why It's Wrong**:
- Wastes CPU cycles
- Causes UI lag
- Poor user experience
- Unnecessary component updates

**✅ Correct Approach**:
```tsx
function Parent() {
  const [count, setCount] = useState(0)

  return (
    <>
      <button onClick={() => setCount(c => c + 1)}>Increment</button>
      <MemoizedExpensiveComponent data={heavyData} />
    </>
  )
}

const MemoizedExpensiveComponent = React.memo(ExpensiveComponent)

// OR split into separate components
function Parent() {
  return (
    <>
      <Counter />
      <ExpensiveComponent data={heavyData} />
    </>
  )
}

function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(c => c + 1)}>{count}</button>
}
```

**Rule**: Optimize re-renders with memo, useMemo, useCallback, or component splitting.

---

## Summary

**Key Principles**:
1. Follow established workflows (don't bypass)
2. Maintain type safety (never compromise)
3. Use project tools consistently (PNPM, Tailwind, cn())
4. Test behavior, not implementation
5. Never commit secrets or log sensitive data
6. Keep components focused and composable
7. Optimize for performance and maintainability

**When in Doubt**:
- Ask "Does this compromise quality?"
- Ask "Is this the simplest (not easiest) solution?"
- Ask "Will this be maintainable in 6 months?"
- Ask "Does this follow project patterns?"

**Remember**: Anti-patterns exist because they seem easy in the moment but create technical debt, security issues, or maintenance burden later.
