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
- `registry.ts` centralise propriétaire, participation à la stack, masquage de
  la row et stratégie d'expansion de chaque tool. Les extensions propriétaires
  ne répètent plus ces options ; elles injectent uniquement leur éventuel
  `resultBody` riche.
- Troncature ANSI-safe via `../ui/terminal-text.ts` (source de vérité partagée
  avec le footer et json-view).

## Découpage SRP

- `compact-tools.ts` : point d'entrée ; map tool → factory native et register.
- `overrides.ts` : factory d'overrides, `createBuiltin` injecté (testable sans
  résoudre les packages pi) ; gère délégation d'exécution et cache par cwd.
- `registry.ts` : registre exhaustif de politique visuelle pour `read`, `grep`,
  `find`, `ls`, `bash`, `edit` et
  `write` ; tout nom inconnu résout vers la politique `external` par défaut
  (row empilable, corps étendu fourni par l'appelant) afin qu'aucun tool ne
  retombe sur la box Pi.
- `renderer.ts` : renderers partagés (call compact / résultat riche ou natif
  étendu), validés contre le registre et réutilisables par chaque propriétaire.
- `api.ts` : façade process-global (`piCompactStyle`) publiée par l'entrée
  `compact-tools.ts` : `createRowRenderers` (rows pour tout tool hors registre,
  sujet/résumé/corps fournis par l'appelant) et `composeRowLine` (ligne hors
  tool). Les packages npm patchés (web-access, mcp-adapter, frontend-check) lisent ce slot via un bridge embarqué dans leur patch : le style
  n'existe qu'ici, jamais dupliqué dans les patches.
- `stack.ts` : état brut process-global partagé entre les graphes d'extensions,
  mais implémentation recréée à chaque chargement ; `/reload` prend donc toujours
  le code courant sans clé de cache versionnée. Il groupe les calls consécutifs
  et porte la timeline plafonnée sur le dernier composant. Aucun nom de tool
  n'est hardcodé : chaque `createCompactRenderers()` applique la politique du
  registre ; les renderers à corps riche y sont explicitement hors stack.
- `lifecycle.ts` : reconstruit les groupes depuis la session et suit les
  messages streamés sans dupliquer les tool calls.
- `summary.ts` : extraction pure du sujet (args) et du résumé (résultat) par
  tool ; `COMPACT_TOOLS` est dérivé du propriétaire déclaré dans le registre.
- `line.ts` : composition pure de la ligne thémée + troncature.
- `types.ts` : types structurels minimaux (aucun import runtime pi).

## Limites connues

1. Le glyphe pending `●` n'est pas animé.
2. Pas de hint keybinding sur la ligne (l'utilisateur connaît `ctrl+o`).
3. Le résumé `read` compte les lignes du texte renvoyé, pas du fichier source
   (sauf `totalLines` présent dans `details.truncation`).
4. `[compaction]` et `[skill]` sont rendus par des composants du cœur Pi, hors
   de portée des extensions : ils ne suivent pas ce style.
