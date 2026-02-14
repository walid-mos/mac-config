---
name: email-manager
description: "@nextnode-solutions/email-manager standards. Auto-load when @nextnode-solutions/email-manager is in the project's package.json (dependencies or devDependencies)."
user-invocable: false
autoload-dirs:
  - /Users/walid/Development/nextnode
  - /Users/walid/Development/saas
version: 0.0.0-development
---

# @nextnode-solutions/email-manager Standards

> **Conditional auto-load**: This skill auto-loads on NextNode/SaaS projects, but ONLY applies when `@nextnode-solutions/email-manager` appears in the project's `package.json` (`dependencies`, `devDependencies`, or `peerDependencies`). If the package is not a dependency, ignore this skill entirely.

## Overview

Template-first email sending library. Provider-agnostic architecture — every email uses a React Email component, rendered to HTML internally. Resend is the first (and currently only) provider.

**Peer deps**: `react`, `@react-email/render`, `@nextnode-solutions/logger`
**Optional peer dep**: `resend` (only needed when using the Resend provider)
**Engine**: Node.js `>=24.0.0`

## Architecture

```
src/
  index.ts                 # Public exports (single entry point)
  email-manager.ts         # Facade: createEmailManager() factory
  providers/
    registry.ts            # Factory: createProvider() — maps name → provider
    base.ts                # Shared utils: validation, recipient normalization
    resend.ts              # Resend implementation of EmailProvider
  templates/
    renderer.ts            # renderTemplate() — React Email → HTML/text
  types/
    email.ts               # EmailMessage, TemplatedEmailMessage, recipients, attachments
    provider.ts            # EmailProvider interface, ProviderConfigMap
    result.ts              # Result<T,E>, SendResult, EmailError, error factories
  utils/
    logger.ts              # Scoped loggers via @nextnode-solutions/logger
```

## Key API

### `createEmailManager(config)` — Main entry point (async)

```typescript
const manager = await createEmailManager({
  provider: "resend",
  providerConfig: { apiKey: "re_..." },
  defaultFrom: "noreply@app.com",
  templateOptions: { pretty: false, plainText: true },
});
```

Returns `Promise<EmailManager>` with:
- `send<TProps>(message: TemplatedEmailMessage<TProps>)` → `Promise<SendResult>`
- `validateConfig()` → `Promise<boolean>`
- `provider` (readonly) — underlying `EmailProvider`

### `renderTemplate(template, props, options?)` — Standalone renderer

Returns `Promise<Result<RenderedTemplate, EmailError>>` — never throws.

Default options: `{ plainText: true, pretty: false }`.

### `createProvider(name, config)` — Provider factory (async)

Returns `Promise<EmailProvider>`. Provider SDKs are dynamically imported — the library won't crash if an unused provider's package is missing. Throws on invalid config or missing SDK (fail-fast at setup). Currently supports `"resend"` only.

### Key exported types

- `EmailTemplateComponent<TProps>` — `(props: TProps) => React.ReactElement`, used for template parameter typing
- `SendSuccess` — `{ id: string; provider: string; sentAt: Date }`, returned in successful `SendResult.data`
- `EmailManagerConfig<P>` — generic over provider name, defaults to `"resend"`

## Core Patterns

### Result Pattern — never throw from public API

```typescript
type Result<T, E = Error> = { success: true; data: T } | { success: false; error: E };
type SendResult = Result<SendSuccess, EmailError>;
```

- Public API returns `Result` — check `result.success` before accessing data
- Only `createProvider()` and `createEmailManager()` reject/throw (fail-fast at setup)
- Use factory helpers: `fail()`, `emailError()`, `emailFail()`

### EmailError codes

`VALIDATION_ERROR` | `AUTHENTICATION_ERROR` | `RATE_LIMIT_ERROR` | `PROVIDER_ERROR` | `NETWORK_ERROR` | `TEMPLATE_ERROR` | `UNKNOWN_ERROR`

### Provider interface (Strategy pattern)

```typescript
interface EmailProvider {
  readonly name: string;
  send(message: EmailMessage): Promise<SendResult>;
  validateConfig(): Promise<boolean>;
}
```

New providers: implement `EmailProvider`, register in `registry.ts` switch, add config to `ProviderConfigMap`.

### Template-first sending

Every `send()` call requires a React Email component + props. The facade renders the template, then delegates to the provider:

```typescript
await manager.send({
  to: "user@example.com",
  subject: "Welcome!",
  template: WelcomeEmail,       // React Email component
  props: { name: "John" },      // Typed props
  // Optional: cc, bcc, replyTo, attachments, headers, tags, scheduledAt
});
```

### Composition over inheritance

`createProviderUtils(name)` returns `ProviderUtils` with shared utilities — no base class:
- `normalizeRecipient(recipient)` → `string`
- `normalizeRecipients(recipients)` → `string[]`
- `validateMessage(message)` → `Result<void, EmailError>`

### Recipient normalization

`EmailRecipient = string | { email: string; name?: string }` — providers normalize to strings internally. Max 50 recipients per send.

## Validation Rules

- `from` required (either in message or `defaultFrom`)
- `to` required, max 50 recipients, cannot be empty array
- `subject` required
- Either `html` or `text` must be present (enforced at provider level)
- API key validated at setup (empty/whitespace → throw)

## Logging

Two scoped loggers via `@nextnode-solutions/logger`:
- `logger` — general library operations
- `providerLogger` — provider-specific operations (prefixed `PROVIDER`)

## Commands

```bash
pnpm build           # tsup (ESM-only, minified, .d.ts)
pnpm lint            # oxlint
pnpm format          # oxfmt
pnpm type-check      # tsc --noEmit
pnpm test            # vitest run
pnpm test:coverage   # vitest + coverage
pnpm test:watch      # vitest watch
```

## Testing

Tests live in `__tests__/` at project root (not inside `src/`):
- `scaffolding.test.ts` — package identity, build config, scripts, hooks
- `types.test.ts` — type-level tests for all exported types + result factories
- `renderer.test.ts` — template rendering with mocked `@react-email/render`
- `resend-provider.test.ts` — provider send, error mapping, validation, config
- `email-manager.test.ts` — facade integration with mocked provider + renderer

## Adding a New Provider

1. Define config interface in `types/provider.ts`
2. Add entry to `ProviderConfigMap`
3. Create `providers/<name>.ts` implementing `EmailProvider`
4. Register in `providers/registry.ts` switch statement
5. Add tests in `__tests__/`
