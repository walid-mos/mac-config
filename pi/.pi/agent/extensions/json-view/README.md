# json-view — affichage des blocs JSON du transcript

Détecte le JSON dans les messages user/assistant, le reformate et l'isole du texte
environnant avec un séparateur slim (pas de fence : pi rend les marqueurs ` ``` `
littéralement), cappé à `JSON_MAX_LINES` lignes par défaut, et permet de l'ouvrir.

```
── json · 160 o · 13 lignes · ouvrir ⤢ ────────────────
{
  "nom": "test",
  …
```

- JSON ≤ `JSON_MAX_LINES` lignes : pretty complet.
- JSON plus grand : 18 premières lignes + marqueur cliquable
  `[⤢ +N lignes · tout voir]` (ouvre le blob complet via le handler OS).
- Déplié (`/json`) : pretty complet, sans cap.
- Le contenu est échappé markdown (`*`, `_`, `` ` ``, `[`, `<`, …) pour ne pas
  être interprété par le renderer.```

## Modules

- `detect.ts` — scan pur du markdown : fences ```json (et fences sans langage
  parseables) + JSON brut ancré en début de ligne, équilibré (scan conscient des
  chaînes) et parseable. En deçà de `MIN_RAW_LENGTH` sur une seule ligne, le JSON
  inline de la prose n'est pas touché.
- `render.ts` — rendu markdown pur : séparateur slim dimensionné à la largeur
  (`── json · … ──`), pretty en texte brut échappé, cap `JSON_MAX_LINES` avec
  marqueur cliquable au-delà quand l'état global pi est replié.
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
- Clic sur `ouvrir ⤢` ou sur le marqueur `⤢ +N lignes` — les liens markdown sont
  rendus en OSC 8 par pi-tui ; le clic ouvre le JSON complet via le handler par
  défaut de l'OS (pas d'expansion in place : pi n'expose pas les clics aux
  extensions).

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
