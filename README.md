# mac-config

macOS dotfiles managed with [GNU Stow](https://www.gnu.org/software/stow/) + a Makefile that orchestrates post-install hooks (MCP, etc.).

## Layout

Each top-level directory is a **Stow package** whose internal tree mirrors `$HOME`:

```
.stow_repository/
├── Makefile              # stow orchestrator + post-install hooks
├── cmux/.config/cmux/    # cmux config
├── colima/.config/colima # colima config (template _templates/)
├── docker/.docker/       # Docker CLI config
├── gh/.config/gh/        # GitHub CLI config.yml (hosts.yml = token, ignored)
├── ghostty/.config/ghostty
├── git/                  # .gitconfig + .config/git/ignore
├── homebrew/.config/homebrew # approved tap formulae (trust.json)
├── languages/.local/     # manually installed binaries (see languages/README.md)
├── nvim/.config/nvim/    # Neovim config
├── opencode/.config/opencode
├── pi/.pi/agent/          # settings.json of the pi CLI agent (auth + sessions ignored)
├── rclone/.config/rclone/ # rclone.conf (R2 remote via env_auth, no secrets)
├── rectangle/Library/    # Rectangle config (window manager)
├── obsidian/Brain/       # Obsidian "Brain" vault config (see below)
├── starship/.config/     # prompt
└── zsh/                  # .zshenv, .zshrc, .zprofile, .config/zsh
```

**`pi/` package**: `make pi` stows `~/.pi/agent/settings.json`, `make pi-post` installs the CLI (`pnpm add -g @earendil-works/pi-coding-agent`) if missing. Auth happens on first launch (`pi` then `/login`) and lives in `~/.pi/agent/auth.json`, never versioned. pi writes through the symlink when a setting changes via `/settings`: the diff shows up directly in the repo — review before committing.

**`obsidian/` package**: the vault stays in iCloud (`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Brain`); only its `.obsidian` config is stowed — custom target, hence `make obsidian` (relative symlinks, portable across machines). Unversioned binaries (AnuPpuccin theme, community plugins, fonts) are installed by `make obsidian-post`. If Obsidian replaces a symlink with a real file when saving its settings, `make obsidian-save` (`stow --adopt`) re-adopts the file into the repo — review the `git diff` then commit.

## Bootstrapping a new machine

On a pristine mac (nothing installed, not even Homebrew or git), **a single command**, no prior clone:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/walid-mos/mac-config/main/bootstrap.sh)"
```

`bootstrap.sh` installs the Xcode CLT (hence git), clones the repo into `~/.stow_repository`, then runs `make bootstrap`. Nothing else to type.

If the repo is already cloned:

```bash
cd ~/.stow_repository && make bootstrap
```

`make bootstrap` chains, from scratch and idempotently:

1. **Xcode Command Line Tools** — triggers the install pop-up and waits for it to finish (git, compiler).
2. **Homebrew** — official install script in non-interactive mode if missing.
3. **`brew bundle`** — installs the formulae and casks from the `Brewfile` (see below).
4. **`make install`** — stows every package + post-install hooks.

The target is replayable: each step detects what is already in place. Both brew prefixes (`/opt/homebrew/bin`, `/usr/local/bin`) are added to `PATH` by the Makefile, so `brew bundle` and the post-hooks find the freshly installed brew without restarting in a new shell.

### The `Brewfile`

Hand-curated list of a fresh mac's packages (34 → selection). **Do not regenerate via `brew bundle dump`**: the dump reinjects transitive dependencies and deliberately excluded personal apps. Adding/removing a package = edit the `Brewfile` directly, then `make brew-bundle`. Post-hooks cover the non-brew parts (pi via `pnpm`, impeccable plugin, rtk init, Obsidian assets).


## Makefile targets

| Target            | Effect                                                                |
|-------------------|-----------------------------------------------------------------------|
| `make bootstrap`  | Fresh mac from scratch: Xcode CLT + Homebrew + `brew bundle` + `install` |
| `make brew-bundle`| Installs the `Brewfile` packages (formulae + casks)                   |
| `make`, `make install` | Stows every package + runs all post-install hooks                |
| `make <package>`  | Stows a single package (`make nvim`, `make zsh`, …)                   |
| `make restow`     | Rebuilds the symlinks (useful after adding/removing files)            |
| `make unstow`     | Removes all symlinks                                                  |
| `make obsidian`   | Stows the `.obsidian` config into the Brain vault (custom iCloud target) |
| `make obsidian-save` | `stow --adopt`: re-adopts files Obsidian de-symlinked               |
| `make obsidian-post` | Installs AnuPpuccin theme, community plugins and fonts             |
| `make help`       | Shows help                                                            |

## Conventions

- **No runtime data committed.** Anything generated at runtime (caches, session data, temp files) is explicitly ignored in `.gitignore`.
- **Secrets.** `zsh/.config/zsh/secrets` is gitignored. Every API key lives in that file or in the macOS keychain.
- **Stow has no native hooks.** All post-install goes through the Makefile (`<package>-post`).

## Adding a new package

1. Create the directory at the repo root, mirroring the target tree from `$HOME`.
2. Add it to the `PACKAGES` variable in the `Makefile`.
3. If the tool writes other files into the target directory (token, lock, state), also add the package to `NOFOLD`: without `--no-folding`, Stow folds the whole directory into a symlink and the tool ends up writing its secrets into the repo.
4. If a post-install step is needed, add a `<package>-post` target and chain it into the `install` target.
5. `make <package>` then check the symlinks with `ls -la $HOME`.
