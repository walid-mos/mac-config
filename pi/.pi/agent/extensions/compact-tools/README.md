# compact-tools — 1 ligne = 1 tool call

Remplace le rendu des tools built-in `read`, `grep`, `find`, `ls`, `bash` par une ligne
unique d'information. Les calls compacts consécutifs deviennent une timeline
stable : Pi n'ajoute qu'un spacer externe, le call courant reste net et
l'historique garde un contraste lisible. Au-delà de six calls, les étapes
anciennes se replient dans un compteur qui conserve le nombre d'erreurs.
`write` et `edit` partagent leur renderer riche dans `mutation-view`.

```
├─ ✓ read · agent.ts · 120 lignes
├─ ✓ grep · "registerTool" · 8 correspondances
╰─ ● bash · pnpm test

│  ⋯ 12 étapes précédentes · 1 erreur
├─ ✓ read · tui.md · 943 lignes
╰─ ✗ bash · pnpm test · exit 1
```

- `ctrl+o` délègue au `renderResult` natif : sortie complète, images, elapsed
  time bash (l'état `startedAt`/`endedAt` est seedé comme le renderer natif).
- L'exécution n'est PAS réimplémentée : `execute` délègue à la définition
  native créée avec le `cwd` de la ligne (cache par tool/cwd), récupéré au
  moment de l'appel via `ctx.cwd`.
- La définition enregistrée étale la définition native : schéma, label,
  `promptSnippet` et `promptGuidelines` sont conservés (non hérités par pi).
- `renderShell: "self"` : la Box par défaut (fond/padding) ne s'applique pas.
  L'extension ne modifie aucun artefact généré du runtime Pi : les composants
  précédents rendent zéro ligne et le plus récent compose toute la pile, donc
  Pi ne place qu'un spacer externe avant le groupe.
- Option `hideRowOnSuccess` : masque la row une fois le succès établi quand le
  corps du résultat parle de lui-même (utilisé par mutation-view) ; option
  `collapsedBody` : corps collapsé riche du renderer de mutation.
- Troncature ANSI-safe via `../ui/terminal-text.ts` (source de vérité partagée
  avec le footer et json-view).

## Découpage SRP

- `compact-tools.ts` : point d'entrée ; map tool → factory native et register.
- `overrides.ts` : factory d'overrides, `createBuiltin` injecté (testable sans
  résoudre les packages pi) ; gère délégation d'exécution et cache par cwd.
- `renderer.ts` : renderers partagés (call compact / résultat collapsé ou
  natif étendu), réutilisables par toute extension possédant un tool.
- `stack.ts` : état brut process-global partagé entre les graphes d'extensions,
  mais implémentation recréée à chaque chargement ; `/reload` prend donc toujours
  le code courant sans clé de cache versionnée. Il groupe les calls consécutifs
  et porte la timeline plafonnée sur le dernier composant. Aucun nom de tool
  n'est hardcodé : chaque `createCompactRenderers()` s'enregistre par défaut ;
  les renderers à corps riche opt-out avec `stackRows: false`.
- `lifecycle.ts` : reconstruit les groupes depuis la session et suit les
  messages streamés sans dupliquer les tool calls.
- `line.ts` : composition pure de la ligne thémée + troncature.
- `types.ts` : types structurels minimaux (aucun import runtime pi).

## Limites connues

1. Le glyphe pending `●` n'est pas animé.
2. Pas de hint keybinding sur la ligne (l'utilisateur connaît `ctrl+o`).
3. Le résumé `read` compte les lignes du texte renvoyé, pas du fichier source
   (sauf `totalLines` présent dans `details.truncation`).
