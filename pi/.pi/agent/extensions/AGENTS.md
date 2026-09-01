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

## Tool calls et vues compactes

- Déclarer tout tool utilisant `createCompactRenderers()` dans `compact-tools/registry.ts` ; ce registre est l'unique source de vérité pour le propriétaire, la stack, le masquage après succès et la stratégie d'expansion.
- Dériver les listes de tools du registre ; ne jamais maintenir de tableau, switch de politique ou flags de renderer parallèles dans les extensions propriétaires.
- Garder l'exécution et le corps riche dans l'extension propriétaire ; faire appliquer et valider la politique commune par `createCompactRenderers()`.
- En expansion `custom`, conserver la même direction artistique et révéler le contenu complet ; ne jamais basculer vers le renderer natif.
- Mutualiser l'enregistrement de tools homologues avec une table de descripteurs et une factory commune ; supprimer toute branche, option ou adaptation devenue inutilisée pendant le refactor.

## Vérifications après modification

- Syntaxe d'une extension : `npx esbuild <fichier>.ts --outfile=/dev/null --format=esm --packages=external`
- Gate complète : `make pi-test`
- Après une modification structurelle des tool views : charger `fallow-gate`, puis exécuter `fallow audit --base <merge-base> --quiet` et `fallow dupes --near --changed-since <merge-base>`.
- Extension modifiée : `/reload` dans la session Pi courante.
