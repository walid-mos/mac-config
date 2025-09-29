# /feature-complete

Complete feature development with full validation, commit squashing, and PR creation.

## Task

I'll finalize feature development with comprehensive checks: run full validation pipeline, optionally squash commits for clean history, and create production-ready pull request.

## Process

I'll execute these completion steps:

1. **Feature Validation**: Run complete test suite and quality checks
2. **Commit History Review**: Analyze commit history and suggest cleanup
3. **Optional Squashing**: Offer to squash commits for cleaner history
4. **Final Security Review**: Comprehensive security analysis
5. **Documentation Update**: Ensure documentation reflects changes
6. **PR Creation**: Create detailed pull request with full context

## Implementation Details

### Validation Pipeline
- **Full Lint Check**: `pnpm lint` with strict mode
- **Complete Type Check**: TypeScript validation with zero tolerance
- **Comprehensive Testing**: Unit, integration, and E2E tests
- **Performance Analysis**: Check for performance regressions
- **Security Scan**: Deep security analysis with specialized agents

### Commit History Analysis
```bash
# Analyze commit patterns
git log --oneline feature-branch...develop

# Check for merge conflicts
git merge-tree $(git merge-base feature-branch develop) feature-branch develop

# Review commit quality
git log --format="%h %s" --grep="fix typo\|oops\|wip"
```

### Squash Strategy
- **Multiple Small Commits**: Suggest squashing if >5 commits
- **WIP/Fix Commits**: Always recommend cleaning up
- **Logical Grouping**: Preserve meaningful commit boundaries
- **Interactive Rebase**: Guide user through interactive rebase

### Documentation Requirements
- **README Updates**: Add new features to feature list
- **API Documentation**: Document new endpoints or changes
- **Configuration Changes**: Document new environment variables
- **Migration Notes**: Include breaking change information

## Expected Output

```
🏁 Completing feature development...

📊 Feature Analysis:
  Branch: feature/user-authentication
  Commits: 12 commits
  Files changed: 23 files
  Lines added: 1,247
  Lines removed: 89

✅ Step 1/6: Full validation pipeline...
  ✅ Linting passed
  ✅ Type checking passed
  ✅ All tests passed (167/167)
  ✅ Performance checks passed

📝 Step 2/6: Commit history analysis...
  ⚠️  Found 4 WIP commits that could be squashed
  ⚠️  Found 2 "fix typo" commits
  💡 Recommendation: Interactive rebase to clean history

🧹 Step 3/6: Commit cleanup (optional)...
Would you like to clean up commit history? [y/N]: y
✅ Interactive rebase completed
✅ History cleaned: 12 → 6 meaningful commits

🔒 Step 4/6: Final security review...
✅ Security analysis completed
✅ No vulnerabilities detected

📚 Step 5/6: Documentation update...
✅ README.md updated with new features
✅ API documentation generated

🚀 Step 6/6: Creating production-ready PR...
✅ PR created with comprehensive description
✅ Reviewers assigned based on CODEOWNERS

🎉 Feature completion pipeline finished!
🔗 PR: https://github.com/user/repo/pull/124
```

## Interactive Squash Guide

```
📝 Commit History Review:

Current commits:
  a1b2c3d feat: add user registration endpoint
  e4f5g6h wip: working on validation
  i7j8k9l fix: typo in error message
  m1n2o3p feat: implement JWT token handling
  q4r5s6t fix: handle edge case
  u7v8w9x wip: debugging tests
  y1z2a3b feat: add password hashing
  c4d5e6f fix: lint issues
  g7h8i9j feat: implement logout endpoint
  k1l2m3n docs: update API documentation
  o4p5q6r test: add comprehensive test suite
  s7t8u9v fix: final cleanup

💡 Suggested squash plan:
  ✅ Keep: feat: add user registration endpoint
  🔄 Squash: wip + fix typo → into registration
  ✅ Keep: feat: implement JWT token handling
  🔄 Squash: fix edge case → into JWT
  🔄 Squash: wip debugging → into next feature
  ✅ Keep: feat: add password hashing
  🔄 Squash: fix lint → into hashing
  ✅ Keep: feat: implement logout endpoint
  ✅ Keep: docs: update API documentation
  ✅ Keep: test: add comprehensive test suite
  🔄 Squash: fix cleanup → into tests

Result: 12 commits → 6 clean commits

Proceed with interactive rebase? [y/N]:
```

## PR Template Generation

```markdown
## 🚀 Feature: User Authentication System

### 📋 Summary
Implements comprehensive user authentication system with registration, login, logout, and JWT token management.

### ✨ Features Added
- User registration with email validation
- Secure password hashing using bcrypt
- JWT token generation and validation
- Login/logout endpoints
- Protected route middleware
- Password reset functionality

### 🔧 Technical Details
- **Database**: Added users table with proper indexing
- **Security**: Implemented rate limiting and input validation
- **Testing**: 95% code coverage with unit and integration tests
- **Documentation**: Updated API docs with new endpoints

### 🧪 Testing
- [x] Unit tests for all authentication functions
- [x] Integration tests for API endpoints
- [x] Security testing for common vulnerabilities
- [x] Performance testing for token validation

### 📚 Documentation
- [x] API documentation updated
- [x] README.md includes new authentication section
- [x] Environment variables documented

### ⚠️ Breaking Changes
None - this is a new feature addition.

### 🔗 Related Issues
Closes #123, Closes #456

🤖 Generated with [Claude Code](https://claude.com/claude-code)

Co-Authored-By: Claude <noreply@anthropic.com>
```

This command ensures your feature is production-ready with clean history and comprehensive documentation.