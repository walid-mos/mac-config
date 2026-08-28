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
  (`ctrl+o` natif) puis **recharge le transcript à chaud** : pi ne rejoue pas les
  transformers au toggle (cache `Markdown` clé sur texte+largeur), donc l'extension
  passe par `ctx.reload()`, qui reconstruit le transcript depuis les messages et
  re-rend tous les blocs JSON avec le nouvel état. En TUI uniquement.
- `/json open [n]` — ouvre le n-ième JSON le plus récent (défaut 1) dans
  l'éditeur multi-lignes pi ; **Ctrl+G** y ouvre `$EDITOR` (nvim) sur le blob.
- Clic sur `ouvrir ⤢` — les liens markdown sont rendus en OSC 8 par pi-tui ;
  le clic ouvre le handler par défaut de l'OS sur le fichier `.json` persisté.

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
4. **Le clic ouvre le handler OS par défaut**, pas nvim directement. Pour
   router le clic vers nvim il faudrait soit un scheme handler OS, soit un
   support upstream des handlers de liens custom.
5. Heuristique : JSON inline court (< `MIN_RAW_LENGTH`), JSON non strict
   (clés sans guillemets, etc.) et fences imbriquées ne sont pas reformatés.
````
