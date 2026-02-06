---
name: playwright
description: Playwright E2E testing standards. Use when writing or reviewing end-to-end tests (*.e2e.ts) for browser-based user journeys and visual regression.
user-invocable: false
---

# Playwright E2E Standards

## Philosophy

E2E tests verify what unit tests can't — real browser rendering, visual correctness, cross-browser behavior, and full user journeys. Playwright tests are complementary to vitest, not a replacement. Don't re-test logic already covered by unit tests.

## Two E2E Scopes

### Component-Level E2E

Verify components render correctly in a real browser — design spec compliance, focus/hover/keyboard behavior, visual regression via screenshots. A `Button.tsx` deserves both a vitest test (logic, event handlers) and a Playwright test (visual appearance, real browser interactions).

Use for:
- Visual regression checks (`toHaveScreenshot()`)
- Real browser focus management, keyboard navigation, hover states
- Design spec compliance (spacing, colors, responsive breakpoints)
- Accessibility in a real rendering context

### Journey-Level E2E

Full user workflows spanning multiple pages and interactions.

Use for:
- Login/signup/logout flows
- Multi-step forms and wizards
- Checkout and payment flows
- Permission-gated route access
- Cross-page navigation and deep linking

## What NOT to Duplicate

- Don't assert that `onClick` calls the right handler — vitest covers that
- Don't test pure business logic through the UI — vitest covers that
- Don't test API response parsing — vitest integration tests cover that
- If vitest already proves the behavior, Playwright should only verify the visual/browser layer

## Selectors

Priority order (same a11y-first philosophy as RTL):
1. `getByRole('button', { name: 'Submit' })` — preferred
2. `getByTestId('checkout-form')` — acceptable fallback
3. CSS selectors — last resort only

Avoid fragile selectors tied to DOM structure or styling classes.

## Assertions

```typescript
// Navigation
await expect(page).toHaveURL('/dashboard')
await expect(page).toHaveTitle('Dashboard')

// Visibility and state
await expect(locator).toBeVisible()
await expect(locator).toBeEnabled()
await expect(locator).toHaveText('Welcome')
await expect(locator).toHaveAttribute('aria-expanded', 'true')

// Visual regression
await expect(page).toHaveScreenshot('dashboard.png')
await expect(locator).toHaveScreenshot('button-hover.png')
```

## Page Object Model

Encapsulate page interactions for maintainability:

```typescript
class LoginPage {
  constructor(private page: Page) {}

  readonly emailInput = () => this.page.getByRole('textbox', { name: 'Email' })
  readonly passwordInput = () => this.page.getByRole('textbox', { name: 'Password' })
  readonly submitButton = () => this.page.getByRole('button', { name: 'Sign in' })

  async login(email: string, password: string) {
    await this.emailInput().fill(email)
    await this.passwordInput().fill(password)
    await this.submitButton().click()
  }
}
```

## Network

- **Mocking**: `page.route('**/api/users', route => route.fulfill({ json: mockData }))` for deterministic tests
- **Real API flows**: `page.waitForResponse('**/api/users')` when testing against a running backend
- Mock external services, let internal APIs run when possible

## Authentication and State

Reuse auth state across tests to avoid repeated login flows:

```typescript
// Global setup: save auth state
await page.context().storageState({ path: 'e2e/.auth/user.json' })

// Test config: reuse auth state
use: { storageState: 'e2e/.auth/user.json' }
```

## Visual Regression

- `toHaveScreenshot()` for component and page-level visual checks
- Commit baseline screenshots to version control
- Update baselines intentionally: `npx playwright test --update-snapshots`
- Use `maxDiffPixelRatio` for tolerance on anti-aliasing differences

## Tracing and Debugging

```typescript
// playwright.config.ts
use: {
  trace: 'on-first-retry',
  screenshot: 'only-on-failure',
  video: 'retain-on-failure',
}
```

- View traces: `npx playwright show-trace trace.zip`
- Use `page.pause()` during development for step-by-step debugging

## Structure

```
e2e/
  components/          # Component-level E2E tests
    button.e2e.ts
    sidebar.e2e.ts
  journeys/            # Journey-level E2E tests
    auth.e2e.ts
    checkout.e2e.ts
  pages/               # Page Object Models
    login-page.ts
    dashboard-page.ts
  fixtures/            # Shared test fixtures and data
  .auth/               # Saved auth state (gitignored)
playwright.config.ts
```

- File naming: `*.e2e.ts`
- Component E2E tests in `e2e/components/` or colocated with source
- Journey tests in `e2e/journeys/`
- Page Objects in `e2e/pages/`

## CI Considerations

- Always run headless in CI: `use: { headless: true }`
- Configure retries: `retries: process.env.CI ? 2 : 0`
- Parallel sharding: `npx playwright test --shard=1/4`
- Upload trace artifacts on failure for debugging
- Pin browser versions in `playwright.config.ts` for reproducibility
