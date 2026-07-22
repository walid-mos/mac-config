# GitHub org — `NextNodeSolutions`

How the org side of the infra works: secret layers, the `nextnode-ci`
GitHub App, environments. **Never hardcode secret lists in docs, prompts,
or code — query them live** with the commands below. Names change; the
retrieval mechanism doesn't.

## Discovering repos

```sh
gh repo list NextNodeSolutions --limit 100
```

## Secret layers (3) — and how to list them live

Secret VALUES are write-only on GitHub: you can list names and set values,
never read them. To know what exists, list; to know what a pipeline needs,
read the workflow/`nextnode.toml` that consumes it.

| Layer | Scope | Holds | List command |
|---|---|---|---|
| **Org secrets** | whole org, callers get them via `secrets: inherit` | cross-project infra credentials (cloud providers, CI app keys, npm) | `gh secret list --org NextNodeSolutions` |
| **Repo environment secrets** | one repo × one env (`development` / `production`) | per-project app secrets (API keys, auth secrets) + auto-generated secrets | `gh secret list --repo NextNodeSolutions/<repo> --env <environment>` |
| **Repo secrets** | one repo, all envs | rare — legacy or env-agnostic per-project values | `gh secret list --repo NextNodeSolutions/<repo>` |

Org variables (non-secret): `gh variable list --org NextNodeSolutions`
(e.g. prod-approval reviewer id).

Placement rule (= SKILL.md rule 10): per-project credential → repo
**env**-secret; cross-project credential → **org** secret. Repo-level
secrets are the exception, not a target.

## Setting / rotating a secret

```sh
gh secret set NAME --org NextNodeSolutions            # org (infra credential)
gh secret set NAME --repo NextNodeSolutions/<repo> --env production   # project
```

Pipe the value via stdin; never paste it into a command line that lands in
shell history shared with others, and never echo it back in chat.

**Freeze semantics**: GitHub snapshots secrets at *job start*. A secret set
mid-run (by you or by `ensureGeneratedSecrets`) is only visible to the
NEXT workflow run — the contract is *set → re-trigger deploy*.

## Auto-generated secrets

`provision` bootstraps `[deploy].secrets` entries declared as
`{name, generate, length}`: `ensureGeneratedSecrets` (and the postgres
`ensure-password` path) write absent values as **repo env-secrets** via
the `EnvSecretsAdapter` (`gh secret set --env`, adapter in
`src/adapters/github/env-secrets.ts`). Idempotent, non-rotating — rotation
is always an explicit command. R2 credentials self-heal the other way:
`ensureR2Setup` re-publishes rotated keys as **org** secrets.

## Cloudflare Workers target — org-level prerequisites

The `cloudflare-workers` target provisions with Terraform against HCP Terraform (state backend). Its credentials are **cross-project** infra credentials, so they live at the org level (SKILL.md rule 10), consumed by callers via `secrets: inherit` — never hardcode the values here, list them live with `gh secret list --org NextNodeSolutions`:

- The HCP Terraform state backend token is an org secret, consumed by the workflows as the env var `TF_TOKEN_app_terraform_io` (Terraform reads it natively). Cross-project → org, not repo-env.
- The existing Cloudflare API token must carry the scopes this target exercises: Workers Scripts, D1, KV, Queues, R2, Zone DNS, Zone Rulesets. Audit it (extend if a scope is missing) — confirm presence via `gh secret list --org NextNodeSolutions`, and read `deploy-workers.yml` to see what each one wires.

This is the one-shot org bootstrap; there is no per-project HCP or Cloudflare setup afterwards (the HCP workspace `<project>-<env>` is created create-if-absent at provision). See [cloudflare-workers.md](cloudflare-workers.md).

## The `nextnode-ci` GitHub App

The org's CI identity. Installed org-wide (`repository_selection: all`).
Workflows never use a PAT: they mint a short-lived **installation token**
per job via `actions/create-github-app-token@v2` fed by the org secrets
`NEXTNODE_APP_ID` + `NEXTNODE_APP_PRIVATE_KEY`, then export it as
`GH_TOKEN`/`GITHUB_TOKEN` for the steps that need real permissions:

- `publish-package.yml` → semantic-release (tags, releases, protected main)
- `deploy.yml` / `deploy-workers.yml` provision → writing generated env-secrets, org-secret self-heal
- `plan-workers-diff.yml` → commenting the Terraform plan diff on PRs
- `teardown-*.yml` → state cleanup

Inspect the app live (id, permissions — don't copy them into docs):

```sh
gh api /orgs/NextNodeSolutions/installations \
  -q '.installations[] | select(.app_slug=="nextnode-ci")'
```

Name collision warning: the **SSH key** named `nextnode-ci` used to reach
the VPSes (see `/ssh-nextnode`) is unrelated to the GitHub App — same
name, different credential.

## Environments

Every deployable repo has two GitHub environments, `development` and
`production`, matching the `environment` workflow input
(`PIPELINE_ENVIRONMENT`). Env-secrets attach to them; production approval
uses the org variable reviewer id. List: `gh api
/repos/NextNodeSolutions/<repo>/environments -q '.environments[].name'`.

## Debugging CI from the CLI

```sh
gh run list --repo NextNodeSolutions/<repo> --limit 10
gh run view <run-id> --repo NextNodeSolutions/<repo> --log-failed
gh workflow run <file>.yml --repo NextNodeSolutions/<repo>   # dispatch ops workflows
```

Reusable workflows live in `NextNodeSolutions/core/.github/workflows/`
(see [pipeline.md](pipeline.md)); a caller failing on a missing secret
almost always means a missing env-secret in the caller repo, not a
missing org secret — check the layer before adding anything.
