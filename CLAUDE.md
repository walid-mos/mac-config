# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a personal dotfiles repository managed with GNU Stow. It contains configuration files for various development tools and applications organized into separate "packages" that can be independently managed and symlinked to the home directory.

## Package Structure

- **zsh/**: ZSH shell configuration with Oh My Zsh, custom aliases, and shell functions
- **nvim/**: Neovim configuration with Lua-based setup and plugin management
- **tmux/**: Tmux configuration optimized as a Zellij replacement
- **ghostty/**: Ghostty terminal configuration
- **zellij/**: Zellij multiplexer configuration

## Key Commands and Usage

### GNU Stow Operations
```bash
# Install all packages
stow */

# Install specific package
stow <package-name>  # e.g., stow zsh

# Uninstall package
stow -D <package-name>

# Uninstall all packages
stow -D */
```

### Shell Functions and Aliases

Key custom functions available in `zsh/.config/zsh/functions/`:

- **`gprc`**: Advanced Git PR creation with AI-generated titles and descriptions using Claude CLI
  - `gprc` - Create new PR with interactive branch selection
  - `gprc -u` - Update existing PR description only
  - Uses fzf for interactive branch selection
  - Integrates with GitHub CLI and Claude CLI for enhanced automation

- **`gmrc`**: GitLab MR creation with AI-generated titles and descriptions using Claude CLI
  - `gmrc` - Create new MR with interactive branch selection
  - `gmrc -u` - Update existing MR description only
  - `gmrc --draft` - Create as draft MR (Work In Progress)
  - Uses fzf for interactive branch selection
  - Integrates with GitLab CLI and Claude CLI
  - Auto-removes source branch on merge

- **`gf`**: Enhanced git fetch with branch cleanup
  - `gf` - Fetch and prune, then delete gone branches with confirmation
  - `gf -i` - Interactive mode for individual branch confirmation
  - Handles git worktrees automatically

### Important Aliases (zsh/.config/zsh/aliases)
```bash
v="nvim"                    # Quick nvim access
szsh="source ~/.zshrc"      # Reload shell config
cdev="cd ~/Development"     # Navigate to development folder
cdstow="cd ~/.stow_repository"  # Navigate to this dotfiles repo

# Git aliases (override oh-my-zsh defaults)
gl="git log --oneline --graph --decorate --all"
gs="git switch"
gst="git status" 
gpl="git pull --all"
```

### Ghostty Native Splits (Replacing Tmux)

**Split Management:**
```bash
# Create splits
Alt+n          # Split right (vertical split)  
Alt+v          # Split down (horizontal split)

# Navigate splits (seamless with Neovim via smart-splits.nvim)
Alt+h          # Move to left split
Alt+j          # Move to down split  
Alt+k          # Move to up split
Alt+l          # Move to right split

# Resize splits
Alt+Shift+h    # Resize left
Alt+Shift+j    # Resize down
Alt+Shift+k    # Resize up
Alt+Shift+l    # Resize right

# Close split
Alt+x          # Close current split

# Inspector/Debug
Alt+q          # Toggle split inspector
```

**Tab Management:**
```bash
Alt+[          # Previous tab
Alt+]          # Next tab
```

### Legacy Tmux Workspace Management (Optional)

The `tmux/.config/tmux/setup-workspace.sh` script provides workspace automation:
```bash
# Setup development workspace
~/.config/tmux/setup-workspace.sh setup

# Clean all tmux sessions  
~/.config/tmux/setup-workspace.sh clean

# List active sessions
~/.config/tmux/setup-workspace.sh list
```

Pre-configured project sessions:
- `nextnode-front` - Frontend development
- `nextnode` - Main project  
- `configs` - Dotfiles management

### Development Environment Details

**Shell Environment:**
- Uses Oh My Zsh with minimal plugins
- Starship prompt for enhanced display
- PNPM as primary package manager
- Fastfetch runs on shell startup
- Modular function loading from `zsh/.config/zsh/functions/`

**Editor Setup:**
- Neovim with Lua configuration
- Modular plugin structure in `nvim/.config/nvim/lua/`
- LSP, autocompletion, and telescope integration
- Smart-splits.nvim for seamless Ghostty navigation integration
- Mouse support enabled for better terminal integration

**Terminal Multiplexer:**
- Ghostty native splits and tabs (primary)
- Alt-based keybindings for pane management
- Smart-splits.nvim for seamless Neovim ↔ Ghostty navigation
- Native macOS UI components for better performance
- Legacy tmux support available as fallback

## Architecture Notes

**Configuration Organization:**
- Each tool has its own package directory
- Configuration files mirror their target locations in home directory
- Shared functions and aliases loaded dynamically
- Environment variables and paths configured in `.zshrc`

**Git Workflow Integration:**
- Custom PR/MR creation with AI assistance via `gprc` (GitHub) and `gmrc` (GitLab) functions
- Automated branch cleanup with `gf` function
- Integration with GitHub CLI and GitLab CLI for PR/MR management
- Claude CLI integration for generating PR/MR content
- Shared utilities module (`git-pr-common.sh`) for DRY code architecture

**Development Workflow:**
- Uses PNPM exclusively (never npm/yarn)
- Tmux workspace scripts for quick project setup
- Shell functions for common git operations
- Modular configuration for easy maintenance

## Important File Locations

- Shell config: `zsh/.zshrc` and `zsh/.config/zsh/`
- Neovim config: `nvim/.config/nvim/init.lua`
- Tmux config: `tmux/.config/tmux/tmux.conf`
- Shell functions: `zsh/.config/zsh/functions/*.sh`
- Aliases: `zsh/.config/zsh/aliases`

## External Dependencies

- GNU Stow (for package management)
- Oh My Zsh (shell framework)
- Starship (shell prompt)
- fzf (fuzzy finder for interactive selections)
- GitHub CLI (`gh` command)
- GitLab CLI (`glab` command)
- Claude CLI (for AI-powered PR/MR generation)
- Neovim with Lua support
- Tmux