# Développement des extensions Pi de ce dépôt

Instructions valables pour tout travail sur les extensions de
`pi/.pi/agent/extensions/` — conception, code, documentation et tests.
Les règles git et générales du dépôt sont dans l'`AGENTS.md` racine : elles
s'appliquent telles quelles, sans duplication ici.

## Journal de développement

- Lire `JOURNAL.md` avant toute modification d'une extension.
- Ajouter une entrée à `JOURNAL.md` après chaque action terminée (format
  défini dans le fichier lui-même) ; ne jamais réécrire une entrée passée.
- Mettre à jour le journal **avant** de committer : le commit emporte son entrée.

## Surfaces TUI et footer

- Toujours enregistrer les widgets autour de l'éditeur dans le registre process-global `ui/surface.ts` via `ui/ordered-widget-stack.ts` ; ne jamais appeler `ctx.ui.setWidget()` directement ailleurs.
- Toujours contribuer au bas d'écran via le footer central (`ctx.ui.setStatus()` pour une extension) ; ne jamais appeler `ctx.ui.setFooter()` hors de `footer/runtime.ts`.

## Vérifications après modification

- Syntaxe d'une extension : `npx esbuild <fichier>.ts --outfile=/dev/null --format=esm --packages=external`
- Gate complète : `make pi-test`
- Extension modifiée : `/reload` dans la session Pi courante.
