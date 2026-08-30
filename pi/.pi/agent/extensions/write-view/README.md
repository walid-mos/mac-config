# write-view — le tool `write` en cadre de création

Rend le tool built-in `write` avec le même langage visuel que `edit-view` :
une row compacte pendant l'exécution ou sur erreur, puis un cadre arrondi de
lignes ajoutées après succès.

```text
╭─ write · agent.ts · 3 lignes ────────────────────────╮
│ + import type { ExtensionAPI } from "...";            │
│ +                                                     │
│ + export default function extension() {}              │
╰─ ctrl+o · contenu natif ──────────────────────────────╯
```

- Le cadre partage `mutation-view/frame.ts` avec `edit-view` : même titre,
  plafond de 18 lignes, fondu, rangée de points et pied.
- Les lignes sont toutes rendues avec `toolDiffAdded`; les fins de fichier
  vides ne créent pas de fausse ligne ajoutée.
- `ctrl+o` délègue au `renderCall` natif de `write`, qui porte l'aperçu complet
  et la coloration syntaxique ; le composant natif est conservé séparément de
  la row compacte lors des bascules collapse/expand.
- L'exécution native est déléguée avec le `cwd` réel et son file mutation queue.
- Aucun artefact généré ou package installé n'est modifié.

## Découpage SRP

- `index.ts` : override, cache de définition native par cwd et délégation.
- `body.ts` : choisit cadre de succès ou row d'erreur.
- `component.ts` : composant responsive du cadre.
- `frame.ts` : parsing des args, normalisation des lignes et adaptation vers
  le cadre partagé.
