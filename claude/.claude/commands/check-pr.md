# /check-pr

Complete PR pipeline with all quality checks before creating pull request.

## Task

I'll execute the complete PR pipeline: lint, typecheck, test, security review, refactor, commit, and create PR with AI-generated content.

## Process

I'll follow these steps systematically:

1. **Validate Environment**: Ensure we're in a git repository and not on protected branch
2. **Lint Code**: Run `pnpm lint --fix` to ensure code style compliance
3. **Type Check**: Run `pnpm type-check` or equivalent for TypeScript validation
4. **Test Suite**: Execute `pnpm test` to verify all tests pass
5. **Security Review**: Launch `@agent-security-commit-guardian` for security analysis
6. **Code Refactoring**: Launch `@agent-code-refactor-specialist` for code quality review
7. **Commit Changes**: Create commit with descriptive message following conventions
8. **Create PR**: Use `gprc` function to create PR with AI-generated title and description

## Implementation Details

### Pre-flight Checks
- Verify git repository status
- Check current branch (refuse if on main/develop)
- Confirm we have changes to commit

### Quality Gates
- **Linting**: Auto-fix when possible, fail on unfixable issues
- **Type Checking**: Strict TypeScript validation, no `any` types allowed
- **Testing**: All tests must pass, no skipping
- **Security**: Comprehensive security review before commit
- **Refactoring**: Code quality analysis and optimization

### Commit Strategy
- Generate meaningful commit message based on changes
- Include change summary and file count
- Follow conventional commits format
- Add Claude Code signature

### PR Creation
- Use `gprc` for AI-powered PR generation
- Include comprehensive description
- Link related issues if detected
- Add appropriate labels and reviewers

## Expected Output

```
🚀 Starting complete PR check pipeline...

✅ Step 1/7: Environment validated
✅ Step 2/7: Linting passed (auto-fixed 3 issues)
✅ Step 3/7: Type checking passed
✅ Step 4/7: All tests passed (142/142)
✅ Step 5/7: Security review completed
✅ Step 6/7: Code refactoring analysis completed
✅ Step 7/7: PR created successfully

🎉 Complete PR pipeline finished!
🔗 PR: https://github.com/user/repo/pull/123
```

## Error Handling

- **Protected Branch**: Guide user to create feature branch
- **Lint Failures**: Show specific issues and suggest fixes
- **Test Failures**: Display failed tests and error details
- **Missing Dependencies**: Provide installation instructions
- **Git Issues**: Suggest git commands to resolve state

This command ensures your code meets all quality standards before creating a pull request.