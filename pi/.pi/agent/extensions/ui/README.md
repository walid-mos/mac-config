# ui — référentiel de placement autour du prompt

Deux emplacements existent, portés par pi et centralisés ici :

```
┌──────────────────────────────────────┐
│            transcript                │
├──────────────────────────────────────┤
│  aboveEditor   (priorité croissante  │
│                 = collé au prompt)   │
├──────────────────────────────────────┤
│  éditeur d'input                     │
├──────────────────────────────────────┤
│  belowEditor                         │
├──────────────────────────────────────┤
│  status line (footer.ts)             │
└──────────────────────────────────────┘
```

## Modules

- `surface.ts` — registre réellement process-global `surfaceRegistry`. pi
  charge chaque extension via un jiti frais (`moduleCache: false`) ; le
  registre est donc stocké sur `globalThis` sous un `Symbol.for(...)`, afin que
  toutes les instances isolées de module récupèrent exactement le même objet.
  Chaque extension déclare une entrée `{ id, placement, priority?, maxLines?,
render }` ; le rendu est agrégé, ordonné globalement, tronqué (`maxLines`,
  défaut 10) et tolérant aux erreurs.
- `ordered-widget-stack.ts` — hôte widget process-global unique par placement
  (monté via `setOrderedAboveEditorWidget` / `setOrderedSurfaceWidget`) qui
  rend toutes les entrées du registre dans l'ordre global de priorité. Ses
  bindings sont eux aussi partagés via `globalThis` : une deuxième extension
  réutilise le host existant au lieu de l'écraser.
- `terminal-text.ts` — primitives mutualisées de largeur, troncature ANSI/OSC 8
  et hyperliens terminal. Les surfaces et le footer partagent cette implémentation.

## Règles

1. **Toute extension qui affiche quelque chose autour du prompt passe par le
   registre process-global** — jamais de `ctx.ui.setWidget()` direct hors de
   `ordered-widget-stack.ts`.
2. Une priorité = un rang stable dans `ABOVE_EDITOR_PRIORITY` ; ne pas inventer
   des nombres magiques hors de cette constante. Rang bas = plus haut dans la
   pile ; `thinking` précède immédiatement `sessionStatus`.
3. Un rendu doit être pur et dépendre uniquement de `{ width, theme }`.
4. Respecter `maxLines` : les surfaces ne repoussent pas le transcript.

## Priorités ci-dessus l'éditeur (`ABOVE_EDITOR_PRIORITY`)

| Clé               | Valeur | Occuper par                    |
| ----------------- | -----: | ------------------------------ |
| `thinking`        |      0 | loader avec aperçu du thinking |
| `sessionStatus`   |     10 | ligne de statut minimaliste    |
| `working`         |     50 | autres indicateurs de travail  |
| `goal`            |    100 | boucle /goal                   |
| `agents`          |    150 | salves d’agents                |
| `backgroundTasks` |    200 | tâches async                   |
| `activity`        |    300 | bandeau d’activité détaillé    |
| `attachments`     |    400 | miniatures jointes au prompt   |

## Footer

`footer/runtime.ts` est l'unique host autorisé à appeler `ctx.ui.setFooter()`.
Les autres extensions contribuent au footer via `ctx.ui.setStatus()` ; le host
central les récupère avec `footerData.getExtensionStatuses()`. Aucun second
footer ne doit remplacer directement le host central.
