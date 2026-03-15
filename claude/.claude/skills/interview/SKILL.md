---
name: interview
description: Deep interview for a single feature or module brief that produces a final spec or implementation plan.
argument-hint: [feature, module, or brief description]
allowed-tools: AskUserQuestion, Write, Read, Glob, Grep, Edit, Task, Skill
---

# Interview Skill

Interview the user in depth about **one feature, one module, or one implementation stream**, then produce a final spec or implementation plan document.

`/interview` is the **micro-specification** skill. It goes deeper than `/planification` and produces the final document that implementation work should follow.

---

## When To Use This Skill

Use `/interview` when:
- the request is one feature
- the request is one module from a larger plan
- the user already has a brief and wants a final spec
- the user wants one implementation plan instead of project decomposition

Do **not** use `/interview` for a large multi-module roadmap. Use `/planification` first.

If the prompt clearly contains 2 or more independent modules, stop and recommend `/planification`.

---

## Argument Parsing

The user invokes `/interview <free-form prompt>`.

There is no `spec` or `plan` prefix. The skill determines the output type during the interview, or asks the user if needed.

Derive a **date-prefixed kebab-case** feature name from the prompt for the output filename.

Examples:
- `/interview authentication system with OAuth and magic links` -> `260315-auth-system`
- `/interview turn docs/specs/billing.brief.md into a final spec` -> `260315-billing`

---

## Optional Brief Intake

Before starting the interview, check whether the prompt refers to an existing brief such as `docs/specs/*.brief.md`.

If a matching brief exists:
- read it first
- treat it as upstream context
- use it to guide the interview
- resolve every important `Open Questions For Interview` item during the session

The brief is input material, not the final output.

---

## Update Mode Detection

Before starting the interview:

1. Glob `docs/specs/*.spec.md`, `docs/specs/*.brief.md`, and check whether `docs/plan.md` exists
2. If an existing final document matches the subject:
   - read and summarize it
   - ask via AskUserQuestion:
     - **Deepen**: refine and enrich the existing document
     - **New spec**: create a separate new document
     - **Replace**: overwrite the existing document from scratch
3. If only a brief exists, use the brief as context and continue toward a final document

---

## Interview Process

Conduct a deep, adaptive interview for this single stream of work.

- Ask non-obvious questions that build on earlier answers
- Go deep enough to remove ambiguity
- Cover whatever matters for the module: data model, business rules, API design, UI/UX, security, performance, error handling, edge cases, dependencies, rollout constraints
- Prefer a few dense rounds over many shallow rounds
- Use AskUserQuestion for bounded choices
- End only when the output can serve as a final implementation reference

When working from a brief:
- preserve the module boundary from the brief
- deepen the details substantially
- convert open questions into concrete decisions
- challenge vague assumptions before writing the final document

---

## Output

After the interview is complete, write the final document using one of these targets:

- `docs/specs/<feature-name>.spec.md` for final specs
- `docs/plan.md` for plans

### Final Spec Expectations

A final spec should be implementation-grade:
- has `FR-*` requirements
- has enough detail to derive tests from
- has explicit scope boundaries
- has acceptance criteria
- has no unresolved critical ambiguity

### Spec Template

```markdown
# <Feature Name> — Spec

## Overview
Brief description of the feature and its purpose.

## Context
Why this feature is needed and how it fits the current project.

## Functional Requirements
- **FR-1**: ...
- **FR-2**: ...
- **FR-3**: ...

## Data Model
Entities, fields, relationships, and types.

## API Contract
Endpoints, methods, payloads, responses, and status codes.

## UI/UX Requirements
Screens, components, interactions, states, accessibility, and responsive behavior.

## Business Logic
Rules, calculations, workflows, invariants.

## Edge Cases
Unusual scenarios and how they are handled.

## Security
Authentication, authorization, validation, and data protection.

## Performance
Targets, limits, and optimization considerations.

## Dependencies
Internal and external dependencies.

## Human Prerequisites
Accounts, secrets, approvals, assets, DNS, or manual setup.

## Out of Scope
What this spec explicitly does not cover.

## Acceptance Criteria
- [ ] ...
- [ ] ...

## Open Questions
Leave empty or omit entirely when the spec is ready.
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
Key choices and rationale.

## File Changes Summary
Overview of files to create, modify, or delete.

## Testing Strategy
What to test, how, and what proves completion.

## Risks & Mitigations
Potential issues and how to address them.

## Open Questions
Leave empty or omit entirely when possible.
```

---

## Update Mode (Deepen)

When deepening an existing document:

- Use Edit, not Write
- Preserve valuable existing content
- Add or refine sections based on the interview
- Do not delete content unless the user explicitly wants replacement
- Add or append a `## Revision History` section

---

## Relationship With Other Skills

- `/planification` creates briefs and manifests for large projects
- `/interview` turns one brief or one feature request into a final spec or plan
- `/swarm` should consume the final spec produced here, not a high-level brief

---

## Constraints

- Focus on exactly one module, feature, or implementation stream
- If the prompt is multi-module, redirect to `/planification`
- Final output must be materially more detailed than any upstream brief
- Use AskUserQuestion for bounded decisions
- No code generation during the interview
