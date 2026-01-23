---
allowed-tools: Read
description: Linear issue specification format
---

# /linear-specs

Standardized format for Linear issue descriptions.

---

## Mandatory Format

Every Linear issue description MUST follow this structure:

```markdown
## Objective

Clear, concise description of WHAT needs to be done.
- One sentence summary
- Business context if relevant
- Expected outcome

## Implementation

HOW to achieve the objective:
- Files to create/modify (with paths)
- Code patterns to follow
- Step-by-step technical approach
- Dependencies or prerequisites

## Best Practices

Guidelines and constraints to follow:
- Coding standards applicable
- Performance considerations
- Security requirements
- Patterns to use or avoid

## Verification

Success criteria and testing approach:
- [ ] Acceptance criteria (checkboxes)
- How to test the implementation
- Expected behavior after completion
- Edge cases to validate
```

---

## Section Details

### Objective
**Purpose:** Define the "what" and "why"

**Include:**
- Single clear goal statement
- User story format: "As a [user], I want [feature] so that [benefit]"
- Scope boundaries (what's NOT included)

**Avoid:**
- Implementation details
- Multiple unrelated goals (split into separate issues)

### Implementation
**Purpose:** Technical roadmap

**Include:**
- Exact file paths: `src/components/Button.tsx`
- Code snippets for complex patterns
- Database schema changes
- API endpoint definitions
- Migration steps if applicable

**Format:**
```markdown
### Files to Modify
- `src/services/auth.ts` - Add logout method
- `src/hooks/useAuth.ts` - Expose logout function

### Steps
1. Create the logout service method
2. Update the hook to expose it
3. Add loading state handling
```

### Best Practices
**Purpose:** Guardrails and quality standards

**Include:**
- Relevant coding standards from CLAUDE.md
- TypeScript requirements (no `any`, proper typing)
- Testing requirements
- Performance constraints
- Security considerations

### Verification
**Purpose:** Definition of done

**Include:**
- Checkboxes for acceptance criteria
- Manual testing steps
- Automated test requirements
- Commands to run for validation

---

## Good Example

```markdown
## Objective

Add a logout button to the application header that allows users to end their session securely.

## Implementation

### Files to Modify
- `src/components/Header.tsx` - Add LogoutButton component
- `src/services/auth.ts` - Add `logout()` method
- `src/hooks/useAuth.ts` - Expose logout function

### Steps
1. Add `logout` method to auth service that clears tokens
2. Update `useAuth` hook to expose the logout function
3. Create LogoutButton component with loading state
4. Add button to Header between user avatar and settings

### Code Pattern
\`\`\`typescript
const logout = async (): Promise<Result<void>> => {
  localStorage.removeItem('token')
  await api.post('/auth/logout')
  return [null, undefined]
}
\`\`\`

## Best Practices

- Use Result pattern (no throwing errors)
- Show loading spinner during logout
- Handle network errors gracefully
- Clear all auth-related storage (localStorage, cookies)

## Verification

- [ ] Logout button appears in header when logged in
- [ ] Button shows loading state during logout
- [ ] Session is cleared after logout
- [ ] User is redirected to `/login`
- [ ] Network errors show toast notification
- [ ] `pnpm test` passes
- [ ] `pnpm build` succeeds
```

---

## Bad Example (AVOID)

```markdown
Add logout functionality

We need to let users log out. Make sure it works properly.
```

---

## Quick Reference

| Section | Question Answered | Required |
|---------|-------------------|----------|
| Objective | What and why? | Yes |
| Implementation | How and where? | Yes |
| Best Practices | What standards? | Yes |
| Verification | How to confirm done? | Yes |

---

## Why This Format

1. **Objective** -> AI understands the goal, won't over-engineer
2. **Implementation** -> AI knows exactly which files to touch
3. **Best Practices** -> AI follows project conventions automatically
4. **Verification** -> AI can self-validate completion

**When creating specs for AI consumption:**
- Be explicit about file paths
- Include code patterns when non-obvious
- List all acceptance criteria as checkboxes
- Reference relevant CLAUDE.md guidelines
