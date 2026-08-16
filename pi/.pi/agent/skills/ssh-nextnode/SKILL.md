---
name: ssh-nextnode
description: >-
  SSH into a NextNode VPS (deploy user + nextnode-ci key) via Tailscale. Reads
  nextnode.toml to resolve the target hostname. Use when the user runs
  `ssh-nextnode`, asks to "ssh into the VPS", "connect to the production
  server", or wants a remote shell on a NextNode Hetzner host.
---

# SSH NextNode

Connect to a NextNode VPS via SSH with the mandatory credentials.

## FORBIDDEN / MANDATORY

| FORBIDDEN | MANDATORY |
|-----------|-----------|
| User `root` or any other user | User `deploy` always |
| Default SSH key or any identity file other than `nextnode-ci` | `-i ~/.ssh/nextnode-ci` always |
| Opening an interactive SSH session directly (an agent cannot hold an interactive TTY) | Give the user the interactive command to run themselves |
| Guessing the hostname when `nextnode.toml` is absent | Stop and ask the user which project to target |

**Base command:** `ssh -i ~/.ssh/nextnode-ci deploy@<host>`

## Arguments

- `project` (optional): Project name or path to resolve the VPS. Treat the first token as a project name only if a `nextnode.toml` exists in that path or a sibling directory of that name; otherwise treat all tokens as the remote command.
- `command` (optional): Remote command to execute. If omitted, suggest the interactive connection command.

Examples:
- ``ssh-nextnode`` - Resolve VPS from current project and show connection command
- ``ssh-nextnode` docker ps` - Run `docker ps` on the current project's VPS
- ``ssh-nextnode` myapp` - Resolve VPS for `myapp` project
- ``ssh-nextnode` myapp docker logs -f backend` - Run command on myapp's VPS

## Instructions

### Phase 1: Resolve the Tailscale hostname

1. If `nextnode.toml` is not found in the current directory and no `project` arg was given → **stop and ask the user which project to target. Do not guess.**
2. Read `nextnode.toml` and resolve the hostname:
   - If `[deploy].vps = "xxx"` is set → use that value verbatim (pins to a dedicated VPS, e.g. `monitoring`).
   - Otherwise → derive from the pipeline environment (`PIPELINE_ENVIRONMENT`), resolved by `resolveVpsName` (`src/domain/hetzner/resolve-vps-name.ts`):
     - `development` → `nn-dev`
     - `production` → `nn-prod`
   - Note: `[environment].development` in `nextnode.toml` does NOT pick the VPS — it only feeds the plan quality matrix (`developmentEnabled`). The dev pipeline deploys to `nn-dev`, the prod pipeline to `nn-prod`.

The resolved hostname is directly usable as a Tailscale host (e.g. `ssh deploy@nn-prod`).

### Phase 2: Connect

- If a **command** was provided, execute it:
  ```bash
  ssh -i ~/.ssh/nextnode-ci deploy@<tailscale-hostname> '<command>'
  ```
- If **no command** was provided, print the interactive connection command for the user to run in their own terminal:
  ```
  ssh -i ~/.ssh/nextnode-ci deploy@<tailscale-hostname>
  ```

## Troubleshooting

- If SSH connection fails, check that Tailscale is running locally (`tailscale status`).
- If the hostname doesn't resolve, the VPS may be down or not yet provisioned.
