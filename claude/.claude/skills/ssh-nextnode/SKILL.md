---
name: ssh-nextnode
description: >-
  SSH into a NextNode VPS using the correct credentials (deploy user + nextnode-ci key).
  Resolves the target host from the project's nextnode.toml via Tailscale hostname.
user-invocable: true
---

# SSH NextNode

Connect to a NextNode VPS via SSH with the mandatory credentials.

## Rules (non-negotiable)

- **User:** always `deploy`. Never `root` or any other user.
- **Key:** always `~/.ssh/nextnode-ci` (`-i ~/.ssh/nextnode-ci`). Never the default SSH key or any other identity file.
- **Base command:** `ssh -i ~/.ssh/nextnode-ci deploy@<host>`
- **Sandbox:** ALL Bash commands in this skill (ssh, scp, tailscale, etc.) MUST use `dangerouslyDisableSandbox: true`. SSH and network operations will always fail inside the sandbox.

## Arguments

- `project` (optional): Project name or path to resolve the VPS. If omitted, use the current directory's `nextnode.toml`.
- `command` (optional): Command to execute remotely. If omitted, suggest the interactive connection command.

Examples:
- `/ssh-nextnode` - Resolve VPS from current project and show connection command
- `/ssh-nextnode docker ps` - Run `docker ps` on the current project's VPS
- `/ssh-nextnode myapp` - Resolve VPS for `myapp` project
- `/ssh-nextnode myapp docker logs -f backend` - Run command on myapp's VPS

## Instructions

### Phase 1: Resolve the Tailscale hostname

The VPS hostname in Tailscale is derived from the project config. Read `nextnode.toml` (current directory or provided project) and resolve:

1. If `[server] name = "xxx"` is set → the VPS is a **shared VPS**, hostname = that `name` value (e.g. `shared-prod`, or the literal name).
2. If no `server.name` → the VPS is **dedicated**, hostname = `project.name` from `[project]`.

The resolved hostname is directly usable as a Tailscale host (e.g. `ssh deploy@myproject`).

### Phase 2: Connect

- If a **command** was provided, execute it:
  ```bash
  ssh -i ~/.ssh/nextnode-ci deploy@<tailscale-hostname> '<command>'
  ```
- If **no command** was provided, suggest the user run the interactive session themselves with the `!` prefix:
  ```
  ! ssh -i ~/.ssh/nextnode-ci deploy@<tailscale-hostname>
  ```
  Do NOT attempt to open an interactive SSH session directly.

### Phase 3: File transfer (if needed)

For file transfers, use `scp` with the same credentials:
```bash
scp -i ~/.ssh/nextnode-ci <local_path> deploy@<tailscale-hostname>:<remote_path>
scp -i ~/.ssh/nextnode-ci deploy@<tailscale-hostname>:<remote_path> <local_path>
```

## Troubleshooting

- If SSH connection fails, check that Tailscale is running locally (`tailscale status`).
- If the hostname doesn't resolve, the VPS may be down or not yet provisioned.
- For PR preview environments, the hostname is the same dev VPS (shared). Container names include the PR number prefix.
