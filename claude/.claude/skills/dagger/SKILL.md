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

## Module File Structure

Dagger TypeScript SDK requires a specific layout. Entry point is at `src/src/index.ts`:

```
my-module/
├── dagger.json                    # { "sdk": { "source": "typescript" }, "source": "src" }
└── src/                           # Source root
    ├── package.json               # ⚠️ Module dependencies go HERE
    ├── tsconfig.json
    └── src/
        └── index.ts               # ⚠️ Module code (the @object() class)
```

- Run `dagger develop` after creating a module to generate SDK artifacts (`sdk/`, configs)
- Dependencies in `src/package.json`, NOT in a root-level `package.json`
- Verify with `dagger functions` to list available functions

## Container Environment Gotchas

### CI Detection

Tools like `semantic-release` check for CI environment. Dagger containers are NOT auto-detected as CI:

```typescript
.withEnvVariable("CI", "true")
```

### pnpm Global Installs

`pnpm add -g` fails in containers without `PNPM_HOME`:

```typescript
.withEnvVariable("PNPM_HOME", "/root/.local/share/pnpm")
.withEnvVariable("PATH", "/root/.local/share/pnpm:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin")
```

### Git Authentication with GITHUB_TOKEN

For tools that push to git (semantic-release, changesets), configure a credential helper:

```typescript
.withSecretVariable("GITHUB_TOKEN", githubToken)
.withExec([
  "sh", "-c",
  'git config --global credential.helper "!f() { echo username=x-access-token; echo password=$GITHUB_TOKEN; }; f"',
])
```

### Cache Busting

Use `withEnvVariable("CACHE_BUST", Date.now().toString())` to force re-execution of steps that should never be cached (e.g., `semantic-release`, `npm publish`).

## Patterns

- Test function: return `Container` with test command, caller decides `.stdout()` or `.sync()`
- Lint + test + build as separate `@func()` methods — compose in a `ci()` orchestrator
- Use `Directory` inputs, not paths — Dagger handles the transfer
- Platform-aware builds: iterate `Platform[]` array, collect into `platformVariants`

## GitHub Actions Integration

When using `dagger-for-github@v6`, set `verb: version` for install-only mode:

```yaml
- uses: dagger/dagger-for-github@v6
  with:
    version: "0.19.11"
    verb: version        # ← install only, don't run dagger call
- run: dagger call -m <module> <function> --arg value
```

The action defaults to `verb: call` which executes bare `dagger call` and fails if no local `dagger.json` exists.
