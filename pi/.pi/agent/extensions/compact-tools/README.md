# compact-tools — 1 ligne = 1 tool call

Remplace le rendu des tools built-in `read`, `grep`, `find`, `ls` par une ligne
unique d'information. `write` garde son rendu natif complet ; `edit` possède
son propre cadre (extension edit-view).

- `ctrl+o` délègue au `renderResult` natif : sortie complète, images, elapsed
  time bash (l'état `startedAt`/`endedAt` est seedé comme le renderer natif).
- L'exécution n'est PAS réimplémentée : `execute` délègue à la définition
  native créée avec le `cwd` de la ligne (cache par tool/cwd), récupéré au
  moment de l'appel via `ctx.cwd`.
- La définition enregistrée étale la définition native : schéma, label,
  `promptSnippet` et `promptGuidelines` sont conservés (non hérités par pi).
- `renderShell: "self"` : la Box par défaut (fond/padding) ne s'applique pas ;
  le patch `scripts/pi-patch-tool-execution.py` laisse les tools self-rendered
  posséder leur propre espacement (aucun spacer imposé), et
  `scripts/pi-patch-assistant-thinking.py` ajoute la ligne vide entre le texte
  de l'assistant et les tool rows qui suivent.
- Option `hideRowOnSuccess` : masque la row une fois le succès établi quand le
  corps du résultat parle de lui-même (utilisé par edit-view) ; option
  `collapsedBody` : corps collapsé riche (le cadre de diff d'edit-view).
- Troncature ANSI-safe via `../ui/terminal-text.ts` (source de vérité partagée
  avec le footer et json-view).

## Découpage SRP

- `compact-tools.ts` : point d'entrée ; map tool → factory native et register.
- `overrides.ts` : factory d'overrides, `createBuiltin` injecté (testable sans
  résoudre les packages pi) ; gère délégation d'exécution et cache par cwd.
- `renderer.ts` : renderers partagés (call compact / résultat collapsé ou
  natif étendu), réutilisables par toute extension possédant un tool.
- `line.ts` : composition pure de la ligne thémée + troncature.
- `types.ts` : types structurels minimaux (aucun import runtime pi).

## Limites connues

1. Le glyphe pending `●` n'est pas animé.
2. Pas de hint keybinding sur la ligne (l'utilisateur connaît `ctrl+o`).
3. Le résumé `read` compte les lignes du texte renvoyé, pas du fichier source
   (sauf `totalLines` présent dans `details.truncation`).
