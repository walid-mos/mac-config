# Add manual release/canary trigger via workflow_dispatch

## Context
When manually triggering the CI pipeline (`workflow_dispatch`), releases and canary publishes are skipped because `isRelease` only matches `push` events on `main`. We need a select input on manual triggers to choose: none (default), release, or canary.

## Files to modify

### 1. `infrastructure/templates/ci.yml` — Add `release_mode` select input
Add a `workflow_dispatch` choice input `release_mode` with options: `none`, `release`, `canary` (default: `none`). Pass it through to `pipeline.yml`.

### 2. `infrastructure/.github/workflows/pipeline.yml` — Plumb `release_mode` through
- Add `release_mode` to `workflow_call.inputs` (string, default `"none"`)
- Add `release_mode` to `workflow_dispatch.inputs` as a choice (for direct dispatch on infrastructure repo)
- Pass `--release-mode "${{ inputs.release_mode }}"` to the `dagger call plan` command

### 3. `infrastructure/dagger-modules/pipeline/src/src/index.ts` — Handle `releaseMode` in `plan()`
- Add `releaseMode` parameter (string, default `"none"`) to `plan()` function
- Update logic:
  ```
  const isRelease = (eventName === "push" && ref === "refs/heads/main") || releaseMode === "release";
  const isCanary = (...existing logic...) || releaseMode === "canary";
  ```

## Verification
1. Push changes to `main` in infrastructure repo
2. Go to any repo using `ci.yml` template → Actions → Run workflow
3. Verify the `release_mode` select appears with none/release/canary
4. Select `release` → pipeline should proceed to publish after build
5. Select `canary` → pipeline should proceed to canary publish after build
6. Select `none` (default) → pipeline should stop after build (existing behavior)
