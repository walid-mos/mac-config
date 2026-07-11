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

**Exception `obsidian/`** : le vault vit dans iCloud (`~/Library/Mobile Documents/iCloud~md~obsidian/Documents/Brain`), où les symlinks Stow sont peu fiables. La config (`app.json`, `appearance.json`, snippets, réglages de plugins) est donc **copiée** par `make obsidian`, rapatriée par `make obsidian-save` avant commit, et les binaires (thème AnuPpuccin, plugins communautaires, fonts) sont installés par `make obsidian-post`.

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
| `make obsidian`   | Pousse la config versionnée vers le vault Brain (copie, pas de stow)  |
| `make obsidian-save` | Rapatrie la config du vault dans le repo (avant commit)            |
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
