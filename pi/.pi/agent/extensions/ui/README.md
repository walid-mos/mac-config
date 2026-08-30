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

- `surface.ts` — registre global `surfaceRegistry`. Chaque extension déclare
  une entrée `{ id, placement, priority?, maxLines?, render }` ; le rendu est
  agrégé, tronqué (`maxLines`, défaut 10) et tolerant aux erreurs.
- `ordered-widget-stack.ts` — hôte widget unique par placement (monté via
  `setOrderedAboveEditorWidget` / `setOrderedSurfaceWidget`) qui rend les
  entrées du registre dans l'ordre de priorité.
- `terminal-text.ts` — primitives mutualisées de largeur, troncature ANSI/OSC 8
  et hyperliens terminal. Les surfaces et le footer partagent cette implémentation.

## Règles

1. **Toute extension qui affiche quelque chose autour du prompt passe par ce
   registre** — jamais de widget TUI direct en concurrence avec les autres.
2. Une priorité = un rang stable dans `ABOVE_EDITOR_PRIORITY` ; ne pas inventer
   des nombres magiques hors de cette constante. Rang bas = proche du prompt.
3. Un rendu doit être pur et dépendre uniquement de `{ width, theme }`.
4. Respecter `maxLines` : les surfaces ne repoussent pas le transcript.

## Priorités ci-dessus l'éditeur (`ABOVE_EDITOR_PRIORITY`)

| Clé | Valeur | Occuper par |
|---|---:|---|
| `working` | 50 | loader de travail (mots rotatifs) |
| `goal` | 100 | boucle /goal |
| `backgroundTasks` | 200 | tâches async |
| `activity` | 300 | bandeau d'activité |

La status line (footer) n'utilise pas ce registre : elle remplit directement
le slot natif de status bar de pi et reste toujours tout en bas.
