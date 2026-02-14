---
name: git-guardrails
description: Install a PreToolUse hook that blocks dangerous git commands (push, reset --hard, clean, branch -D, checkout ., restore .). Use when user wants to set up git safety guardrails for Claude Code.
user-invocable: true
---

# Git Guardrails

Installs a PreToolUse hook that intercepts and blocks destructive git commands before Claude executes them.

## Blocked Commands

- `git push` (all variants including `--force`)
- `git reset --hard`
- `git clean -f` / `git clean -fd`
- `git branch -D`
- `git checkout .`
- `git restore .`

When a blocked command is detected, Claude sees: "The user has prevented you from doing this."

## Installation Workflow

### 1. Ask Scope

Ask the user whether to install project-only or globally:

- **Project** (`.claude/settings.json` + `.claude/hooks/`)
- **Global** (`~/.claude/settings.json` + `~/.claude/hooks/`)

### 2. Deploy the Hook Script

Copy `scripts/block-dangerous-git.sh` to the target location:

- Project: `.claude/hooks/block-dangerous-git.sh`
- Global: `~/.claude/hooks/block-dangerous-git.sh`

Make it executable: `chmod +x <path>`

### 3. Configure Settings

Add a PreToolUse hook entry to the appropriate `settings.json`:

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "<path-to-script>"
          }
        ]
      }
    ]
  }
}
```

**IMPORTANT**: If hooks already exist in settings, MERGE the new hook into the existing `PreToolUse` array — do not overwrite.

### 4. Offer Customization

Ask the user if they want to modify the blocked patterns. They can edit the script to add or remove patterns.

### 5. Verify

Test the hook with:

```bash
echo '{"tool_input":{"command":"git push origin main"}}' | <path-to-script>
```

Should return exit code 2 with a BLOCKED message on stderr.
