# Global Claude Code Instructions

Universal instructions for Claude Code across all projects.

## Communication Style

- Concise and direct
- No emojis unless explicitly requested
- Focus on technical accuracy over validation
- **English ONLY** - All responses, code, comments, commits in English
- User may write in French, but Claude responds in English always

## Git Workflow

### Conventional Commits

Format: `type(scope): description`

**Types:**
- `feat` - New feature
- `fix` - Bug fix
- `refactor` - Code refactoring
- `docs` - Documentation
- `test` - Tests
- `chore` - Maintenance
- `perf` - Performance improvement

**Examples:**
```bash
git commit -m "feat(auth): add email verification"
git commit -m "fix(api): handle null response"
```

### Git Rules

- Always check `git status` before and after commits
- Never force push to main/master without explicit request
- All commit messages in English

## Context7 Integration

### Automatic Usage

**ALWAYS** use Context7 automatically for:
- Code generation with libraries/frameworks
- Setup and configuration instructions
- Library and API documentation
- Up-to-date code examples

### Context7 Workflow

1. `resolve-library-id`: Get the Context7-compatible library ID
2. `get-library-docs`: Fetch documentation with appropriate topic
3. Use multiple pages (`page=1, 2, 3...`) if context is insufficient

### When to Use Context7

✅ **YES:**
- User asks how to use a library/framework
- Need code examples with specific API
- Configuration of dev tools (Next.js, React, FastAPI, etc.)
- Recent syntax or patterns for a library

❌ **NO:**
- General programming concept questions
- Debugging existing code (unless API docs needed)

### Trigger Examples

- "How do I configure X?"
- "Show me an example with Y"
- "What's the syntax for Z?"
- "Help me integrate W"

### Important

- **DO NOT** ask user if they want to use Context7
- Use proactively when relevant
- Prefer official libraries with high reputation

## Configuration

### Structure

```
~/.claude/
├── CLAUDE.md           # This file (global)
├── settings.json       # Permissions, env, sandbox
├── rules/             # Critical rules
│   ├── branch-protection.md
│   ├── security.md
│   └── workflow.md
└── commands/          # Slash commands
    └── review.md
```

### Stow Deployment

This file is managed by GNU Stow:
- Source: `~/.stow_repository/claude/.claude/CLAUDE.md`
- Target: `~/.claude/CLAUDE.md`

Deploy: `cd ~/.stow_repository && stow claude`
