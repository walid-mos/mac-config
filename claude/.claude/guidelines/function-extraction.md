# Function Extraction Guidelines

> **Core Principle**: Functions exist to implement FEATURES through composition, not to wrap trivial operations.

## When TO Extract Functions

### ✅ Feature Implementation (Primary Use Case)

Functions are for implementing cohesive features with real business logic:

```typescript
// ✅ GOOD - Feature with meaningful logic (email validation)
function validateEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

// ✅ GOOD - Feature with business logic (user authentication)
function authenticateUser(credentials: Credentials): Promise<User> {
  const hashedPassword = hashPassword(credentials.password);
  const user = await userRepository.findByEmail(credentials.email);

  if (!user || user.password !== hashedPassword) {
    throw new AuthenticationError('Invalid credentials');
  }

  return user;
}
```

### ✅ Composition Pattern

Functions that enable composition via dependency injection or interfaces:

```typescript
// ✅ GOOD - Composition via DI
interface Logger {
  log(message: string): void;
}

interface Storage {
  save(key: string, value: unknown): Promise<void>;
}

class UserService {
  constructor(
    private logger: Logger,
    private storage: Storage
  ) {}

  async createUser(data: UserData) {
    this.logger.log(`Creating user: ${data.email}`);
    await this.storage.save(`user:${data.id}`, data);
  }
}
```

### ✅ Encapsulating Complex Conditionals

Extract conditionals that improve readability by expressing intent:

```typescript
// ✅ GOOD - Complex conditional with clear semantic meaning
function shouldShowSpinner(fsm: StateMachine, listNode: Node): boolean {
  return fsm.state === "fetching" && isEmpty(listNode);
}

if (shouldShowSpinner(fsmInstance, listNodeInstance)) {
  renderSpinner();
}

// ✅ GOOD - Positive conditional naming
function isDOMNodePresent(node: Node | null): boolean {
  return node !== null && node.parentElement !== null;
}

if (isDOMNodePresent(node)) {
  attachEventListeners(node);
}
```

### ✅ Multiple Levels of Abstraction

Extract lower-level operations to maintain single level of abstraction:

```typescript
// ✅ GOOD - Each function operates at single abstraction level
function parseCode(code: string): AST {
  const tokens = tokenize(code);
  const syntaxTree = parse(tokens);
  return optimize(syntaxTree);
}

function tokenize(code: string): Token[] {
  const statements = code.split(" ");
  const tokens: Token[] = [];

  REGEXES.forEach(regex => {
    statements.forEach(statement => {
      tokens.push(matchToken(regex, statement));
    });
  });

  return tokens;
}

function parse(tokens: Token[]): AST {
  const syntaxTree: AST = [];
  tokens.forEach(token => {
    syntaxTree.push(buildNode(token));
  });
  return syntaxTree;
}
```

### ✅ Reusable Logic (3+ Uses)

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

---

## When NOT to Extract Functions

### ⛔ Simple 1-2 Line Wrappers

Don't create functions that just call another function without adding value:

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

// ❌ BAD - Renaming via function
function getUserEmail(user: User) {
  return user.email;
}

// ✅ GOOD - Use property directly or destructure
const { email } = user;
```

### ⛔ Configuration Getters

Don't wrap simple config access:

```typescript
// ❌ BAD - Unnecessary config wrapper
function getApiUrl(): string {
  return process.env.API_URL;
}

function getDatabaseUrl(): string {
  return process.env.DATABASE_URL;
}

// ✅ GOOD - Use constants directly
export const API_URL = process.env.API_URL;
export const DATABASE_URL = process.env.DATABASE_URL;

// Validate once at module load
if (!API_URL) {
  throw new Error('API_URL is required');
}
```

### ⛔ Path/String Concatenation

Don't wrap trivial string operations:

```typescript
// ❌ BAD - Pointless path wrapper
function getUserPath(userId: string) {
  return `/api/users/${userId}`;
}

// ✅ GOOD - Use template literal directly
const path = `/api/users/${userId}`;

// ❌ BAD - Trivial string operation
function getFullName(firstName: string, lastName: string) {
  return `${firstName} ${lastName}`;
}

// ✅ GOOD - Use template literal inline
const fullName = `${user.firstName} ${user.lastName}`;
```

### ⛔ Single-Use "Helper" Functions

Don't extract logic used only once:

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

### ⛔ Over-Parameterized Wrappers

Don't create functions with excessive parameters that just pass through:

```typescript
// ❌ BAD - Parameter pass-through wrapper
function createUser(
  name: string,
  email: string,
  age: number,
  country: string,
  preferences: Preferences
) {
  return userRepository.create(name, email, age, country, preferences);
}

// ✅ GOOD - Use object parameters or call directly
interface CreateUserParams {
  name: string;
  email: string;
  age: number;
  country: string;
  preferences: Preferences;
}

// If adding validation or transformation
function createUser(params: CreateUserParams): Promise<User> {
  validateUserData(params); // Adds value
  return userRepository.create(params);
}

// Otherwise, just use repository directly
await userRepository.create(userData);
```

---

## Allowed Exceptions (1-2 Line Functions)

### ✅ Conditional Logic Encapsulation

When the function name adds significant semantic clarity:

```typescript
// ✅ ALLOWED - Expresses business rule clearly
function isEligibleForDiscount(user: User): boolean {
  return user.isPremium && user.purchases > 10;
}

// ✅ ALLOWED - Encapsulates complex boolean logic
function canEditPost(user: User, post: Post): boolean {
  return user.id === post.authorId || user.role === 'admin';
}
```

### ✅ Interface/Composition Requirements

When required for dependency injection or interface contracts:

```typescript
// ✅ ALLOWED - Required by interface
interface Notifier {
  notify(message: string): void;
}

class EmailNotifier implements Notifier {
  notify(message: string): void {
    sendEmail(message); // Wrapper required by interface
  }
}

class SlackNotifier implements Notifier {
  notify(message: string): void {
    postToSlack(message); // Wrapper required by interface
  }
}
```

### ✅ Testing/Mocking Boundaries

When creating seams for testing:

```typescript
// ✅ ALLOWED - Creates mockable boundary
function getCurrentTimestamp(): number {
  return Date.now();
}

// Now easily mockable in tests
vi.mock('./time', () => ({
  getCurrentTimestamp: () => 1234567890
}));
```

### ✅ Platform-Specific Abstractions

When isolating platform differences:

```typescript
// ✅ ALLOWED - Platform abstraction
function getStoragePath(): string {
  return process.platform === 'win32'
    ? 'C:\\Users\\data'
    : '/home/user/data';
}
```

---

## Decision Framework

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

---

## Examples: Good vs Bad

### Example 1: User Profile

```typescript
// ❌ BAD - Unnecessary wrappers
function getUserName(user: User) {
  return user.name;
}

function getUserEmail(user: User) {
  return user.email;
}

function displayUserProfile(user: User) {
  const name = getUserName(user);
  const email = getUserEmail(user);
  return `${name} (${email})`;
}

// ✅ GOOD - Direct property access
function displayUserProfile(user: User) {
  return `${user.name} (${user.email})`;
}

// OR with destructuring
function displayUserProfile({ name, email }: User) {
  return `${name} (${email})`;
}
```

### Example 2: API Calls

```typescript
// ❌ BAD - Pointless wrapper
function fetchUser(id: string) {
  return api.get(`/users/${id}`);
}

function fetchPost(id: string) {
  return api.get(`/posts/${id}`);
}

// ✅ GOOD - Feature with actual logic
async function fetchUserWithPosts(userId: string): Promise<UserWithPosts> {
  const [user, posts] = await Promise.all([
    api.get(`/users/${userId}`),
    api.get(`/users/${userId}/posts`)
  ]);

  return {
    ...user,
    posts: posts.map(normalizePost)
  };
}

// OR just use api directly
const user = await api.get(`/users/${id}`);
const post = await api.get(`/posts/${id}`);
```

### Example 3: Validation

```typescript
// ❌ BAD - Trivial wrappers
function isNotEmpty(value: string) {
  return value.length > 0;
}

function isValidLength(value: string) {
  return value.length >= 3 && value.length <= 50;
}

// ✅ GOOD - Feature with complete validation logic
function validateUsername(username: string): ValidationResult {
  if (username.length === 0) {
    return { valid: false, error: 'Username is required' };
  }

  if (username.length < 3 || username.length > 50) {
    return { valid: false, error: 'Username must be 3-50 characters' };
  }

  if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
    return { valid: false, error: 'Username contains invalid characters' };
  }

  return { valid: true };
}
```

---

## Function Size Guidelines

- **Ideal**: 5-20 lines of meaningful logic
- **Warning**: 20-50 lines (consider breaking down)
- **Problem**: 50+ lines (definitely break down)

**Exceptions**:
- Configuration objects (can be longer)
- Switch statements with many cases
- Complex validation with many rules

---

## Quick Refactoring Checklist

Before committing a new function, verify:

- [ ] Does it implement a cohesive feature? (Not just wrapping)
- [ ] Does it have 3+ lines of meaningful logic? (Not just trivial operations)
- [ ] Is it used in 3+ places, OR required for composition? (Not single-use)
- [ ] Does the name express clear intent? (Not just renaming)
- [ ] Can it be tested in isolation? (Has clear boundaries)
- [ ] Would inline code be MORE confusing? (Adds clarity, not just abstraction)

**If you answer "NO" to most of these: Don't extract the function.**

---

## Summary

**Functions are for FEATURES and COMPOSITION, not trivial wrappers.**

- ✅ Extract for features with business logic (3+ meaningful lines)
- ✅ Extract for composition patterns (DI, interfaces)
- ✅ Extract complex conditionals that improve readability
- ✅ Extract reusable logic (3+ uses)
- ⛔ Don't wrap simple operations (1-2 lines)
- ⛔ Don't wrap config access or property getters
- ⛔ Don't create single-use "helper" functions
- ⛔ Don't over-parameterize pass-through wrappers

**When in doubt, ask**: "Am I implementing a feature, or just wrapping a call?"
