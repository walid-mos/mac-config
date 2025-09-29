# /feature-start

Start new feature development by creating a properly named branch from updated base.

## Task

I'll set up a new feature branch following best practices: ensure base branch is up-to-date, create descriptively named branch, and initialize development environment.

## Process

I'll execute these setup steps:

1. **Validate Current State**: Check git status and current branch
2. **Update Base Branch**: Fetch latest changes and update base branch
3. **Create Feature Branch**: Generate branch name following conventions
4. **Switch to Branch**: Checkout new feature branch
5. **Initialize Environment**: Set up development environment if needed
6. **Create Initial Plan**: Set up todo tracking for the feature

## Implementation Details

### Branch Naming Conventions
- **Feature Format**: `feature/brief-description`
- **Bugfix Format**: `fix/issue-description`
- **Hotfix Format**: `hotfix/critical-fix`
- **Chore Format**: `chore/maintenance-task`

### Base Branch Strategy
- **Default Base**: Use `develop` if available, otherwise `main`
- **Custom Base**: Allow user to specify different base branch
- **Update First**: Always fetch and merge latest changes
- **Safety Check**: Prevent starting from outdated base

### Environment Setup
- **Package Installation**: Run `pnpm install` if package.json changed
- **Database Migrations**: Run pending migrations if applicable
- **Environment Variables**: Verify required env vars are set
- **Development Servers**: Optionally start dev servers

## Expected Output

```
🚀 Starting new feature development...

📋 Feature Details:
  Name: user-authentication
  Base: develop
  Branch: feature/user-authentication

🔄 Step 1/5: Updating base branch...
✅ Fetched latest changes from origin
✅ Base branch 'develop' updated

🌿 Step 2/5: Creating feature branch...
✅ Created branch 'feature/user-authentication'
✅ Switched to new branch

🛠️  Step 3/5: Setting up environment...
✅ Dependencies up to date
✅ Environment validated

📝 Step 4/5: Initializing development plan...
✅ Todo list created for feature tracking

🎉 Feature branch ready for development!

Next steps:
  1. Implement feature following CLAUDE.md guidelines
  2. Use /quick-fix for small iterations
  3. Use /check-pr when ready for review
```

## Interactive Prompts

### Feature Name Input
```
🚀 Let's start a new feature!

What would you like to work on?
> User authentication system

📝 Suggested branch name: feature/user-authentication
Is this correct? [Y/n]:
```

### Base Branch Selection
```
🌿 Choose base branch:
  [1] develop (recommended)
  [2] main
  [3] custom branch

Selection [1]:
```

### Feature Type Classification
```
🏷️  What type of work is this?
  [1] 🆕 New feature
  [2] 🐛 Bug fix
  [3] 🚑 Hotfix
  [4] 🔧 Chore/maintenance

Selection [1]:
```

## Todo List Initialization

Create initial todo structure:
```markdown
# Feature: User Authentication

## Planning Phase
- [ ] Research authentication requirements
- [ ] Design API endpoints
- [ ] Plan database schema changes
- [ ] Create wireframes/mockups

## Implementation Phase
- [ ] Set up authentication routes
- [ ] Implement user registration
- [ ] Implement login/logout
- [ ] Add password hashing
- [ ] Create JWT token handling

## Testing Phase
- [ ] Write unit tests
- [ ] Write integration tests
- [ ] Test edge cases
- [ ] Perform security testing

## Review Phase
- [ ] Code review
- [ ] Security review
- [ ] Documentation update
- [ ] Deploy to staging
```

## Safety Features

- **Protected Branch Check**: Prevent starting from main/develop directly
- **Uncommitted Changes**: Warn about uncommitted changes
- **Branch Conflicts**: Handle existing branch names gracefully
- **Network Issues**: Graceful handling of fetch failures
- **Permission Checks**: Verify git push permissions

This command ensures a clean, organized start to feature development following best practices.