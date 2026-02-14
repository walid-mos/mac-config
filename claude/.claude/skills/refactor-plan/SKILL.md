---
name: refactor-plan
description: Deep refactoring interview that produces a structured GitHub issue with commit plan, testing strategy, and decision document. Use when user wants to plan a refactoring effort.
user-invocable: true
---

# Refactor Plan

## Workflow

Go through each step below. Skip steps only if clearly unnecessary.

### 1. Problem Discovery

Ask the user for a long, detailed description of:

- The problem they want to solve
- Any potential ideas for solutions
- What pain they're experiencing today

### 2. Codebase Exploration

Explore the repo to verify their assertions and understand the current state. Read the relevant files, understand the architecture, identify the boundaries.

### 3. Present Alternatives

Ask whether they have considered other options. Present alternative approaches you've identified from the codebase exploration. Be honest about trade-offs.

### 4. Deep Interview

Interview the user about the implementation. Be extremely detailed and thorough:

- Which modules will be affected?
- What interfaces will change?
- What should the end state look like?
- What are the risks?

### 5. Scope Definition

Hammer out the exact scope:

- What you plan to change
- What you explicitly plan NOT to change
- Where the boundaries are

### 6. Test Coverage Assessment

Look in the codebase to check for test coverage of this area. If there is insufficient coverage:

- Ask the user what their plans for testing are
- Recommend writing tests BEFORE refactoring (safety net)
- Identify which behaviors need test protection

### 7. Commit Plan

Break the implementation into a plan of tiny commits. Follow Martin Fowler's advice: "Make each refactoring step as small as possible, so that you can always see the program working."

Each commit should leave the codebase in a working state — tests pass, app builds, no broken functionality.

### 8. Create GitHub Issue

Create a GitHub issue with the refactor plan using `gh issue create`. Use a HEREDOC for the body:

```bash
gh issue create --title "refactor: <short description>" --body "$(cat <<'EOF'
## Problem Statement

The problem that the developer is facing, from the developer's perspective.

## Solution

The solution to the problem, from the developer's perspective.

## Commits

A detailed implementation plan in plain English, breaking down the implementation into the smallest commits possible. Each commit should leave the codebase in a working state.

## Decision Document

A list of implementation decisions that were made:

- The modules that will be built/modified
- The interfaces that will be modified
- Technical clarifications
- Architectural decisions
- Schema changes
- API contracts
- Specific interactions

Do NOT include specific file paths or code snippets — they may end up outdated quickly.

## Testing Decisions

- What makes a good test (behavior, not implementation details)
- Which modules will be tested
- Prior art for tests (similar tests already in the codebase)

## Out of Scope

What is explicitly not part of this refactor.

## Further Notes

Any additional context.
EOF
)"
```

Return the issue URL to the user when done.
