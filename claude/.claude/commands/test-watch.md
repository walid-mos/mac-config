# /test-watch

Launch Vitest in watch mode with coverage and smart filtering for continuous testing.

## Task

I'll start an interactive testing session using Vitest watch mode with coverage reporting, file filtering, and intelligent test execution for efficient development workflow.

## Process

I'll set up the testing environment:

1. **Validate Test Setup**: Ensure Vitest is configured and available
2. **Configure Watch Mode**: Set up optimal watch mode settings
3. **Enable Coverage**: Configure coverage reporting with V8 provider
4. **Smart Filtering**: Apply file patterns if specified
5. **Launch Interactive Mode**: Start Vitest with optimal configuration

## Implementation Details

### Vitest Configuration Validation
- Check for `vitest.config.ts` or `vite.config.ts`
- Verify test scripts in `package.json`
- Ensure proper test environment setup
- Validate coverage configuration

### Watch Mode Features
- **File Watching**: Automatic re-run on file changes
- **Smart Detection**: Only run tests related to changed files
- **Interactive Mode**: Keyboard shortcuts for test control
- **Coverage Tracking**: Real-time coverage updates
- **Pattern Filtering**: Focus on specific test files or suites

### Coverage Configuration
```typescript
// Optimal coverage settings
coverage: {
  provider: 'v8',
  reporter: ['text', 'html', 'json-summary'],
  exclude: [
    'node_modules/**',
    'dist/**',
    '**/*.d.ts',
    '**/*.config.*',
    '**/coverage/**'
  ],
  thresholds: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  }
}
```

## Usage Patterns

### Basic Watch Mode
```bash
/test-watch
# Starts watch mode for all tests
```

### Pattern Filtering
```bash
/test-watch auth
# Watches only tests matching "auth" pattern

/test-watch src/components
# Watches tests in specific directory

/test-watch "*.integration.test.*"
# Watches only integration tests
```

### Coverage Focus
```bash
/test-watch --coverage
# Enables coverage reporting in watch mode

/test-watch --coverage --threshold=90
# Sets custom coverage threshold
```

## Expected Output

```
🧪 Starting Vitest watch mode...

⚙️  Configuration:
  Mode: Watch
  Coverage: Enabled (V8 provider)
  Pattern: auth (if specified)
  Environment: node

🚀 Launching interactive test session...

 ✓ src/auth/login.test.js (3)
 ✓ src/auth/register.test.js (5)
 ✓ src/auth/jwt.test.js (8)

Test Files  3 passed (3)
     Tests  16 passed (16)
  Start at  14:30:25
  Duration  234ms

 % Coverage report from v8
 % coverage: 92.5%
 % lines: 185/200
 % functions: 45/48
 % branches: 38/42

 watching for file changes...

> press h to show help
> press q to quit
> press p to filter by a test name regex pattern
> press f to filter by a filename
> press c to toggle coverage
```

## Interactive Commands

### During Watch Session
- **`h`** - Show help and available commands
- **`q`** - Quit watch mode
- **`p`** - Filter by test name pattern
- **`f`** - Filter by filename
- **`c`** - Toggle coverage reporting
- **`r`** - Re-run all tests
- **`u`** - Update snapshots
- **`a`** - Run all tests (ignore patterns)

### Smart Filtering Examples
```
Press p to filter by test name:
> login validation

Press f to filter by filename:
> auth

Press c to toggle coverage:
Coverage: enabled → disabled
```

## Configuration Options

### Environment Detection
- **Node.js Projects**: Use `node` environment
- **Browser Projects**: Use `jsdom` or `happy-dom`
- **React Projects**: Configure with `@testing-library/react`
- **Vue Projects**: Configure with `@vue/test-utils`

### Performance Optimization
```typescript
// Optimal test configuration
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    setupFiles: ['./test/setup.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
    },
    watchExclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/coverage/**'
    ]
  }
})
```

## Coverage Reporting

### Real-time Updates
```
 % Coverage Summary:
 % ================
 % Lines   : 92.5% (185/200)
 % Functions: 93.7% (45/48)
 % Branches: 90.4% (38/42)
 % Statements: 92.5% (185/200)

 Uncovered Lines:
 src/auth/login.js: 45-47, 89
 src/utils/validation.js: 23-25
```

### HTML Report Generation
- Open `coverage/index.html` for detailed view
- Interactive coverage browser
- Line-by-line coverage visualization
- Historical coverage tracking

## Integration with Development Workflow

### File Change Detection
```
File changed: src/auth/login.js
Running related tests...

 ✓ src/auth/login.test.js
 ✓ src/integration/auth.test.js

2 tests passed in 156ms
Coverage updated: 92.5% → 93.1%
```

### Error Reporting
```
 FAIL  src/auth/login.test.js > Login validation > should validate email
AssertionError: expected 'invalid' to be 'valid'
 ❯ src/auth/login.test.js:23:16

Press r to re-run failing tests
Press u to update snapshots
```

This command provides an efficient development testing environment with real-time feedback and coverage tracking.