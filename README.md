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
├── ghostty/.config/ghostty
├── languages/.local/     # binaires installés à la main (voir languages/README.md)
├── nvim/.config/nvim/    # config Neovim
├── opencode/.config/opencode
├── rectangle/Library/    # config Rectangle (window manager)
├── obsidian/Brain/       # config du vault Obsidian « Brain » (voir ci-dessous)
├── starship/.config/     # prompt
└── zsh/                  # .zshenv, .zshrc, .zprofile, .config/zsh
```

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
3. Si une étape post-install est nécessaire, ajouter une cible `<package>-post` et la chaîner dans la cible `install`.
4. `make <package>` puis vérifier les symlinks avec `ls -la $HOME`.
