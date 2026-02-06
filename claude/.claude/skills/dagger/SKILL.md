---
name: dagger
description: Dagger CI/CD pipeline standards. Use when writing or reviewing Dagger modules, functions, and pipeline code (TypeScript SDK preferred).
user-invocable: false
---

# Dagger Standards (TypeScript SDK)

## Module Structure

- One module = one `@object()` class per file
- Expose public API via `@func()` decorated methods
- Private helpers stay as regular class methods (no decorator)
- Module name = directory name, PascalCase class name

```typescript
import { dag, Container, Directory, object, func } from "@dagger.io/dagger";

@object()
class MyModule {
  @func()
  async build(source: Directory): Promise<Container> {
    return dag
      .container()
      .from("node:22-alpine")
      .withDirectory("/app", source)
      .withWorkdir("/app")
      .withMountedCache("/root/.npm", dag.cacheVolume("npm"))
      .withExec(["npm", "ci"])
      .withExec(["npm", "run", "build"]);
  }
}
```

## Function Design

- Functions are the unit of work — composable, chainable, cacheable
- Chain methods fluently: `.from().withDirectory().withExec()`
- Return `Container` or `Directory` to enable downstream chaining
- Return `Promise<string>` only for terminal outputs (publish digest, stdout)
- Use function chaining within the class: `this.base()` for shared setup

## Caching

- ALWAYS mount cache volumes for package managers: `dag.cacheVolume("npm")`
- Default cache TTL is 7 days — override with `@func({ cache: "10s" })` when needed
- `cache: "session"` for values shared within a single run but not persisted
- `cache: "never"` for non-deterministic outputs (timestamps, random tokens)

## Secrets

- NEVER hardcode secrets — use `Secret` type as function parameter
- Inject via `withSecretVariable("ENV_NAME", secret)` — NEVER `withEnvVariable` for sensitive data
- Secrets are redacted from logs automatically

## Services

- Bind services with `withServiceBinding("alias", service)` for inter-container networking
- Service alias = hostname in the container network
- Expose ports explicitly when needed: `withExposedPort(8080)`

## Containers

- Start from minimal base images: `alpine`, `chainguard`, `distroless`
- Multi-stage: build in a full image, copy artifacts to minimal runtime
- `withWorkdir()` before `withExec()` — NEVER rely on image default workdir
- One logical step per `withExec()` — chain multiple for multi-step builds
- `withEnvVariable("CGO_ENABLED", "0")` for static Go binaries

## Patterns

- Test function: return `Container` with test command, caller decides `.stdout()` or `.sync()`
- Lint + test + build as separate `@func()` methods — compose in a `ci()` orchestrator
- Use `Directory` inputs, not paths — Dagger handles the transfer
- Platform-aware builds: iterate `Platform[]` array, collect into `platformVariants`
