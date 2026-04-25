# languages

Stow package for language toolchains that aren't installed via a package manager,
or that need to be kept in sync with a specific compiler version.

Currently covers: **Odin** (compiler + `ols` language server + `odinfmt` formatter).

## What this package ships

`languages/.local/bin/` contains thin shims that go to `~/.local/bin/`:

- `odin-update` — bootstrap + update script. Idempotent: installs Odin if missing,
  clones `ols` if missing, then rebuilds `ols` + `odinfmt` against the matching
  Odin version tag (`dev-YYYY-MM`).
- `ols` → execs `~/.config/languages/ols/ols`
- `odinfmt` → execs `~/.config/languages/ols/odinfmt`

The `~/.config/languages/ols/` directory is the upstream
[DanielGavin/ols](https://github.com/DanielGavin/ols) source tree. It is **not**
tracked here (see top-level `.gitignore`) — it's a build artefact that lives on
each machine.

## Bootstrap on a fresh machine

Prerequisites: `brew`, `git`, `stow`, and `~/.local/bin` already on `PATH`.

```sh
cd ~/.stow_repository
stow languages
odin-update
```

That's it. `odin-update` will:

1. `brew install odin` (or upgrade if already present)
2. detect the Odin version tag (e.g. `dev-2026-04`)
3. `git clone https://github.com/DanielGavin/ols ~/.config/languages/ols` if missing
4. `git checkout <tag>` matching the Odin version
5. build `ols` via the upstream `./build.sh`
6. build `odinfmt` via `odin build tools/odinfmt/main.odin ...`

After it finishes, verify:

```sh
odin version       # /opt/homebrew/bin/odin version dev-YYYY-MM:...
ols --version      # OLS version matching the Odin tag
odinfmt --help     # prints usage
```

## Keeping it in sync

Run `odin-update` whenever Homebrew bumps the Odin formula. The script
re-checks out the matching `ols` tag and rebuilds both binaries — no manual
version juggling needed.

## Neovim integration

The `nvim` stow package wires Odin into the editor:

- `nvim/.config/nvim/lua/plugins/lsp.lua` — enables `ols`
- `nvim/.config/nvim/lua/plugins/conform.lua` — registers `odinfmt` on `*.odin`
- `nvim/.config/nvim/lua/plugins/treesitter.lua` — installs the `odin` parser

These all rely on `ols` and `odinfmt` resolving on `PATH`, which is what this
stow package provides.
