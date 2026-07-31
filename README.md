# mac-config

Dotfiles macOS gérés via [GNU Stow](https://www.gnu.org/software/stow/) + un Makefile qui orchestre les post-hooks (MCP, etc.).

## Layout

Chaque dossier de premier niveau est un **package Stow** dont l'arborescence interne reflète celle de `$HOME` :

```
.stow_repository/
├── Makefile              # orchestrateur stow + hooks post-install
├── cmux/.config/cmux/    # config cmux
├── colima/.config/colima # config colima (template _templates/)
├── docker/.docker/       # config Docker CLI
├── gh/.config/gh/        # config.yml de GitHub CLI (hosts.yml = token, ignoré)
├── ghostty/.config/ghostty
├── git/                  # .gitconfig + .config/git/ignore
├── homebrew/.config/homebrew # formules de tap approuvées (trust.json)
├── languages/.local/     # binaires installés à la main (voir languages/README.md)
├── nvim/.config/nvim/    # config Neovim
├── opencode/.config/opencode
├── pi/.pi/agent/          # settings.json de l'agent CLI pi (auth + sessions ignorés)
├── rclone/.config/rclone/ # rclone.conf (remote R2 en env_auth, aucun secret)
├── rectangle/Library/    # config Rectangle (window manager)
├── obsidian/Brain/       # config du vault Obsidian « Brain » (voir ci-dessous)
├── starship/.config/     # prompt
└── zsh/                  # .zshenv, .zshrc, .zprofile, .config/zsh
```

**Package `pi/`** : `make pi` stow `~/.pi/agent/settings.json`, `make pi-post` installe le CLI (`pnpm add -g @earendil-works/pi-coding-agent`) s'il manque. L'auth se fait au premier lancement (`pi` puis `/login`) et vit dans `~/.pi/agent/auth.json`, jamais versionné. pi écrit dans le symlink quand on change un réglage via `/settings` : le diff apparaît directement dans le repo, à vérifier avant commit.

**Package `obsidian/`** : le vault reste dans iCloud (`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Brain`), seule sa config `.obsidian` est stowée — cible custom, donc via `make obsidian` (symlinks relatifs, portables entre machines). Les binaires non versionnés (thème AnuPpuccin, plugins communautaires, fonts) sont installés par `make obsidian-post`. Si Obsidian remplace un symlink par un vrai fichier en sauvegardant ses réglages, `make obsidian-save` (`stow --adopt`) ré-adopte le fichier dans le repo — vérifier le `git diff` puis committer.

## Bootstrap d'une nouvelle machine

```bash
git clone https://github.com/walid-mos/mac-config.git ~/.stow_repository
cd ~/.stow_repository
make install
```

`make install` symlinke tous les packages dans `$HOME` puis exécute les post-hooks.

## Cibles Makefile

| Cible             | Effet                                                                 |
|-------------------|-----------------------------------------------------------------------|
| `make`, `make install` | Stow tous les packages + lance tous les post-hooks                |
| `make <package>`  | Stow un seul package (`make nvim`, `make zsh`, …)                     |
| `make restow`     | Rebuild les symlinks (utile après ajout/suppression de fichiers)      |
| `make unstow`     | Supprime tous les symlinks                                            |
| `make obsidian`   | Stow la config `.obsidian` dans le vault Brain (cible custom iCloud) |
| `make obsidian-save` | `stow --adopt` : ré-adopte les fichiers qu'Obsidian a dé-symlinkés |
| `make obsidian-post` | Installe thème AnuPpuccin, plugins communautaires et fonts         |
| `make help`       | Affiche l'aide                                                        |

## Conventions

- **Pas de runtime data committée.** Tout ce qui est généré au runtime (caches, données de session, fichiers temporaires) est explicitement ignoré dans `.gitignore`.
- **Secrets.** `zsh/.config/zsh/secrets` est gitignored. Toute API key vit dans ce fichier ou dans le trousseau macOS.
- **Stow ne supporte pas de hooks natifs.** Tout post-install passe par le Makefile (`<package>-post`).

## Ajouter un nouveau package

1. Créer le dossier au niveau racine en reproduisant l'arborescence cible depuis `$HOME`.
2. L'ajouter à la variable `PACKAGES` du `Makefile`.
3. Si l'outil écrit d'autres fichiers dans le dossier cible (token, lock, state), ajouter aussi le package à `NOFOLD` : sans `--no-folding`, Stow replie le dossier entier en symlink et l'outil écrit ses secrets dans le repo.
4. Si une étape post-install est nécessaire, ajouter une cible `<package>-post` et la chaîner dans la cible `install`.
5. `make <package>` puis vérifier les symlinks avec `ls -la $HOME`.
