# Workers dev runtime — `nextnode-workers-dev`

Keeps local `wrangler dev` on the same Cloudflare Workers runtime the fleet
deploys, and refuses to start on a stale `workerd` instead of silently
floating to a compatibility date the installed runtime can't honour.

## Why it exists

`wrangler dev` needs a `compatibility_date`. Pinning it in a committed
`wrangler.jsonc` (or letting it float to today) drifts against whatever
`workerd` version happens to be installed. Rather than generate + commit a
config file and drift-guard it in CI, the fleet date lives in one constant and
a thin wrapper injects it, checking runtime freshness first.

The infrastructure package (`@nextnode-solutions/infrastructure`) is CI-only —
never installed in a consumer repo — so the local guard ships from
`@nextnode-solutions/standards`, which every project already installs.

## Consumer wiring

Applies to a Cloudflare Workers app bundled by `wrangler` (e.g. a Hono API) —
NOT the Astro fronts, which boot through `astro dev`. Wire it once per service:

1. `@nextnode-solutions/standards` at a version that ships the bin (`>=1.16.0`)
   in the repo's devDependencies — it is the source of `nextnode-workers-dev`.
2. `wrangler` in the app's devDependencies — the bin resolves it from the
   project's own `node_modules` and fails loudly if absent.
3. Point the dev script at the wrapper:
   ```jsonc
   // apps/<service>/package.json
   "scripts": {
     "dev": "nextnode-workers-dev src/index.ts --port 8787"
   }
   ```
4. Delete any committed/generated `wrangler.jsonc` used only for local dev —
   the wrapper supplies the compatibility date, so no dev config file is kept.

`nextnode-workers-dev` forwards every argument to `wrangler dev`, then appends
`--compatibility-date=<fleet date>` and `--compatibility-flags nodejs_compat`.
On a `workerd` older than the fleet date it exits non-zero pointing at
`pnpm update wrangler`; otherwise it execs `wrangler dev`. No committed wrangler
config, no generated file, no CI step.

**Apply this diff identically across every in-flight branch/worktree** (dev
script line + standards bump are byte-identical everywhere) so parallel
branches never conflict on merge.

**Fresh-publish gate:** if the standards version was just released, `pnpm add`
appends it to `minimumReleaseAgeExclude` in `pnpm-workspace.yaml` (the
release-age policy gates brand-new versions). The entry is identical across
worktrees — no merge conflict — and can be dropped once the version has aged
past the threshold.

## The `./workers` export

```ts
import {
  WORKERS_COMPATIBILITY_DATE,   // e.g. '2026-07-14'
  WORKERS_COMPATIBILITY_FLAGS,  // ['nodejs_compat']
} from '@nextnode-solutions/standards/workers'
```

`WORKERS_COMPATIBILITY_DATE` is the single source of truth for the local dev
runtime. It MUST equal `DEFAULT_WORKERS_COMPATIBILITY_DATE` in
`@nextnode-solutions/infrastructure` (the deploy-time pin);
`compatibility-drift.test.ts` in that package fails the monorepo build if they
diverge.

## Bumping the fleet date

1. Edit `WORKERS_COMPATIBILITY_DATE` in `packages/standards/src/workers/compatibility.js`.
2. Match `DEFAULT_WORKERS_COMPATIBILITY_DATE` in infrastructure's `wrangler-document.ts` (the drift test enforces this).
3. Run `pnpm update wrangler` across the fleet so every local `workerd` is new enough.

A bump is a deliberate, reviewed change - one edit in each package, guarded by the test.
