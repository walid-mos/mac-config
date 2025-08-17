# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Repository Overview

This is a personal dotfiles repository managed with GNU Stow. It contains configuration files for:
- **Claude** - Claude Code CLI configuration with permissions and settings
- **Neovim** - Modern Lua-based configuration with LSP support
- **Zsh** - Shell with Oh My Zsh and custom aliases/functions
- **Ghostty** - Terminal emulator
- **Zellij** - Terminal multiplexer

## Essential Commands

### Stow Management
```bash
# Install all configurations
cd ~/.stow_repository && stow */

# Install specific package
stow claude  # Install Claude Code config
stow nvim    # Install Neovim config
stow zsh     # Install Zsh config
stow ghostty # Install Ghostty config
stow zellij  # Install Zellij config

# Uninstall package
stow -D <package-name>
```

### Common Development Commands
```bash
# Reload shell configuration
szsh  # alias for source ~/.zshrc

# Navigation shortcuts
cdstow    # cd ~/.stow_repository/
cdconfig  # cd ~/.config/
cdev      # cd ~/Documents/Development

# Editor
v         # alias for nvim
```

## Architecture

The repository follows GNU Stow conventions:
- Each top-level directory is a "package" that can be independently managed
- Directory structure mirrors the target installation in the home directory
- Stow creates symlinks from `~/.stow_repository/package/path` to `~/path`

### Key Components

1. **Claude Configuration** (`claude/.claude/`)
   - `settings.json` - Main configuration with permissions and model settings
   - `settings.local.json` - Local overrides for additional permissions
   - Managed via symlinks to enable version control of Claude CLI settings

2. **Neovim Configuration** (`nvim/.config/nvim/`)
   - Uses lazy.nvim plugin manager
   - Modular Lua configuration under `lua/core/` and `lua/plugins/`
   - LSP servers: lua_ls, ts_ls, eslint, pyright, rust_analyzer, html, cssls, bashls, jsonls
   - Leader key: `<space>`
   - Claude Code integration: `<leader>cf` (send file), `<leader>cs` (send selection)

3. **Zsh Configuration** (`zsh/`)
   - Main config: `.zshrc`
   - Custom aliases: `.config/zsh/aliases`
   - Custom functions: `.config/zsh/functions/`
   - Git aliases override Oh My Zsh defaults

4. **Terminal Configurations**
   - Ghostty: Configured with custom keys, fonts, theme files
   - Zellij: KDL-based configuration with layouts

## Development Workflow

When modifying configurations:
1. Make changes in the appropriate package directory
2. Test changes locally
3. Commit with descriptive messages following existing patterns
4. No build/test/lint commands needed - configurations are applied immediately via symlinks

## Recent Focus Areas

Based on commit history:
- gRPC configuration improvements
- Neovim plugin fixes and enhancements
- Ghostty keyboard shortcuts
- Zellij layout and tab management
- Claude CLI integration for git operations