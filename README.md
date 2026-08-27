# mac-config

macOS dotfiles managed with [GNU Stow](https://www.gnu.org/software/stow/) + a Makefile that orchestrates post-install hooks (MCP, etc.).

## Layout

**Every top-level directory is a Stow package** whose internal tree mirrors `$HOME` — the package list is derived from the filesystem by the Makefile (`make help` shows it). Exceptions listed in `NONSTOW`: `obsidian/` (custom iCloud target, own Make target), `scripts/` (internal git tooling), and `claude/` (kept in-tree, not deployed).

Two invariants carry all the knowledge:

- **`NOFOLD`** (Makefile) — packages whose target directory also receives files *written by the tool* (`gh/hosts.yml` token, `pi/auth.json` + sessions, `colima/_lima`, `docker/buildx`, `rtk/history.db`, `~/.local/bin` shared with pnpm/fnm, …). Stow is run with `--no-folding` for them: the target stays a **real directory** (never a single symlink to the package). **Only files already present in the package are symlinked.** Files created later in the live directory stay local and never appear in the working tree until they are copied into the package and restowed. This replaces per-tool `.gitignore` blocks — prevention instead of exclusion.
- **`.gitignore`** — reduced to genuine secrets (`zsh/.config/zsh/secrets`) and generic noise; runtime paths need no rule because NOFOLD keeps them out of the repo entirely.

**`pi/` package**: `make pi` stows `~/.pi/agent/settings.json`, `make pi-post` installs the CLI (`pnpm add -g @earendil-works/pi-coding-agent`) if missing. Auth happens on first launch (`pi` then `/login`) and lives in `~/.pi/agent/auth.json`, never versioned. pi writes through the symlink when a setting changes via `/settings`: the diff shows up directly in the repo — review before committing.

**`obsidian/` package**: the vault stays in iCloud (`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Brain`); only its `.obsidian` config is stowed — custom target, hence `make obsidian` (relative symlinks, portable across machines). Unversioned binaries (AnuPpuccin theme, community plugins) live as real files in the vault: iCloud syncs them across machines and Obsidian natively re-installs missing plugins on first launch; system fonts come from the Brewfile. If Obsidian replaces a symlink with a real file when saving its settings, `make obsidian-save` (`stow --adopt`) re-adopts the file into the repo — review the `git diff` then commit.

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

Hand-curated list of a fresh mac's packages (34 → selection). **Do not regenerate via `brew bundle dump`**: the dump reinjects transitive dependencies and deliberately excluded personal apps. Adding/removing a package = edit the `Brewfile` directly, then `make brew-bundle`. Post-hooks cover the non-brew parts (pi via `pnpm`, rtk init, Obsidian assets).


## Makefile targets

| Target            | Effect                                                                |
|-------------------|-----------------------------------------------------------------------|
| `make bootstrap`  | Fresh mac from scratch: Xcode CLT + Homebrew + `brew bundle` + `install` |
| `make brew-bundle`| Installs the `Brewfile` packages (formulae + casks)                   |
| `make`, `make install` | Stows every package + runs all post-install hooks                |
| `make <package>`  | (Re)stows a single package (`make nvim`, `make zsh`, …) — idempotent `-R` |
| `make restow`     | Rebuilds the symlinks (useful after adding/removing files)            |
| `make unstow`     | Removes all symlinks                                                  |
| `make obsidian`   | Stows the `.obsidian` config into the Brain vault (custom iCloud target) |
| `make obsidian-save` | `stow --adopt`: re-adopts files Obsidian de-symlinked               |
| `make help`       | Shows help                                                            |

## Conventions

- **No runtime data in the repo.** Packages whose target dir receives tool-written files are in `NOFOLD` — the directory stays real, so new local files never fold into the working tree (see Layout).
- **Secrets.** `zsh/.config/zsh/secrets` is gitignored. Every API key lives in that file or in the macOS keychain.
- **Stow has no native hooks.** All post-install goes through the Makefile (`<package>-post`, listed in `POSTS`).

## Adding a new package

1. Create the directory at the repo root, mirroring the target tree from `$HOME` — it is picked up automatically (`PACKAGES` is derived from the filesystem).
2. If the tool writes other files into the target directory (token, lock, state), add the package to `NOFOLD`: without `--no-folding`, Stow folds the whole directory into a symlink and the tool writes into the repo. With `--no-folding`, only files already present in the package are linked; add any new config to the package explicitly, then restow.
3. If a post-install step is needed, add a `<package>-post` target and its name to `POSTS`.
4. `make <package>` then check the symlinks with `ls -la $HOME`.
