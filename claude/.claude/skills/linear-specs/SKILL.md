---
name: linear-specs
description: Linear issue specification format. Use when creating or reviewing Linear issues.
disable-model-invocation: true
allowed-tools: Read
---

# Linear Issue Format

Standardized format for Linear issue descriptions.

## Mandatory Structure

```markdown
## Objective

Clear description of WHAT needs to be done.
- One sentence summary
- Business context if relevant
- Expected outcome

## Implementation

HOW to achieve the objective:
- Files to create/modify (with paths)
- Code patterns to follow
- Step-by-step technical approach

## Best Practices

Guidelines and constraints:
- Coding standards applicable
- Performance considerations
- Security requirements

## Verification

Success criteria:
- [ ] Acceptance criteria (checkboxes)
- How to test
- Edge cases to validate
```

## Section Guidelines

### Objective
- Single clear goal statement
- User story: "As a [user], I want [feature] so that [benefit]"
- What's NOT included (scope boundaries)

### Implementation
- Exact file paths: `src/components/Button.tsx`
- Code snippets for complex patterns
- Migration steps if applicable

### Best Practices
- TypeScript requirements (no `any`)
- Testing requirements
- Security considerations

### Verification
- Checkboxes for acceptance criteria
- Manual testing steps
- Commands to validate

## Example

```markdown
## Objective

Add a logout button to the application header.

## Implementation

### Files to Modify
- `src/components/Header.tsx` - Add LogoutButton
- `src/services/auth.ts` - Add `logout()` method
- `src/hooks/useAuth.ts` - Expose logout function

### Steps
1. Add `logout` method to auth service
2. Update `useAuth` hook
3. Create LogoutButton with loading state

### Code Pattern
```typescript
const logout = async (): Promise<Result<void>> => {
  localStorage.removeItem('token')
  await api.post('/auth/logout')
  return [null, undefined]
}
```

## Best Practices

- Use Result pattern (no throwing)
- Show loading spinner
- Clear all auth storage

## Verification

- [ ] Button appears when logged in
- [ ] Shows loading state
- [ ] Redirects to `/login`
- [ ] `pnpm test` passes
```

## Why This Format

1. **Objective** -> AI understands goal, won't over-engineer
2. **Implementation** -> AI knows which files to touch
3. **Best Practices** -> AI follows conventions
4. **Verification** -> AI can self-validate
