# Folder structure - @nextnode-solutions/infrastructure

```
src/
  index.ts                          - Command registry + argv dispatch
  cli/
    env.ts                          - requireEnv, getEnv
    secrets.ts                      - parseAllSecrets, pickSecrets
    deploy/
      create-target.ts              - Factory: config + env → DeployTarget
      provision.command.ts          - target.ensureInfra() + step summary
      deploy.command.ts             - Merge target+services+secrets envs, target.deploy()
      dns.command.ts                - target.reconcileDns()
      teardown.command.ts           - target.teardown()
      teardown-guard.command.ts     - Validate teardown preconditions
      seo-guard.command.ts          - SEO guard injection
      compute-image-ref.command.ts  - Compute GHCR ref → GITHUB_OUTPUT
    pipeline/
      plan.command.ts               - Plan + quality matrix
      prod-gate.command.ts          - Dev pipeline check
      publish-result.command.ts     - SR output parsing
    hetzner/
      build-golden-image.command.ts - Golden-image builder orchestrator
      recover.command.ts            - Recover/rebuild VPS state from labels
      converge.ts                   - Shared post-boot convergence helpers
  domain/                            - Pure logic. NO IO, NO env, NO logger
    environment.ts                  - AppEnvironment, PipelineEnvironment, resolveEnvironment
    deploy/
      target.ts                     - DeployTarget interface, DeployEnv, TargetEnv, DeployInput, ProvisionResult
      domain.ts                     - resolveDeployDomain (single source for dev subdomain)
      image-ref.ts                  - parseImageRef
      seo-guard.ts                  - computeSeoGuardFiles (pure)
      teardown-result.ts            - TeardownResult shape
      teardown-target.ts            - TeardownTarget enum
      verify-teardown-confirmation.ts - Teardown safety check
      resource-outcome.ts           - VpsResourceOutcome, PagesResourceOutcome
      execute-handlers.ts           - Per-target deploy handler routing
      summary-renderer.ts           - Markdown summary renderer
      deploy-summary.ts             - buildDeploySummary
      provision-summary.ts          - buildProvisionSummary
      teardown-summary.ts           - buildTeardownSummary
    services/                       - Provider-agnostic backing services (NEW)
      service.ts                    - ServiceEnv interface (public, secret), mergeServiceEnvs
      r2.ts                         - R2BucketBinding, R2ServiceState, buildR2ServiceEnv (see [r2-service.md](r2-service.md))
    cloudflare/
      dns-records.ts                - computeDnsRecords (CNAME for Pages)
      pages-domains.ts              - computePagesDomains (pure)
      pages-project-name.ts         - computePagesProjectName (pure)
      managed-resources.ts          - Pages resource type tags
      r2/
        addressing.ts               - computeR2Endpoint, computeR2Host
        credentials.ts              - deriveR2Credentials (CF token → S3 creds via SHA256)
        token-policy.ts             - buildR2TokenPolicy
        runtime-config.ts           - R2 runtime config types
        caddy-binding.ts            - Pages project R2 binding mapping
    hetzner/
      caddy-config.ts               - Caddy JSON config types
      build-caddy-config.ts         - buildCaddyConfig + buildInternalCaddyConfig (pure)
      cloud-init.ts                 - renderCloudInit (deploy user, UFW, tailscale)
      dns-records.ts                - computeVpsDnsRecords (A records, internal-aware)
      firewall-rules.ts             - computeFirewallRules (internal-aware)
      vector-config.ts, vector-env.ts, vector-toml.ts - Vector config & env
      env-silo.ts, compute-silo.ts  - EnvSilo type + computeSilo (pure)
      compose-env.ts                - formatComposeEnv (KEY=val serializer)
      compose-file.ts               - renderComposeFile (docker-compose generation)
      managed-resources.ts          - Hetzner resource type tags + label keys
      orphans.ts                    - Detect orphan servers/resources
      golden-image.ts               - Golden image fingerprint, label keys (see [golden-image.md](golden-image.md))
      golden-image-summary.ts       - Build golden-image step summary
      select-golden-image.ts        - Pick newest matching snapshot
      resolve-vps-name.ts           - Resolve shared VPS hostname per env
      caddy-env.ts                  - Caddy ACME env (R2 cert storage)
    pipeline/
      prod-gate.ts                  - findDevRun, evaluateDevRun
      quality-matrix.ts             - buildQualityMatrix, hasProdGate
      publish-result.ts             - parseSemanticReleaseOutput
    aws/                            - Pure SigV4 helpers (used by R2 verify)
    storage/, http/, dns/, tailnet/  - Supporting pure domains
  adapters/                          - IO boundary
    cloudflare/
      target.ts                     - CloudflarePagesTarget (DeployTarget impl)
      pages-project.ts              - provisionProject
      pages-domains.ts, pages-dns.ts - Reconciliation
      accounts.ts                   - resolveAccountId
      permission-groups.ts          - resolveR2PermissionGroupIds
      r2/
        buckets.ts                  - ensureR2Bucket
        tokens.ts                   - createR2Token
    hetzner/
      target.ts                     - HetznerVpsTarget (DeployTarget impl)
      hcloud-client.ts              - Typed HTTP client to Hetzner Cloud API
      hcloud-state.ts               - R2 state persistence with ETag locking
      ssh-session.ts                - ssh2 wrapper, one connection per op
      api/                          - Image, network, firewall, server, ssh-key endpoints
      provision/                    - build-golden-image.ts (Dockerfile + SSH provisioning), cloud-init wiring, security setup
      constants.ts                  - Labels, MAX_GOLDEN_IMAGE_SNAPSHOTS
    r2/
      client.ts                     - S3 SDK wrapper for state + certs + service buckets
      verify-credentials.ts         - SigV4 handshake (R2 credential self-heal)
    github/
      api.ts                        - fetchWorkflowRuns
      plan-outputs.ts               - writePlanOutputs
      env.ts                        - writeOutput, writeSummary
    build-output/                   - inject-files (SEO guard)
  config/                           - nextnode.toml schema + loader (see [config.md](config.md))
    validators/, providers/         - Per-target validation
```

See `packages/infrastructure/CLAUDE.md` for the strict layer import rules - domain MUST be pure (no IO, no env, no logger), adapters never make business decisions, CLI orchestrates.
