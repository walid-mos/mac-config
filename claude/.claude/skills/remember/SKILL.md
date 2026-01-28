---
name: remember
description: Save knowledge to Claude configuration for future sessions
disable-model-invocation: true
allowed-tools: Read, Edit, Glob, AskUserQuestion
---

# Remember

Save knowledge to Claude configuration for future sessions.

## Instructions

When invoked with arguments:

### 1. Parse Input

The text after `/remember` is what to remember.

### 2. Determine Target File

Based on content type:

| Content Type | Target |
|--------------|--------|
| Project-specific | `./CLAUDE.md` (current project) |
| Global coding standards | `~/.stow_repository/claude/.claude/CLAUDE.md` |
| Language/framework | `~/.stow_repository/claude/.claude/skills/<skill>/SKILL.md` |
| Workflow rules | `~/.stow_repository/claude/.claude/rules/` |

### 3. Read Target File

Understand its structure before editing.

### 4. Propose Edit

Show:
- Which file will be modified
- Exact content to add
- Why this location was chosen

### 5. Ask for Approval

Wait for confirmation before making changes.

### 6. Execute Edit

If approved, apply the change.

## Available Config Locations

### Main Config
- `~/.stow_repository/claude/.claude/CLAUDE.md` - Global instructions

### Skills
- `skills/typescript/SKILL.md`
- `skills/react/SKILL.md`
- `skills/tailwind/SKILL.md`
- `skills/vitest/SKILL.md`

### Rules
- `rules/workflow.md`
- `rules/branch-protection.md`
- `rules/security.md`

## Example

**User**: `/remember always run tests before committing in this project`

**Claude**:
1. Detects project-specific
2. Checks if `./CLAUDE.md` exists
3. Proposes adding to project CLAUDE.md
4. Shows preview
5. Waits for approval
6. Edits file
