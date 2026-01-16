---
allowed-tools: Read, Write, Bash, AskUserQuestion, Glob
description: Save and organize a plan from the current conversation
---

# /planification

Save the current discussion's plan to the organized plans folder.

## Instructions

### 1. Identify Plan Content

Look in the current conversation for:
- Implementation plans discussed
- Technical decisions made
- Step-by-step instructions
- Architecture designs

If no clear plan exists, inform the user and ask what they want to save.

### 2. Ask for Category

Use AskUserQuestion to ask:

**Question**: "Where should this plan be saved?"

**Options**:
- `infrastructure` - VPS, CI/CD, env management, terraform, DevOps
- `projects/nextnode` - NextNode Solutions
- `projects/yasmine` - Yasmine app
- `projects/clients` - Client projects (will ask for client name)
- `features` - Cross-project features

### 3. Get Plan Details

Ask for a short descriptive name (2-4 words, kebab-case):
- Example inputs: "env management", "user auth", "payment integration"
- Will be converted to: `env-management`, `user-auth`, `payment-integration`

If `projects/clients` was selected, also ask for the client name.

### 4. Generate Filename

Format: `YYYY-MM-DD_descriptive-name.md`

```bash
# Get today's date
date +%Y-%m-%d
```

Example: `2026-01-12_env-management.md`

### 5. Compile Plan Content

Create a well-structured markdown document with:

```markdown
# [Plan Title]

## Overview

[Brief summary of what this plan covers]

## Context

[Why this plan was created, what problem it solves]

## Implementation

[Main content - steps, code, configurations]

## Verification

[How to test/verify the implementation]

## References

- Related files: [list paths]
- Dependencies: [list any dependencies]

---
Generated: YYYY-MM-DD
```

### 6. Save the Plan

Write to: `~/Documents/plans/<category>/<filename>`

Example paths:
- `~/Documents/plans/infrastructure/2026-01-12_env-management.md`
- `~/Documents/plans/projects/nextnode/2026-01-15_landing-page.md`
- `~/Documents/plans/projects/clients/acme_2026-02-01_api-integration.md`

### 7. Confirm

Tell the user:
- Where the plan was saved
- How to access it later
- Remind them to check `~/Documents/plans/README.md` for structure info

## Plans Folder Structure

```
~/Documents/plans/
├── README.md
├── infrastructure/
├── projects/
│   ├── nextnode/
│   ├── yasmine/
│   └── clients/
├── features/
└── archive/
```

## Example Flow

```
User: /planification

Claude: Looking at our conversation, I found a plan for [X].

Where should this plan be saved?
- infrastructure
- projects/nextnode
- projects/yasmine
- projects/clients
- features

User: infrastructure

Claude: What's a short name for this plan? (2-4 words)

User: env management

Claude: Saved to: ~/Documents/plans/infrastructure/2026-01-12_env-management.md
```
