# mac-config-v3

Clean, modular ZSH configuration managed with GNU Stow.

## Features

- **Zinit Plugin Manager** - Fast, async plugin loading (replaces Oh-My-Zsh)
- **Modular conf.d/ Structure** - Easy to maintain and extend
- **Performance Optimized** - 60-80ms startup (70% faster than v2)
- **XDG Compliant** - Follows XDG Base Directory specification
- **Git Workflow Functions** - AI-powered PR/MR creation, branch management, worktrees
- **fnm Background Loading** - Node version manager loads asynchronously

## Installation

### Prerequisites

- macOS with Homebrew
- GNU Stow: `brew install stow`
- Git
- Zsh (default on macOS)

### Quick Install

```bash
# Clone repo to stow directory
git clone https://github.com/walid-mos/mac-config.git ~/.stow_repository
cd ~/.stow_repository

# Checkout v3 branch
git checkout v3

# Stow the zsh package
stow zsh

# Reload shell
exec zsh
```

### First-Time Setup

Zinit will auto-install on first shell launch. The following will be set up automatically:

- Zinit plugin manager
- zsh-syntax-highlighting
- zsh-autosuggestions
- Oh-My-Zsh git plugin (for aliases)

## Structure

```
zsh/                          # Stow package
├── .zshenv                   # XDG + essential env vars (all shells)
├── .zprofile                 # Homebrew, Cargo, Ruby (login shells)
├── .zshrc                    # Main config (interactive shells)
└── .config/zsh/
    ├── conf.d/               # Modular configuration
    │   ├── 01-zinit.zsh      # Plugin manager
    │   ├── 02-options.zsh    # History, completion, navigation
    │   ├── 03-completion.zsh # Completion system with cache
    │   ├── 04-prompt.zsh     # Starship prompt
    │   ├── 05-aliases.zsh    # Shell aliases
    │   ├── 06-node-manager.zsh # fnm (Fast Node Manager)
    │   └── 07-startup.zsh    # Fastfetch, editor, secrets
    ├── functions/            # Custom shell functions (autoloaded)
    │   ├── git-pr-create.zsh       # GitHub PR creation (gprc)
    │   ├── git-mr-create.zsh       # GitLab MR creation (gmrc)
    │   ├── git-fetch-prune.zsh     # Branch cleanup (gf)
    │   ├── git-sync-upstream.zsh   # Branch sync (gsync)
    │   ├── git-worktree-manager.zsh # Worktree manager (wt)
    │   ├── git-common.zsh          # Shared utilities
    │   └── nasreco                 # NAS volume reconnection
    └── cache/                # Completion cache, history
```

## Custom Functions

### Git Workflow

- `gprc` - Create GitHub PR with AI-generated title/description
- `gmrc` - Create GitLab MR with AI-generated title/description
- `gf` - Fetch and prune gone branches (with worktree detection)
- `gsync` - Sync branch with parent (interactive rebase)
- `wt` - Worktree manager (create, switch, list, delete, prune)

### System Management

#### nasreco - NAS Volume Reconnection

Reconnect NAS volumes manually using existing Keychain credentials.

**Usage:**
```bash
nasreco                    # Reconnect all shares
nasreco Storage Medias     # Reconnect specific shares only
nasreco --status           # Show current mount status
nasreco --force            # Force remount even if already mounted
nasreco --verbose          # Show detailed diagnostics
```

**Configuration:**

Uses environment variables (with fallback defaults):
- `NAS_SERVER` - NAS IP address (default: 192.168.1.2)
- `NAS_USERNAME` - Username (default: wmostefaoui)
- `NAS_MOUNT_BASE` - Mount base directory (default: /Volumes)

Password is retrieved from macOS Keychain (service: `nas-share-<server>`).

**Default Shares:**
- Storage
- photo
- Exchange
- Medias

**Prerequisites:**
- NAS credentials must be configured in Keychain
- Network connectivity to NAS server

### Requirements

- Claude CLI: `claude` command must be available
- GitHub CLI: `gh` (for gprc)
- GitLab CLI: `glab` (for gmrc)
- fzf: for interactive selection

## Aliases

```bash
# Editor & Shell
v        # nvim
szsh     # exec zsh (reload shell)
c        # tput reset (clear terminal)

# Navigation
cdev     # cd ~/Development
cdconfig # cd ~/.config/
cdstow   # cd ~/.stow_repository/

# Git (overrides Oh-My-Zsh)
gl       # git log --oneline --graph --decorate --all
gs       # git switch
gst      # git status
gpl      # git pull --all
ga       # git add
gc       # git commit
gr       # git rebase
gp       # git push

# Tools
upclaude # Update Claude Code CLI

# FNM
fnmi     # fnm install
fnmu     # fnm use
fnml     # fnm list
nv       # node --version
```

## Performance

**Before (v2 with Oh-My-Zsh):**
- Startup: ~200-300ms

**After (v3 with Zinit):**
- Startup: ~60-80ms (70% faster)

Optimizations:
- Zinit turbo mode (async plugin loading)
- Daily completion cache rebuild
- fnm background initialization
- Minimal core loading

## Updating

```bash
cd ~/.stow_repository
git pull origin v3
```

Changes apply immediately for new shells. Reload with `szsh`.

## Uninstalling

```bash
cd ~/.stow_repository
stow -D zsh
```

This removes all symlinks. Your home directory files are restored.

## Rollback to v2

```bash
cd ~/.stow_repository
git checkout main  # or your previous branch
stow -D zsh && stow zsh
exec zsh
```

## Customization

### Add Custom Config

Create a new file in `~/.config/zsh/conf.d/`:

```bash
# Example: ~/.config/zsh/conf.d/99-custom.zsh
export MY_VAR="value"
alias myalias="command"
```

Files load in alphanumeric order (01, 02, ..., 99).

### Add Custom Function

Create a file in `~/.config/zsh/functions/`:

```bash
# Example: ~/.config/zsh/functions/my-function.zsh
my-function() {
  echo "Hello from custom function"
}
```

Functions are autoloaded on shell startup.

### Add Secrets

Create `~/.config/zsh/secrets` (gitignored):

```bash
export GITHUB_TOKEN="ghp_xxxxx"
export OPENAI_API_KEY="sk-xxxxx"
```

## Troubleshooting

### Zinit not installing

Manually install:

```bash
ZINIT_HOME="${HOME}/.local/share/zinit/zinit.git"
mkdir -p "$(dirname $ZINIT_HOME)"
git clone https://github.com/zdharma-continuum/zinit.git "$ZINIT_HOME"
```

### Functions not loading

Check fpath:

```bash
echo $fpath | grep "zsh/functions"
```

Manually autoload:

```bash
autoload -Uz ~/.config/zsh/functions/*(:t)
```

### Slow startup

Profile shell:

```bash
time zsh -i -c exit
```

Check what's taking time:

```bash
zsh -xv 2>&1 | less
```

## License

MIT

## Author

Walid Mostefaoui (@walid-mos)
