# Project-Specific Instructions for mac-config-v3

## Project Overview

**Repository:** mac-config-v3
**Purpose:** Clean, modular ZSH configuration package managed with GNU Stow
**Architecture:** Stow package with modular conf.d/ structure + flat functions
**Tech Stack:** Zsh, Zinit, Starship, fnm, Git workflow automation

---

## Repository Structure

```
./
├── README.md           # User documentation
├── CLAUDE.md          # This file (project-specific instructions)
└── zsh/               # Stow package (gets symlinked to ~/)
    ├── .zshenv        # Environment variables (all shells)
    ├── .zprofile      # Login shell setup
    ├── .zshrc         # Interactive shell config
    └── .config/zsh/   # Modular configuration
        ├── conf.d/    # Configuration modules (01-07)
        ├── functions/ # Custom functions (flat structure)
        └── cache/     # Runtime cache directory
```

---

## Key Architectural Decisions

### 1. Stow Package Management

This repo IS a stow package. When user runs `stow zsh`, the entire `zsh/` directory structure is symlinked to `~/`.

**Example:**
- `zsh/.zshrc` → `~/.zshrc`
- `zsh/.config/zsh/conf.d/01-zinit.zsh` → `~/.config/zsh/conf.d/01-zinit.zsh`

### 2. Flat Function Structure

Functions are in a **flat directory** (no subdirectories) because zsh's `fpath` does not search recursively.

**Naming convention:** `git-<feature>.zsh` for organization.

**Why flat?**
- zsh autoload requires explicit fpath entries for each directory
- Flat structure = single fpath entry
- Naming prefix provides logical grouping

### 3. Background Loading (fnm)

Node version manager (fnm) loads in background to avoid blocking shell startup.

**Strategy:**
```zsh
export PATH="$FNM_DIR:$PATH"  # Immediate binary access
{ eval "$(fnm env --use-on-cd)" } &!  # Full init in background
```

**NOT using wrappers** because:
- Wrappers don't work in subshells (Claude bash commands)
- Scripts bypass wrapper functions
- Complexity without benefit

---

## Important Files & Locations

### Configuration Modules (load order matters)

1. `conf.d/01-zinit.zsh` - Plugin manager (must load first)
2. `conf.d/02-options.zsh` - Shell options
3. `conf.d/03-completion.zsh` - Completion system
4. `conf.d/04-prompt.zsh` - Starship prompt
5. `conf.d/05-aliases.zsh` - Shell aliases
6. `conf.d/06-node-manager.zsh` - fnm setup
7. `conf.d/07-startup.zsh` - Fastfetch, editor, secrets

### Custom Functions

All in `functions/` (flat):
- `git-pr-create.zsh` - GitHub PR (gprc)
- `git-mr-create.zsh` - GitLab MR (gmrc)
- `git-fetch-prune.zsh` - Branch cleanup (gf)
- `git-sync-upstream.zsh` - Branch sync (gsync)
- `git-worktree-manager.zsh` - Worktree manager (wt)
- `git-common.zsh` - Shared utilities

---

## Development Workflows

### Adding a New Configuration Module

1. Create file: `zsh/.config/zsh/conf.d/08-my-feature.zsh`
2. Files load in alphanumeric order
3. No need to modify `.zshrc` (auto-sourced)

### Adding a New Function

1. Create file: `zsh/.config/zsh/functions/my-function.zsh`
2. Define function: `my-function() { ... }`
3. No need to modify `.zshrc` (autoloaded via fpath)

### Testing Changes

**In this repo (before deployment):**
```bash
# This is a worktree, changes stay local until committed
git status
```

**Deploy to test:**
```bash
cd ~/.stow_repository
stow -D zsh  # Unstow old
cd /path/to/worktree
stow zsh     # Stow new version
exec zsh     # Test
```

**Rollback:**
```bash
cd ~/.stow_repository
stow zsh     # Back to stable
```

---

## Best Practices for Claude

### When Modifying This Repo

✅ **DO:**
- Work in THIS directory (`/Users/walid/Development/worktrees/mac-config-v3/`)
- Modify files under `zsh/` only
- Test changes are valid before committing
- Maintain flat function structure
- Keep conf.d/ numbering sequential

❌ **DON'T:**
- Touch `~/.stow_repository/` directly (user's active config)
- Create subdirectories in `functions/`
- Break zsh autoload patterns
- Add dependencies without documenting in README

### Common Tasks

**Add new alias:**
- Edit `zsh/.config/zsh/conf.d/05-aliases.zsh`

**Add new function:**
- Create `zsh/.config/zsh/functions/function-name.zsh`
- Use flat structure, no subdirs

**Modify plugin loading:**
- Edit `zsh/.config/zsh/conf.d/01-zinit.zsh`
- Use zinit turbo mode for async: `zinit ice wait lucid`

**Change PATH or env vars:**
- Global/essential → `zsh/.zshenv`
- Login-only → `zsh/.zprofile`
- Interactive → appropriate `conf.d/` file

---

## Performance Targets

**Startup time:** < 80ms (current: 60-80ms)

**How we achieve this:**
1. Zinit turbo mode (async plugins)
2. Daily completion cache
3. fnm background load
4. Minimal synchronous operations

**If adding features:**
- Profile impact: `time zsh -i -c exit`
- Use turbo mode for heavy plugins
- Defer non-critical initialization

---

## Dependencies

### Required (user must install)
- Zsh
- GNU Stow
- Git

### Auto-installed (by config)
- Zinit (auto-installs on first run)
- zsh-syntax-highlighting (via Zinit)
- zsh-autosuggestions (via Zinit)

### Optional (for full features)
- Starship prompt
- Fastfetch (system info)
- fnm (Node version manager)
- Claude CLI (for gprc/gmrc)
- GitHub CLI (gh)
- GitLab CLI (glab)
- fzf (interactive selection)

---

## Tech Stack Details

### Zinit

**Why not Oh-My-Zsh?**
- OMZ: 357 unused plugins, 80-120ms overhead
- Zinit: Load only what's needed, 50-80% faster

**Turbo mode:**
```zsh
zinit ice wait lucid  # Async load after prompt
zinit light plugin-name
```

### Starship

**Best choice in 2025:**
- Fast (Rust-based)
- Cross-shell compatible
- Well documented
- Active development

**Alternative:** Powerlevel10k (faster but EOL, ZSH-only)

### fnm

**Why not NVM?**
- fnm: ~5ms init (Rust)
- NVM: ~50-80ms init (bash script)

**With background load:** 0ms perceived delay

---

## Git Workflow (for this repo)

**Current setup:**
- Main repo: `~/.stow_repository/.git`
- This is worktree: `mac-config-v3` branch
- Branch: `v3`

**Committing changes:**
```bash
git add -A
git commit -m "feat(zsh): description"
git push origin v3
```

**Merging to main:**
```bash
git checkout main
git merge v3
git push origin main
```

---

## Troubleshooting

### Functions not autoloading

Check fpath includes functions directory:
```zsh
echo $fpath | grep functions
```

Manually test autoload:
```zsh
autoload -Uz function-name
```

### Zinit issues

Reinstall:
```bash
rm -rf ~/.local/share/zinit
# Reload shell (auto-reinstalls)
```

### Slow startup

Profile:
```bash
time zsh -i -c exit
zsh -xv 2>&1 | less  # Verbose trace
```

---

## Related Documentation

- Global CLAUDE.md: `~/.claude/CLAUDE.md` (universal rules, workflows)
- This file: Project-specific architecture and instructions
- README.md: User-facing documentation

**Hierarchy:**
1. Global CLAUDE.md (applies everywhere)
2. This CLAUDE.md (applies to this project)
3. Code comments (inline context)
