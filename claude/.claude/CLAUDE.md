# Claude Code Configuration

## Core Development Workflow

**Essential Pipeline**: Develop → Lint → Typecheck → Test → Security Review → Refactor → Commit

After each development phase:
1. **Lint** (`pnpm lint` or package-specific lint command)
2. **Typecheck** (if TypeScript: `pnpm type-check` or package-specific)
3. **Test** (`pnpm test` or package-specific test command)
4. **Security Review** with `@agent-security-commit-guardian`
5. **Code Refactoring** with `@agent-code-refactor-specialist`
6. **Update Documentation** (README.md, CLAUDE.md if necessary)
7. **Commit** with descriptive message

## Essential Rules

### Package Management & Workflow
- **Package Manager**: PNPM only - never use npm or yarn
- **Branches**: Never work directly on main/develop branches
- **Pre-commit**: Never bypass with `--no-verify` - all checks must pass
- **YAML validation**: Always use `yamllint` for YAML files
- **Changeset management**: Create `.md` files manually in `.changeset/` directory

### Protected Branches Policy
- **main** and **develop** branches are ALWAYS protected
- If on protected branch, you MUST:
  1. Ask user which branch to base work on
  2. Create new feature branch from up-to-date base
  3. Switch to new branch before making changes

## Coding Standards

### TypeScript/JavaScript Rules
@claude/.claude/guidelines/typescript.md

### Naming Conventions (MANDATORY)
@claude/.claude/guidelines/naming-conventions.md

### Intelligent Refactoring Guidelines
@claude/.claude/guidelines/refactoring.md

**Quick Reference**:
- Apply DRY only when it provides real value
- See `@agent-code-refactor-specialist` for detailed analysis
- Focus on semantic similarity, not visual similarity

### Tailwind CSS Rules (MANDATORY when project uses Tailwind)
- **ALWAYS use Tailwind utility classes** whenever possible - this is the primary styling method
- **Custom CSS is FORBIDDEN** except when:
  - The styling is extremely complex and impossible to achieve with Tailwind
  - Tailwind does not provide the necessary features
- **Tailwind classes MUST be inline** - storing classes in constants is STRICTLY FORBIDDEN
- **ONLY exception**: `class-variance-authority` (cva) for component variants (e.g., shadcn/ui components)
  - cva is the ONLY library where Tailwind classes in constants are permitted
  - Used for managing different component variants (sizes, colors, states, etc.)

#### cn() Utility Function (MANDATORY when available)

When a project includes the `cn()` utility function (typically combining `clsx` + `tailwind-merge`), it becomes the **MANDATORY** way to apply className:

**Core Principles**:
- `cn()` combines conditional class logic (`clsx`) with Tailwind conflict resolution (`tailwind-merge`)
- Common pattern: `const cn = (...inputs) => twMerge(clsx(inputs))`
- **Keep it concise** - group related classes together, avoid excessive line separation

**Organization Domains** (3 logical groups only):
1. **Base/Global** - Structural classes, colors, typography, layout
2. **Responsive** - One line per breakpoint size (sm:, md:, lg:, xl:, 2xl:)
3. **Variants/States** - Modifiers grouped by type:
   - Dark modes WITH their base state: `bg-white dark:bg-gray-800`
   - Interactive states WITH dark variants: `hover:bg-blue-600 dark:hover:bg-blue-700`
   - Pseudo-elements grouped: `before:content-[''] before:absolute before:inset-0`
   - Group states combined: `group-hover:opacity-100 dark:group-hover:opacity-90`
4. **Conditional logic** - Ternaries and boolean conditions (ternaries, boolean conditions)

**Example - CORRECT with cn()**:
```tsx
// Concise organization - CORRECT
<div className={cn(
  // Base: structure, colors, typography (dark variants included)
  "flex items-center justify-between p-4 rounded-lg shadow-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white",
  // Responsive: one line per breakpoint
  "md:p-6 md:rounded-xl lg:p-8 lg:shadow-xl",
  // States: hover, focus, active (dark variants included)
  "hover:shadow-lg dark:hover:shadow-2xl focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400",
  // Conditional logic
  isActive && "bg-blue-500 dark:bg-blue-600 text-white",
  isDisabled && "opacity-50 cursor-not-allowed"
)}>

// Complex with pseudo-elements - CORRECT
<button className={cn(
  "relative px-4 py-2 rounded font-medium transition-colors bg-blue-500 dark:bg-blue-600 text-white",
  "before:content-[''] before:absolute before:inset-0 before:rounded before:opacity-0 before:transition-opacity",
  "hover:bg-blue-600 dark:hover:bg-blue-700 hover:before:opacity-10",
  "disabled:opacity-50 disabled:cursor-not-allowed"
)}>

// With group variants - CORRECT
<div className="group">
  <div className={cn(
    "transition-all opacity-0 group-hover:opacity-100 dark:group-hover:opacity-90",
    "transform translate-y-2 group-hover:translate-y-0"
  )}>
</div>
```

**Example - FORBIDDEN**:
```tsx
// Single long unorganized string - FORBIDDEN
<div className={cn("flex items-center justify-between p-4 md:p-6 lg:p-8 dark:bg-gray-800 dark:text-white hover:shadow-lg focus:ring-2 bg-white rounded-lg shadow-md")}>

// Over-segmentation with too many lines - FORBIDDEN
<div className={cn(
  "flex items-center",
  "justify-between",
  "p-4",
  "bg-white",
  "dark:bg-gray-800",  // Don't separate dark from base
  "text-white",
  "dark:text-gray-100", // Don't separate dark from base
  "hover:shadow-lg",
  "dark:hover:shadow-xl" // Don't separate dark:hover from hover
)}>

// Classes in constants outside cn() - FORBIDDEN
const baseClasses = "flex items-center"
<div className={cn(baseClasses, "p-4")}>

// Not using cn() when it's available - FORBIDDEN
<div className={`flex items-center ${isActive ? 'bg-blue-500' : 'bg-gray-200'}`}>
```

**Standard Examples**:
```tsx
// Inline classes without cn() - CORRECT (when cn() not available)
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md">

// cva for variants - CORRECT (ONLY exception)
const buttonVariants = cva(
  "inline-flex items-center justify-center rounded-md font-medium",
  {
    variants: {
      variant: {
        default: "bg-primary text-white hover:bg-primary/90",
        outline: "border border-input bg-background hover:bg-accent"
      }
    }
  }
)
```

## Testing Guidelines

@claude/.claude/guidelines/vitest.md

**Quick Reference**:
- Test behavior, not implementation
- Always clean up mocks between tests
- Mock I/O, keep business logic real

## Essential Notes

- **Fallback management**: Only implement when absolutely necessary
- **Comments**: Sparingly, English only, never in JSON files
- **Security**: Never expose or log secrets/keys

## Advanced Features & Configuration

### Custom Commands

**Available commands** (format: Markdown files in `.claude/commands/`):

#### 🚀 Development Workflow
- **`/check-pr`** - Complete PR pipeline: lint → typecheck → test → security review → refactor → commit → create PR with AI-generated content
- **`/quick-fix`** - Quick fix for small changes: auto-fix linting, smart commit, push to remote (skips tests for speed)
- **`/feature-start [name]`** - Start new feature: create properly named branch from updated base branch with environment setup
- **`/feature-complete`** - Complete feature development: full validation, optional commit squashing, production-ready PR creation

#### 🔍 Analysis & Testing
- **`/test-watch [pattern]`** - Launch Vitest in watch mode with coverage, smart filtering, and interactive controls
- **`/deps-check`** - Comprehensive dependency analysis: outdated packages, security audit, unused imports, bundle optimization
- **`/perf-check`** - Performance analysis: build time profiling, bundle size analysis, asset optimization, runtime performance

#### ⚙️ System Management
- **`/stow-sync`** - Synchronize dotfiles with GNU Stow: conflict detection, backup strategy, symlink verification

### Command Usage Patterns

#### Quick Development Cycle
```
/feature-start user-auth          # Start new feature
/quick-fix                        # Quick iterations
/test-watch auth                  # Continuous testing
/check-pr                         # Full validation & PR
```

#### Performance Optimization
```
/deps-check                       # Analyze dependencies
/perf-check                       # Performance audit
/quick-fix                        # Apply optimizations
```

#### System Maintenance
```
/stow-sync                        # Sync dotfiles
/deps-check                       # Check for updates
```

### Automatic Hooks

#### Active Hooks
- **PostToolUse**: `log-commands` - Logs bash commands to `~/.claude/command-history.log`
- **PreToolUse**: `validate-imports` - Enforces import standards (blocks `require()`, `any` type, etc.)
- **UserPromptSubmit**: `context-enhancer` - Adds git context and branch warnings

### Specialized Subagents

- **`@agent-security-commit-guardian`** - Security review before commits
- **`@agent-code-refactor-specialist`** - Code refactoring and DRY/KISS enforcement
- **`@agent-vitest-specialist`** - Vitest testing expert
- **`@agent-typescript-expert`** - TypeScript standards enforcement
- **`@agent-stow-manager`** - GNU Stow and dotfiles management
- **`@agent-docs-maintainer`** - Documentation consistency

### Permission Configuration

**Allowed Operations**:
- Standard development tools (git, pnpm, node, docker, cargo)
- Read-only operations (find, grep, ls, cat, etc.)
- GitHub CLI read operations (repo view, pr list, etc.)
- Context7 MCP server, WebSearch, WebFetch
- Ghostty terminal configuration validation

**Restricted Operations**:
- Force push operations (`git push --force`)
- Destructive GitHub operations (repo delete, pr merge)
- Authentication modifications
- Workflow management

### MCP Servers

- **Context7** - Library documentation and API reference
  - Auto-resolves library IDs
  - Fetches up-to-date documentation
  - Integrated with TypeScript expert agent

### Documentation Workflow

Proactive Context7 usage:
1. **Library Integration** - Always fetch docs before using unfamiliar libraries
2. **API Verification** - Verify syntax and parameters via Context7
3. **Best Practices** - Look up recommended patterns and deprecations
4. **Workflow**: `resolve-library-id` → `get-library-docs` → implement

### Command Logging

All bash commands logged to `~/.claude/command-history.log` with:
- Timestamp and git context
- Full command and description
- Automatic rotation (1000 entries)

### Quick Reference

**Essential Commands**:
- `pnpm lint` - Lint code
- `pnpm type-check` - TypeScript checking
- `pnpm test` - Run tests
- `yamllint file.yml` - YAML validation
- `ghostty +validate-config` - Validate Ghostty configuration

**Hook Locations**:
- Settings: `~/.claude/settings.json`
- Scripts: `~/.claude/hooks/`
- Status: `~/.claude/statusline-command.sh`

## Development Philosophy

### Core Principle: Simplest but Never Easiest
Always choose the simplest solution that maintains code quality and type safety. NEVER choose the easiest solution that compromises quality.

**Decision Framework**:
1. Does this solution maintain type safety? (If no, it's easiest, not simplest)
2. Does this solution solve the exact problem without over-engineering?
3. Is this solution maintainable and readable?
4. Will this solution scale appropriately with the codebase?

## Global Instructions

### Enhanced Workflow Integration
- Use custom commands for common development tasks
- Leverage automatic hooks for consistency and safety
- Utilize specialized subagents for expert assistance
- Monitor command history for debugging and optimization
- Proactively use Context7 for library documentation and best practices