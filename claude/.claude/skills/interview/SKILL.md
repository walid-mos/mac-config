---
name: interview
description: Interview user in-depth to create a detailed spec
argument-hint: [feature or task description]
allowed-tools: AskUserQuestion, Write, Read, Glob
---

# Interview

Conduct an in-depth interview to create a detailed specification file.

## Instructions

When invoked with arguments (e.g., `/interview user authentication system`):

### 1. Understand the Context

Read `$ARGUMENTS` to understand what the user wants to build.

### 2. Interview Process

Follow the user instructions and interview me in detail using the AskUserQuestionTool about literally anything: technical implementation, UI & UX, concerns, tradeoffs, etc. but make sure the questions are not obvious. be very in-depth and continue interviewing me continually until it's complete. then, write the spec to a file.

Use AskUserQuestion to interview the user about:

- **Technical implementation**: Architecture, tech stack, data models, APIs
- **UI & UX**: User flows, screens, interactions, error states
- **Business logic**: Rules, edge cases, validations
- **Concerns & constraints**: Performance, security, scalability
- **Tradeoffs**: Different approaches, pros/cons
- **Dependencies**: External services, existing code integration

**Guidelines:**
- Ask non-obvious, in-depth questions
- Continue interviewing until all aspects are covered
- Use multi-select questions when appropriate
- Group related questions together (max 4 per turn)

### 3. Write Spec File

Once the interview is complete, write a comprehensive spec to:

**Location:** `specs/<feature-name>.md` in the current project

**Structure:**
```
# Feature: <name>

## Overview
Brief description of what we're building.

## Requirements
- Functional requirements
- Non-functional requirements

## Technical Design
- Architecture decisions
- Data models
- API contracts

## UI/UX
- User flows
- Screen descriptions
- Interaction patterns

## Edge Cases & Error Handling

## Security Considerations

## Open Questions (if any)
```

### 4. Next Steps

After writing the spec, suggest:
- Enter Plan Mode to create implementation plan
- Use the spec file as reference

## Example

**User**: `/interview dashboard analytics feature`

**Claude**:
1. Asks about what metrics to track
2. Asks about data sources and refresh rates
3. Asks about visualization preferences
4. Asks about filtering/date range requirements
5. Asks about export/sharing capabilities
6. Asks about performance expectations
7. Writes `specs/dashboard-analytics.md`
