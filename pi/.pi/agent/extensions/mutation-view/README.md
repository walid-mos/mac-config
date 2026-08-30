# mutation-view — rendu commun de `edit` et `write`

Une seule extension possède les deux tools de mutation de fichiers et leur
langage visuel. Elle constitue le point de remplacement du design actuel si la
vue de mutation s'éloigne plus tard du cadre JSON.

- Pending/erreur : row compacte `●/✗ <tool> · <fichier> · <résumé>`.
- Succès `edit` : diff par remplacement, contextes/suppressions/ajouts.
- Succès `write` : contenu créé sous forme de lignes ajoutées.
- Vue collapsée : cadre partagé, plafond de 18 lignes, fondu et pied `ctrl+o`.
- Vue étendue : renderer natif (`renderResult` pour edit, `renderCall` pour
  write afin de conserver sa coloration syntaxique).
- Exécution : délégation stricte aux définitions natives résolues avec `ctx.cwd`;
  aucune réimplémentation de l'IO ou de la file de mutation.
- Aucun artefact généré ou package installé n'est modifié.

## Découpage

- `index.ts` : unique entrypoint, enregistre les overrides `edit` et `write`.
- `frame.ts` : cadre de mutation commun et primitives de fondu/plafonnement.
- `diff.ts` : diff ligne à ligne borné utilisé par edit.
- `edit.ts` : parsing, composant et corps collapsé edit.
- `write.ts` : parsing, normalisation, composant et corps collapsé write.
