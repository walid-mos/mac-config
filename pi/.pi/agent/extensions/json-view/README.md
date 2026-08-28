# json-view — affichage des blocs JSON du transcript

Détecte le JSON dans les messages user/assistant, le reformate et l'isole du texte
environnant, l'aperçoit minifié quand il est gros, et permet de l'ouvrir dans l'éditeur.

````
*json · 42 Ko · 1 240 lignes · /json open · ouvrir ⤢*


## Modules

- `detect.ts` — scan pur du markdown : fences ```json (et fences sans langage
  parseables) + JSON brut ancré en début de ligne, équilibré (scan conscient des
  chaînes) et parseable. En deçà de `MIN_RAW_LENGTH` sur une seule ligne, le JSON
  inline de la prose n'est pas touché.
- `render.ts` — rendu markdown pur : en-tête (type, taille, lignes, lien, hint),
  bloc ```json pretty, ou aperçu minifié tronqué à la largeur au-delà de
  `COLLAPSED_LINE_THRESHOLD` lignes tant que l'état global pi est replié.
- `blob-store.ts` — persiste chaque JSON pretty dans `$TMPDIR/pi-json-view/<hash>.json`
  (une écriture par contenu, historique borné à 100 blobs pour `/json open [n]`).
- `runtime.ts` — enregistre le `registerMarkdownTransformer` et la commande `/json`.

## Commandes

- `/json` (ou `/json toggle`) — bascule l'état d'expansion global de pi
  (`ctrl+o` natif). Les blocs **déjà affichés** ne se redessinent pas à chaud
  (le transformer n'est rejoué qu'au prochain rendu : nouveau message, resize,
  restore de session) — voir Limites.
- `/json open [n]` — ouvre le n-ième JSON le plus récent (défaut 1) dans
  l'éditeur multi-lignes pi ; **Ctrl+G** y ouvre `$EDITOR` (nvim) sur le blob.
- Clic sur `ouvrir ⤢` — les liens markdown sont rendus en OSC 8 par pi-tui ;
  le clic ouvre le handler par défaut de l'OS sur le fichier `.json` persisté.

## Limites connues (v1, volontaire)

1. **Pas de re-rendu à chaud des blocs markdown sur `ctrl+o`** : pi n'expose pas
   d'invalidation de transcript aux transformers ; seuls les messages/entrées
   custom et les tool results réagissent à chaud. Idéalement upstream : passer
   `expanded` aux `MarkdownTransformContext`.
3. **Le clic ouvre le handler OS par défaut**, pas nvim directement. Pour
   router le clic vers nvim il faudrait soit un scheme handler OS, soit un
   support upstream des handlers de liens custom.
4. Heuristique : JSON inline court (< `MIN_RAW_LENGTH`), JSON non strict
   (clés sans guillemets, etc.) et fences imbriquées ne sont pas reformatés.
````
