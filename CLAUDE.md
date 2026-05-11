# `mac-config` — règles repo

Dotfiles macOS gérés par GNU Stow + Makefile. Voir `README.md` pour la doc complète.

- **Tout passe par `make`**, jamais `stow <pkg>` à la main. Cibles disponibles : `make help`.
- **Les post-install reproductibles** (enregistrement MCP, install d'extension CLI, …) vivent dans une cible `<package>-post` du `Makefile`, jamais dans un script ad-hoc dans le package Stow.
- **Ne jamais committer** les paths de runtime listés dans `.gitignore` (sessions, history, plugins, caches, projects).
- **MCP user-scope** : `~/.claude.json` n'est pas versionnable. Pour rendre un MCP reproductible, ajouter `claude mcp add … -s user` à la cible `claude-post`.
