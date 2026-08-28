# json-view — blocs JSON spécialisés dans le transcript

Détecte le JSON dans les messages user/assistant et le rend dans un bloc spécialisé :
boîte arrondie aux couleurs Catppuccin Latte (palette importée du footer), JSON
coloré syntaxiquement (clés bleu, chaînes vert, nombres peach, littéraux mauve),
métadonnées et affordances cliquables dans les bordures.

```
╭─ json · 127 o · 10 lignes ────────────────────────────╮
│ {                                                     │
│   "nom": "test",                                     │
╰─ ouvrir ⤢ · /json open ───────────────────────────────╯
```

- JSON ≤ `JSON_MAX_LINES` lignes (18) : pretty complet.
- Plus grand : 18 premières lignes, bordure basse = marqueur cliquable
  `⤢ +N lignes · tout voir` (ouvre le blob complet via le handler OS).
- Déplié (`/json`) : pretty complet, sans cap.

## Comment ça marche (contraintes renderer)

Le transformer ne peut produire que du markdown, et pi-tui rend les marqueurs
de fence ` ``` ` littéralement. Le bloc est donc dessiné en caractères
box-drawing + **ANSI truecolor brut dans le texte markdown** — vérifié : les
séquences traversent le renderer markdown de pi-tui intactes. Trois pièges
correspondants, gérés ici :

1. les caractères spéciaux markdown (`*`, `` ` ``, `<`, …) sont échappés hors
   séquences ANSI (`escapeMarkdownOutsideAnsi`) ;
2. `[` / `]` ne sont pas échappés (pi-tui rend `\[` littéral) — aucun lien
   markdown dans le bloc : les liens sont des hyperliens **OSC 8 bruts**
   (helper `hyperlink()` de `ui/terminal-text.ts`), donc aucun `](` dans le
   flux qui pourrait former un lien parasite avec un `[` de séquence ANSI ;
3. marked consomme les backslashes d'échappement au rendu : le pad des rangées
   est compensé du nombre d'échappements pour garder le bord droit à l'exacte
   largeur du terminal (`availableWidth`).```

## Modules

- `detect.ts` — scan pur du markdown : fences ```json (et fences sans langage
  parseables) + JSON brut ancré en début de ligne, équilibré (scan conscient des
  chaînes) et parseable. En deçà de `MIN_RAW_LENGTH` sur une seule ligne, le JSON
  inline de la prose n'est pas touché.
- `render.ts` — rendu pur du bloc : coloration JSON maison palette Latte
  (`highlightJsonLine`), boîte box-drawing + ANSI truecolor, cap
  `JSON_MAX_LINES`, compensation des échappements markdown pour l'alignement.
- `blob-store.ts` — persiste chaque JSON pretty dans `$TMPDIR/pi-json-view/<hash>.json`
  (une écriture par contenu, historique borné à 100 blobs pour `/json open [n]`).
- `runtime.ts` — enregistre le `registerMarkdownTransformer` et la commande `/json`.

## Commandes

- `/json` (ou `/json toggle`) — bascule l'état d'expansion global de pi
  (`ctrl+o` natif) puis **recharge le transcript à chaud** : pi ne rejoue pas les
  transformers au toggle (cache `Markdown` clé sur texte+largeur), donc l'extension
  passe par `ctx.reload()`, qui reconstruit le transcript depuis les messages et
  re-rend tous les blocs JSON avec le nouvel état. En TUI uniquement.
- `/json open [n]` — ouvre le n-ième JSON le plus récent (défaut 1) dans
  l'éditeur multi-lignes pi ; **Ctrl+G** y ouvre `$EDITOR` (nvim) sur le blob.
- Clic sur `ouvrir ⤢` ou sur `⤢ +N lignes · tout voir` — hyperliens OSC 8 ;
  le clic ouvre le JSON complet via le handler par défaut de l'OS (pas
  d'expansion in place : pi n'expose pas les clics aux extensions).

## Persistance

- `$TMPDIR/pi-json-view/<hash>.json` — un fichier par contenu (une écriture,
  ensuite réutilisé) ; c'est la cible des liens cliquables et de `/json open`.
- `$TMPDIR/pi-json-view/index.json` — historique borné à 100 blobs. Nécessaire
  car `ctx.reload()` réimporte les extensions (`moduleCache: false`) : le registre
  en mémoire est vidé à chaque reload et relu depuis l'index.

## Limites connues (v2)

1. **`ctrl+o` reste non-live pour les blocs markdown** : seul `/json` force le
   re-rendu (via reload). Intercepter la séquence `ctrl+o` depuis une extension
   serait fragile (keybindings configurables, pas de consommation d'input).
2. **Le reload est lourd** : il réinitialise tous les widgets/footers des autres
   extensions (ils se ré-enregistrent) et réaffiche brièvement le bandeau de
   reload. Le patch propre serait upstream : une epoch d'invalidation dans le
   cache de `Markdown` + `expanded` dans `MarkdownTransformContext`, et
   `setToolsExpanded` qui bump l'epoch avant `requestRender(true)` — c'est ce que
   fait omp en propre via des composants `Expandable`.
3. **Le clic ouvre le handler OS par défaut**, pas nvim directement. Pour
   router le clic vers nvim il faudrait soit un scheme handler OS, soit un
   support upstream des handlers de liens custom.
4. Heuristique : JSON inline court (< `MIN_RAW_LENGTH`), JSON non strict
   (clés sans guillemets, etc.) et fences imbriquées ne sont pas reformatés.
