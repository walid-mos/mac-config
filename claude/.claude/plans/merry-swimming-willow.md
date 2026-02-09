# Fix: Shared VPS naming — use environment-based names instead of app name

## Context

When an app has no `[server]` section in `nextnode.toml` (Tier 1), it should deploy to a **shared VPS** — not get its own. Currently, `TF_VAR_app_name` is always set to the app name (e.g., "ysumai"), so even on the `nextnode-shared` workspace, Terraform creates/renames the VPS to the app name. This is wrong for two reasons:
1. The shared VPS gets named after whichever app last deployed
2. Each Tier 1 deploy could try to rename the VPS, causing conflicts

**Naming convention:**
- Shared (no `[server]`): VPS = `shared-{environment}`, workspace = `nextnode-shared-{environment}`
- Dedicated (has `[server]`): VPS = `custom-{appName}`, workspace = `nextnode-{appName}`

## Changes

### 1. `dagger-modules/vps/src/src/index.ts` — `provisionAndDeploy` (lines 57-59, 74-85)

**Current:**
```typescript
const workspaceName = hasServer ? `nextnode-${appConfig.appName}` : "nextnode-shared";
```

**New:**
```typescript
const vpsName = hasServer ? `custom-${appConfig.appName}` : `shared-${environment}`;
const workspaceName = hasServer
  ? `nextnode-${appConfig.appName}`
  : `nextnode-shared-${environment}`;
```

Then, override `appName` in the config passed to `provision`:

```typescript
const provisionConfig = { ...appConfig, appName: vpsName };
```

Pass `provisionConfig` to `this.provision(...)` instead of `appConfig`. This ensures:
- `TF_VAR_app_name` = `custom-{appName}` or `shared-{environment}`
- The Hetzner VPS name matches the convention
- Deploy still uses the real `appConfig.appName` for `COMPOSE_PROJECT_NAME` and `/opt/apps/{appName}`

### 2. Update flow comment (line 28)

Update the provisioning flow comment to reflect new naming:
```
* 2. Determine target workspace (nextnode-shared-{env} or nextnode-<app>)
```

## Files Modified

- `dagger-modules/vps/src/src/index.ts` (lines ~28, 59, 74-85)
- `tests/vps-module.test.ts` (line 140) — update `"nextnode-shared"` → `"nextnode-shared-"` (partial match since it's now environment-suffixed)
- `tests/plane-validation.test.ts` (line 82) — update workspace fallback to `"nextnode-shared-"` pattern

## What stays the same

- `deploy()` still uses `appConfig.appName` (real app name) for `COMPOSE_PROJECT_NAME` and `/opt/apps/{appName}` — multiple apps coexist on the shared VPS via Docker namespacing
- Dedicated VPS apps (with `[server]`) are unaffected
- Terraform module (`terraform/apps/main.tf`) needs no changes — `var.app_name` just receives the right value

## Verification

1. Check that for an app **without** `[server]`: workspace = `nextnode-shared-production`, VPS name = `shared-production`
2. Check that for an app **with** `[server]`: workspace = `nextnode-{appName}`, VPS name = `custom-{appName}`
3. Run existing tests: `cd dagger-modules/vps && dagger develop && dagger functions`
4. Check for any tests in `/tests/` that reference `nextnode-shared` and update them
