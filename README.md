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

Sur un mac vierge (rien d'installé, pas même Homebrew ni git), **une seule commande**, sans clone préalable :

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/walid-mos/mac-config/main/bootstrap.sh)"
```

`bootstrap.sh` installe les Xcode CLT (donc git), clone le repo dans `~/.stow_repository`, puis lance `make bootstrap`. Rien d'autre à taper.

Si le repo est déjà cloné :

```bash
cd ~/.stow_repository && make bootstrap
```

`make bootstrap` enchaîne, de zéro et de façon idempotente :

1. **Xcode Command Line Tools** — déclenche la pop-up d'install et attend qu'elle finisse (git, compilateur).
2. **Homebrew** — script d'install officiel en mode non-interactif s'il manque.
3. **`brew bundle`** — installe les formules et casks du `Brewfile` (voir ci-dessous).
4. **`make install`** — stow tous les packages + post-hooks.

La cible est rejouable : chaque étape détecte ce qui est déjà en place. Les deux préfixes brew (`/opt/homebrew/bin`, `/usr/local/bin`) sont ajoutés au `PATH` par le Makefile, donc `brew bundle` et les post-hooks trouvent le brew fraîchement installé sans relancer dans un nouveau shell.

### Le `Brewfile`

Liste éditée à la main des paquets d'un mac neuf (34 → sélection). **Ne pas régénérer via `brew bundle dump`** : le dump réinjecte les dépendances transitives et les apps perso volontairement exclues. Ajouter/retirer un paquet = éditer directement le `Brewfile`, puis `make brew-bundle`. Les post-hooks couvrent le hors-brew (pi via `pnpm`, plugin impeccable, init rtk, assets Obsidian).


## Cibles Makefile

| Cible             | Effet                                                                 |
|-------------------|-----------------------------------------------------------------------|
| `make bootstrap`  | Mac neuf de zéro : Xcode CLT + Homebrew + `brew bundle` + `install`   |
| `make brew-bundle`| Installe les paquets du `Brewfile` (formules + casks)                 |
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
