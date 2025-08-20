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

### Tmux Workspace Management

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
- Tmux navigation integration

**Multiplexer:**
- Tmux configured as Zellij replacement
- Alt-based keybindings for pane management
- Vim-tmux-navigator for seamless editor integration
- Mouse support and 256-color terminal

## Architecture Notes

**Configuration Organization:**
- Each tool has its own package directory
- Configuration files mirror their target locations in home directory
- Shared functions and aliases loaded dynamically
- Environment variables and paths configured in `.zshrc`

**Git Workflow Integration:**
- Custom PR creation with AI assistance via `gprc` function
- Automated branch cleanup with `gf` function  
- Integration with GitHub CLI for PR management
- Claude CLI integration for generating PR content

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
- Claude CLI (for AI-powered PR generation)
- Neovim with Lua support
- Tmux