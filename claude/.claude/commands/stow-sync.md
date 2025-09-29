# /stow-sync

Synchronize dotfiles with GNU Stow, checking conflicts and ensuring proper linking.

## Task

I'll manage your dotfiles using GNU Stow: detect conflicts, synchronize packages, verify symlinks, and ensure your dotfiles are properly organized and linked.

## Process

I'll execute this dotfiles management workflow:

1. **Environment Validation**: Check GNU Stow installation and repository structure
2. **Conflict Detection**: Identify existing files that would conflict with stowing
3. **Backup Strategy**: Create backups of conflicting files if needed
4. **Package Management**: Stow/unstow packages as requested
5. **Verification**: Verify all symlinks are properly created
6. **Status Report**: Provide comprehensive status of dotfiles management

## Implementation Details

### GNU Stow Validation
```bash
# Check if GNU Stow is installed
command -v stow >/dev/null 2>&1

# Verify we're in a stow repository
ls -la | grep -E '^d.*[a-zA-Z0-9_-]+/$'

# Check for common dotfiles packages
find . -maxdepth 1 -type d -name "*" | grep -v "^\.$"
```

### Conflict Detection Strategy
- **Existing Files**: Check if target files already exist
- **Broken Symlinks**: Identify and clean up broken links
- **Permission Issues**: Verify write permissions in target directories
- **Ownership Conflicts**: Check file ownership compatibility

### Package Management Operations
- **Install All**: `stow */` to install all packages
- **Install Specific**: `stow package-name` for individual packages
- **Uninstall**: `stow -D package-name` to remove packages
- **Restow**: `stow -R package-name` to refresh symlinks

## Expected Output

```
🔗 Starting GNU Stow synchronization...

🛠️  Environment Check:
  ✅ GNU Stow installed (v2.3.1)
  ✅ Stow repository detected: ~/.stow_repository
  ✅ Target directory: /Users/walid
  📦 Available packages: 5 (zsh, nvim, tmux, ghostty, claude)

🔍 Step 1/5: Conflict detection...
┌─────────────────────┬─────────────────────┬──────────────┐
│ Package             │ Conflicts           │ Action       │
├─────────────────────┼─────────────────────┼──────────────┤
│ zsh                 │ .zshrc (existing)   │ Backup       │
│ nvim                │ None                │ Safe         │
│ tmux                │ .tmux.conf (broken) │ Remove       │
│ ghostty             │ None                │ Safe         │
│ claude              │ None                │ Safe         │
└─────────────────────┴─────────────────────┴──────────────┘

🔄 Step 2/5: Resolving conflicts...
  📁 Backing up existing .zshrc → .zshrc.backup.2024-01-15
  🗑️  Removing broken symlink .tmux.conf
  ✅ Conflicts resolved

📦 Step 3/5: Stowing packages...
  ✅ zsh package stowed (8 files linked)
  ✅ nvim package stowed (23 files linked)
  ✅ tmux package stowed (2 files linked)
  ✅ ghostty package stowed (3 files linked)
  ✅ claude package stowed (12 files linked)

🔍 Step 4/5: Verification...
  ✅ All symlinks created successfully
  ✅ No broken links detected
  ✅ Target files point to correct sources

📊 Step 5/5: Status report...
Total files managed: 48
Successfully linked: 48
Conflicts resolved: 2
Packages active: 5
```

## Interactive Conflict Resolution

### Conflict Resolution Options
```
⚠️  Conflict detected: .zshrc already exists

Current file: /Users/walid/.zshrc (1.2KB)
Stow target: ~/.stow_repository/zsh/.zshrc (3.4KB)

Choose action:
  [1] 🔄 Backup existing and stow new (recommended)
  [2] 🚫 Skip this file
  [3] 📋 Show diff between files
  [4] 🔗 Force overwrite (destructive)
  [5] 📂 Open both files for manual merge

Selection [1]: 1

✅ Created backup: .zshrc.backup.2024-01-15
✅ Stowed new .zshrc successfully
```

### Package Selection
```
📦 Select packages to stow:

Available packages:
  [x] zsh - ZSH configuration with Oh My Zsh
  [x] nvim - Neovim configuration with Lua setup
  [x] tmux - Tmux configuration (Zellij replacement)
  [ ] ghostty - Ghostty terminal configuration
  [x] claude - Claude Code configuration

Space to toggle, Enter to confirm
```

## Detailed Operations

### Backup Management
```bash
# Create timestamped backups
backup_file() {
  local file="$1"
  local backup_name="${file}.backup.$(date +%Y-%m-%d-%H%M%S)"
  cp "$file" "$backup_name"
  echo "📁 Backup created: $backup_name"
}

# List existing backups
find ~ -name "*.backup.*" -type f | sort
```

### Symlink Verification
```bash
# Check all symlinks in home directory
find ~ -maxdepth 2 -type l -ls | grep -E "\.stow_repository"

# Verify symlink targets exist
find ~ -maxdepth 2 -type l -exec test ! -e {} \; -print

# Check for orphaned stow links
stow --target="$HOME" --verbose=2 --dry-run */
```

### Package Status Report
```
📊 Dotfiles Status Report
═══════════════════════════

Package Overview:
┌─────────────┬─────────┬───────────┬─────────────┬──────────────┐
│ Package     │ Status  │ Files     │ Last Stowed │ Conflicts    │
├─────────────┼─────────┼───────────┼─────────────┼──────────────┤
│ zsh         │ Active  │ 8         │ 2024-01-15  │ 0            │
│ nvim        │ Active  │ 23        │ 2024-01-15  │ 0            │
│ tmux        │ Active  │ 2         │ 2024-01-15  │ 0            │
│ ghostty     │ Inactive│ 3         │ Never       │ 0            │
│ claude      │ Active  │ 12        │ 2024-01-15  │ 0            │
└─────────────┴─────────┴───────────┴─────────────┴──────────────┘

Recent Changes:
• .zshrc: Updated with new aliases and functions
• nvim/init.lua: Added new plugin configurations
• .claude/CLAUDE.md: Optimized with modular structure

Recommendations:
• Consider stowing ghostty package for terminal consistency
• Backup .zshrc.backup.2024-01-15 can be removed (>30 days old)
• Review tmux configuration for Zellij migration
```

## Advanced Operations

### Dry Run Mode
```bash
# Preview changes without applying
/stow-sync --dry-run

# Shows what would happen:
DRY RUN: Would stow zsh package
DRY RUN: Would create symlink ~/.zshrc -> ~/.stow_repository/zsh/.zshrc
DRY RUN: Would backup existing ~/.zshrc
```

### Selective Package Management
```bash
# Stow specific packages only
/stow-sync --packages="zsh,nvim"

# Unstow packages
/stow-sync --unstow="tmux"

# Restow (refresh) packages
/stow-sync --restow="claude"
```

### Health Check Mode
```bash
# Verify dotfiles integrity
/stow-sync --health-check

Checking dotfiles health...
✅ All symlinks point to valid targets
✅ No broken links detected
✅ Stow repository structure is valid
⚠️  Found 2 backup files older than 30 days
ℹ️  ghostty package not stowed (available)
```

## Integration with Shell Functions

### ZSH Function Integration
```bash
# Add to .zshrc for quick access
alias stow-sync='cd ~/.stow_repository && /stow-sync && cd -'
alias stow-status='cd ~/.stow_repository && /stow-sync --status-only && cd -'
alias stow-backup='cd ~/.stow_repository && /stow-sync --backup-only && cd -'
```

### Git Integration
```bash
# Automatically sync after git operations
post-checkout() {
  if [[ -f .stow-config ]]; then
    echo "🔗 Dotfiles updated, running stow sync..."
    /stow-sync --auto
  fi
}
```

This command provides comprehensive dotfiles management with GNU Stow, ensuring your development environment is consistently configured across systems.