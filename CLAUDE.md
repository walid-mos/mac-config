# `mac-config` — règles repo

Dotfiles macOS gérés par GNU Stow + Makefile. Voir `README.md` pour la doc complète.

- **Tout passe par `make`**, jamais `stow <pkg>` à la main. Cibles disponibles : `make help`.
- **Les post-install reproductibles** (install d'extension CLI, génération de config, …) vivent dans une cible `<package>-post` du `Makefile`, jamais dans un script ad-hoc dans le package Stow.
- **Ne jamais committer** les paths de runtime listés dans `.gitignore` (caches, données de session, fichiers temporaires).
- **Package `obsidian/` = exception au stow** : le vault Brain vit dans iCloud, la config y est copiée via `make obsidian` (push repo → vault), `make obsidian-save` (pull vault → repo, avant commit) et `make obsidian-post` (thème/plugins/fonts). Ne jamais éditer `.obsidian/` du vault directement sans répercuter dans le repo.
