---
name: planification
description: Save and organize a plan from the current conversation
disable-model-invocation: true
allowed-tools: Read, Write, Bash, AskUserQuestion, Glob
---

# Planification

Save the current discussion's plan to the organized plans folder.

## Instructions

### 1. Identify Plan Content

Look for:
- Implementation plans
- Technical decisions
- Step-by-step instructions
- Architecture designs

If no clear plan exists, ask what to save.

### 2. Ask for Category

**Question**: "Where should this plan be saved?"

**Options**:
- `infrastructure` - VPS, CI/CD, DevOps
- `projects/nextnode` - NextNode Solutions
- `projects/yasmine` - Yasmine app
- `projects/clients` - Client projects
- `features` - Cross-project features

### 3. Get Plan Name

Ask for short descriptive name (2-4 words, kebab-case):
- "env management" -> `env-management`
- "user auth" -> `user-auth`

### 4. Generate Filename

Format: `YYYY-MM-DD_descriptive-name.md`

```bash
date +%Y-%m-%d
```

### 5. Compile Plan Content

```markdown
# [Plan Title]

## Overview
[Brief summary]

## Context
[Why this plan was created]

## Implementation
[Main content - steps, code, configurations]

## Verification
[How to test/verify]

## References
- Related files: [list paths]
- Dependencies: [list any]

---
Generated: YYYY-MM-DD
```

### 6. Save Plan

Path: `~/Documents/plans/<category>/<filename>`

Examples:
- `~/Documents/plans/infrastructure/2026-01-12_env-management.md`
- `~/Documents/plans/projects/nextnode/2026-01-15_landing-page.md`

### 7. Confirm

Tell user:
- Where plan was saved
- How to access later

## Folder Structure

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
