# edit-view — le tool `edit` en cadre de diffs

Rend le tool built-in `edit` dans un cadre arrondi (le style json-view, via les
primitives partagées `ui/frame.ts`) : une ligne diff par entrée de `edits[]`,
au lieu du diff natif pleine-page sur tout le fichier.

```text
╭─ edit · agent.ts · 2 éditions ────────────────────────╮
│   const a = 1;                                        │
│ - const b = 2;                                        │
│ + const b = 3;                                        │
│                                                       │
│ - render(old);                                        │
│ + render(new);                                        │
╰─ ctrl+o · diff natif ─────────────────────────────────╯
```

- Row compacte pendant l'exécution (`● edit · agent.ts`) et sur erreur
  (`✗ edit · agent.ts · oldText introuvable`) ; la row disparaît une fois le
  succès établi, le cadre parle de lui-même (`hideRowOnSuccess` de compact-tools).
- Chaque edit est diffée indépendamment (`diff.ts`, LCS par lignes, repli sans
  table au-delà d'une borne) ; contextes en `toolDiffContext`, suppressions en
  `toolDiffRemoved`, ajouts en `toolDiffAdded`.
- Plafond à 18 lignes de contenu avec fondu vers le fond et rangée `· · ·`
  (identique aux blocs JSON) ; le pied annonce `⤢ +N lignes · ctrl+o`.
- `ctrl+o` délègue au `renderResult` natif : diff complet du fichier.
- L'exécution n'est PAS réimplémentée : `execute` délègue à la définition
  native créée avec le `cwd` de la ligne (cache par cwd).
- `parseEditArgs` accepte les formes d'args réelles : `edits[]` (aussi passée
  en JSON string par certains modèles) et la paire legacy `oldText`/`newText`.

## Découpage SRP

- `index.ts` : point d'entrée ; override `edit` (renderShell self, délégation
  d'exécution, cache par cwd).
- `body.ts` : corps collapsé (cadre ou vide sur erreur) — module sans import pi.
- `component.ts` : composant du cadre, diffs calculés une fois puis assemblés
  par largeur de rendu.
- `frame.ts` : parsing des args, composition pure des rows (titre, diffs,
  séparateurs, plafond/fondu, pied).
- `diff.ts` : diff ligne à ligne pur (LCS), aucun IO ni thème.
