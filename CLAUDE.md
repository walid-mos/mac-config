# `mac-config` — règles repo

Dotfiles macOS gérés par GNU Stow + Makefile. Voir `README.md` pour la doc complète.

- **Tout passe par `make`**, jamais `stow <pkg>` à la main. Cibles disponibles : `make help`.
- **Les post-install reproductibles** (install d'extension CLI, génération de config, …) vivent dans une cible `<package>-post` du `Makefile`, jamais dans un script ad-hoc dans le package Stow.
- **Ne jamais committer** les paths de runtime listés dans `.gitignore` (caches, données de session, fichiers temporaires).
