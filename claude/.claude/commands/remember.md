# /remember

Save knowledge to your Claude configuration for future sessions.

## Instructions

When this command is invoked with arguments:

1. **Parse the input**: The text after `/remember` is what the user wants Claude to remember

2. **Determine the target file** based on the content:
   - If current project has `./CLAUDE.md` → suggest adding there for project-specific info
   - For global coding standards → `~/.stow_repository/claude/.claude/CLAUDE.md`
   - For language/framework guidelines → appropriate file in `~/.stow_repository/claude/.claude/guidelines/`
   - For workflow rules → `~/.stow_repository/claude/.claude/rules/`

3. **Read the target file** to understand its structure

4. **Propose the edit**:
   - Show which file will be modified
   - Show the exact content to be added
   - Explain why this location was chosen

5. **Ask for approval** before making any changes

6. **Execute the edit** if approved

## Available Config Files

### Main Config
- `~/.stow_repository/claude/.claude/CLAUDE.md` - Global instructions

### Guidelines (language/framework specific)
- `guidelines/typescript.md`
- `guidelines/react-antipatterns.md`
- `guidelines/tailwind.md`
- `guidelines/vitest.md`
- And more...

### Rules (workflow/process)
- `rules/workflow.md`
- `rules/branch-protection.md`
- `rules/security.md`

## Example

User: `/remember always run tests before committing in this project`

Claude:
1. Detects this is project-specific
2. Checks if `./CLAUDE.md` exists in current project
3. Proposes adding to project CLAUDE.md
4. Shows preview
5. Waits for approval
6. Edits file
