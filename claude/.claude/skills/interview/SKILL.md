---
name: interview
description: Interview user in-depth to create detailed specs or implementation plans
argument-hint: [feature or task description]
allowed-tools: AskUserQuestion, Write, Read, Glob, Grep, Edit
---

# Interview Skill

Interview the user in depth about their feature or task, then produce a detailed spec or implementation plan document.

## Argument Parsing

The user invokes `/interview <free-form prompt>`. There is no `specs` or `plan` prefix — the skill determines the output type (spec vs plan) organically during the interview, or asks the user if ambiguous.

Derive a **date-prefixed kebab-case** feature name from the prompt for the output filename. The prefix is today's date in `YYMMDD` format (6 digits, no separators), followed by a hyphen, then the kebab-case slug.

Examples (assuming today is 2026-02-16):
- `/interview I want a skill that loops with multiple agents` → `260216-multi-agent-loop`
- `/interview authentication system with OAuth and magic links` → `260216-auth-system`

## Update Mode Detection

Before starting the interview, check for existing documents:

1. Glob `docs/specs/*.spec.md` and check if `docs/plan.md` exists
2. If an existing file matches the subject:
   - Read the file and briefly summarize its contents to the user
   - Ask via AskUserQuestion with these options:
     - **Deepen**: start from existing content, interview to refine and enrich (use Edit at the end)
     - **New spec**: ignore existing content, start fresh (create a new file with a different name)
     - **Replace**: delete existing content and start from scratch (overwrite the file)
3. If no file matches: proceed with a fresh interview

## Interview Process

Conduct a thorough, adaptive interview:

- Ask non-obvious, in-depth questions that build on previous answers
- No rigid phases or fixed number of rounds — go as deep as necessary
- If an answer opens 10 new questions, ask them
- Strike the right balance: not too atomic (no trivial either/or questions just for the sake of it), but precise enough to produce ultra-detailed specs
- Cover organically as relevant: technical implementation, UI/UX, business logic, edge cases, security, performance, tradeoffs, dependencies, error handling, data model, API design...
- End the interview when there is enough material to write a complete, precise document
- Use AskUserQuestion for each round of questions — batch related questions together when it makes sense, but prefer depth over breadth

## Output

### Directory Structure

```
docs/
  specs/
    <feature-name>.spec.md
  plan.md
```

- `docs/specs/<feature-name>.spec.md` for specs
- `docs/plan.md` for plans (before specs are written)
- No index file

### Spec Template

```markdown
# <Feature Name> — Spec

## Overview
Brief description of the feature and its purpose.

## Context
Why this feature is needed, current state, motivation.

## Functional Requirements
- **FR-1**: ...
- **FR-2**: ...
- **FR-3**: ...

## Data Model
Entities, fields, relationships, types.

## API Contract
Endpoints, methods, request/response shapes, status codes.

## UI/UX Requirements
Screens, components, interactions, states, responsive behavior.

## Edge Cases
Unusual scenarios and how to handle them.

## Security
Authentication, authorization, input validation, data protection.

## Performance
Targets, caching strategy, optimization considerations.

## Dependencies
External services, libraries, internal modules.

## Out of Scope
What this spec explicitly does NOT cover.

## Open Questions
Unresolved decisions or items needing further discussion.
```

### Plan Template

```markdown
# <Feature Name> — Plan

## Overview
Brief description of the plan and its goals.

## Prerequisites
What must be in place before starting.

## Implementation Phases

### Phase 1: ...
- **Tasks**: ...
- **Files**: ...
- **Effort**: ...

### Phase 2: ...
- **Tasks**: ...
- **Files**: ...
- **Effort**: ...

## Technical Decisions
Key choices and their rationale.

## File Changes Summary
Overview of files to create, modify, or delete.

## Testing Strategy
What to test, how, and acceptance criteria.

## Risks & Mitigations
Potential issues and how to address them.

## Open Questions
Unresolved decisions or items needing further discussion.
```

## Update Mode (Deepen)

When deepening an existing document:

- Use Edit (not Write) to preserve existing content
- Add or enrich sections based on new information
- Never delete content unless the user explicitly asks
- Add a `## Revision History` section at the end (or append to it) with date and description:

```markdown
## Revision History
- **2026-02-05**: Deepened security requirements, added OAuth flow details
```
