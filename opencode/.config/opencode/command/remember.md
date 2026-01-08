---
description: Save knowledge to OpenCode configuration for future sessions
---

# /remember

Save knowledge to your OpenCode configuration for future sessions.

## Instructions

When invoked with arguments:

### 1. Parse the input

The text after `/remember` is what the user wants to remember.

### 2. Determine target file

| Content Type            | Target File                                        |
| ----------------------- | -------------------------------------------------- |
| Project-specific info   | `./AGENTS.md` (if exists) or `.opencode/AGENTS.md` |
| Global coding standards | `~/.config/opencode/AGENTS.md`                     |
| TypeScript guidelines   | `~/.config/opencode/instructions/typescript.md`    |
| Refactoring rules       | `~/.config/opencode/instructions/refactoring.md`   |
| Agent definitions       | `~/.config/opencode/agent/<name>.md`               |
| Custom commands         | `~/.config/opencode/command/<name>.md`             |

### 3. Read target file

Understand its current structure before editing.

### 4. Propose the edit

Show:

- Which file will be modified
- The exact content to add
- Why this location was chosen

### 5. Ask for approval

Wait for user confirmation before making changes.

### 6. Execute the edit

If approved, make the change.

## Available Config Files

### Main Config

- `~/.config/opencode/AGENTS.md` - Global instructions
- `~/.config/opencode/opencode.json` - Main configuration

### Instructions (loaded on-demand)

- `instructions/typescript.md` - TypeScript standards
- `instructions/refactoring.md` - Refactoring guidelines

### Agents

- `agent/code-refactor.md`
- `agent/security-review.md`
- `agent/project-scanner.md`
- `agent/fallback-detector.md`
- `agent/nextnode-brand.md`

### Commands

- `command/fix-reviews.md`
- `command/remember.md`

## Example

User: `/remember always run tests before committing in this project`
