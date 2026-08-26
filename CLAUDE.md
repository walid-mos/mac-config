# `mac-config` — règles repo

Dotfiles macOS gérés par GNU Stow + Makefile. Voir `README.md` pour la doc complète.

- **Tout passe par `make`**, jamais `stow <pkg>` à la main. Cibles disponibles : `make help`.
- **Les post-install reproductibles** (install d'extension CLI, génération de config, …) vivent dans une cible `<package>-post` du `Makefile`, jamais dans un script ad-hoc dans le package Stow.
- **Ne jamais committer** les paths de runtime listés dans `.gitignore` (caches, données de session, fichiers temporaires).
- **Package `obsidian/` = stow à cible custom** : le vault Brain vit dans iCloud ; sa config `.obsidian` est stowée par `make obsidian` (jamais `stow` à la main — la cible n'est pas `$HOME`). `make obsidian-save` (`--adopt`) ré-adopte les fichiers qu'Obsidian aurait remplacés. Thème et plugins vivent en fichiers réels dans le vault (synchronisés par iCloud, réinstallés nativement par Obsidian au besoin) ; les fonts sont dans le Brewfile. Éditer la config dans le repo, pas dans le vault.
