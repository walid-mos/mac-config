# mutation-view — rendu commun de `edit` et `write`

Une seule extension possède les deux tools de mutation de fichiers et leur
langage visuel. Contrairement aux données structurées de `json-view`, une
mutation réussie utilise une composition ouverte, pensée comme un onglet de
fichier plutôt qu'une carte fermée.

- Pending/erreur : row compacte `●/✗ <tool> · <fichier> · <résumé>`.
- Succès : en-tête ouvert `┌ <tool> ─ <chemin> ─ <statistiques>`, rail gauche
  pour le contenu, puis affordance `ctrl+o` sans bordure basse.
- Succès `edit` : diff natif numéroté avec compteurs `−n +n`, contextes,
  suppressions et ajouts ; les lignes retirées/ajoutées portent un fond pastel
  rouge/vert rectangulaire sur toute la largeur du rail, simulé par un mélange
  Catppuccin à 15 % ; le padding emploie des espaces insécables pour survivre au
  trim terminal de Pi.
- Succès `write` : contenu créé sous forme de lignes ajoutées numérotées et
  compteur `+n lignes`.
- Vue collapsée : toute la largeur du transcript moins une marge droite égale
  à la gouttière (`signe + numéro + séparateur`). Les lignes de code trop longues
  wrappent avec une gouttière de continuation plutôt que d'être tronquées.
- Hauteur : 18 lignes visuelles, atténuation du texte et du fond des dernières
  lignes, puis compteur des lignes masquées. Sur une largeur étroite, le
  basename remplace le chemin et les stats s'effacent avant de rendre l'en-tête
  illisible.
- Vue étendue : conserve exactement la DA mutation (en-tête, rail, gouttière,
  wrap et fonds pastel) et retire seulement la limite de 18 lignes. `ctrl+o`
  bascule entre l'aperçu plafonné et ce contenu complet.
- Exécution : délégation stricte aux définitions natives résolues avec `ctx.cwd`;
  aucune réimplémentation de l'IO ou de la file de mutation.
- Aucun artefact généré ou package installé n'est modifié.

## Découpage

- `index.ts` : unique entrypoint, enregistre les overrides `edit` et `write`.
- `frame.ts` : composition ouverte commune, rail, stats et plafonnement.
- `diff.ts` : diff ligne à ligne borné utilisé par edit.
- `edit.ts` : parsing, composant et corps collapsé edit.
- `write.ts` : parsing, normalisation, composant et corps collapsé write.
