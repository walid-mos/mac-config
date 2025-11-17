# Global Claude Code Instructions

This file contains universal instructions and preferences for Claude Code across all projects.

## General Preferences

### Communication Style
- Be concise and direct
- No unnecessary emojis unless explicitly requested
- Focus on technical accuracy over validation
- French is preferred for conversational responses

### Code Style
- Follow existing project conventions
- Prioritize readability and maintainability
- Add comments only when logic is non-obvious
- Use modern best practices (ES6+, async/await, etc.)

### Git Workflow
- Commit messages in English, following Conventional Commits
- Format: `type(scope): description`
- Types: feat, fix, refactor, docs, test, chore, perf
- Always check git status before and after commits
- Never force push to main/master without explicit request

### Performance Awareness
- Profile before optimizing
- Avoid premature optimization
- Document performance-critical sections
- Use appropriate data structures

### Security
- Never commit secrets, API keys, or credentials
- Validate and sanitize user inputs
- Follow OWASP top 10 best practices
- Use environment variables for sensitive config

## Project Management

### Stow Repository Structure
- This machine uses GNU Stow for dotfile management
- Repository location: `~/.stow_repository/`
- Each package is a subdirectory that mirrors home directory structure
- Deploy with: `stow <package>`
- Undeploy with: `stow -D <package>`

### Active Packages
- `zsh/` - Modular ZSH configuration
- `claude/` - This Claude Code configuration

## Tool Preferences

### Shell & Terminal
- Shell: Zsh (with Zinit plugin manager)
- Prompt: Starship
- Completion: zsh-completions + custom conf.d modules
- Syntax highlighting: zsh-syntax-highlighting
- Autosuggestions: zsh-autosuggestions

### Development Tools
- Node: fnm (fast node manager)
- Ruby: rbenv
- Git: GitHub CLI (gh) + GitLab CLI (glab)
- Editor: Visual Studio Code
- Package manager: Homebrew (macOS)

### Preferred Languages & Frameworks
- JavaScript/TypeScript (Node.js, React, Next.js)
- Python (FastAPI, pandas)
- Shell scripting (Bash, Zsh)
- Ruby (Rails, gems)

## System Information

### Environment
- OS: macOS (Darwin)
- Architecture: Apple Silicon (M-series)
- Package Manager: Homebrew
- Shell: Zsh

### Key Directories
- Stow repository: `~/.stow_repository/`
- Development: `~/Development/`
- Worktrees: `~/Development/worktrees/`
- Projects: `~/Development/projects/`

## Claude Code Specific

### Session Management
- All session data stored in `~/.claude/`
- Runtime data (projects/, todos/, history.jsonl) is gitignored
- Only this CLAUDE.md file is version controlled
- User config (`~/.claude.json`) stays outside Stow

### MCP Servers
- Configured per-project in `~/.claude.json`
- Check existing MCP servers before suggesting new ones
- Prefer official or well-maintained MCP servers

### Context7 Integration

**Automatic usage for documentation:**
- **ALWAYS** use Context7 automatically for:
  - Code generation with libraries/frameworks
  - Setup and configuration instructions
  - Library and API documentation
  - Up-to-date code examples

**Context7 workflow:**
1. `resolve-library-id`: Get the Context7-compatible library ID
2. `get-library-docs`: Fetch documentation with appropriate topic
3. Use multiple pages (`page=1, 2, 3...`) if context is insufficient

**When to use Context7:**
- ✅ User asks how to use a library/framework
- ✅ Need code examples with specific API
- ✅ Configuration of dev tools (Next.js, React, FastAPI, etc.)
- ✅ Recent syntax or patterns for a library
- ❌ General programming concept questions
- ❌ Debugging existing code (unless API docs needed)

**Trigger examples:**
- "How do I configure X?"
- "Show me an example with Y"
- "What's the syntax for Z?"
- "Help me integrate W"

**Important:**
- Do NOT ask user if they want to use Context7
- Use it proactively when relevant
- Prefer official libraries with high reputation

### Workflow Automation
- Use custom git functions from zsh config when applicable
- Leverage aliases for common operations
- Prefer interactive selection (fzf) when available

## Notes

This file is managed by GNU Stow and symlinked from:
- Source: `~/.stow_repository/claude/.claude/CLAUDE.md`
- Target: `~/.claude/CLAUDE.md`

For project-specific instructions, see the CLAUDE.md in each project directory.
