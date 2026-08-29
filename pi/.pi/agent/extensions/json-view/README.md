# json-view - blocs JSON spécialisés dans le transcript

Détecte le JSON dans les messages user/assistant et le rend dans un bloc spécialisé :
boîte arrondie aux couleurs Catppuccin Latte, coloration syntaxique, métadonnées
et affordances cliquables dans les bordures.

```text
╭─ json · 127 o · 10 lignes ────────────────────────────╮
│ {                                                     │
│   "nom": "test",                                     │
╰─ ouvrir ⤢ · /json open ───────────────────────────────╯
```

- **Streaming** : le cadre de croissance couvre une fence ` ```json `
  ouverte et le JSON brut sans fence. Le détecteur essaie les racines de
  début de ligne de l'extérieur vers l'intérieur, répare temporairement le
  fragment inachevé et rejette les queues qui ressemblent à de la prose.
- JSON de 18 lignes ou moins : pretty-print complet.
- JSON plus grand : 15 lignes pleines, 3 lignes fondues vers le fond, puis une
  rangée `· · ·`. La bordure basse `⤢ +N lignes · tout voir` ouvre le blob
  complet.
- Déplié (`/json`) : pretty-print complet, sans cap ni fondu.
- Une fence fermée étiquetée `json` mais invalide reste rendue nativement ; le
  transformer ne lève pas d'exception sur le chemin d'affichage.

## Contraintes du renderer

Le hook Pi produit du markdown. Le cadre est donc dessiné en box-drawing avec
de l'ANSI truecolor brut, que le renderer markdown de pi-tui laisse passer.

1. `ansi-text.ts` tokenise CSI/OSC sans couper les séquences, puis échappe les
   caractères markdown uniquement dans les segments texte.
2. Les liens utilisent OSC 8 via `ui/terminal-text.ts`, jamais la syntaxe de
   lien markdown.
3. Les lignes JSON sont tronquées à la largeur de contenu avant échappement et
   coloration. Chaque rangée respecte exactement `availableWidth`, y compris
   sur un terminal plus étroit que le titre.

## Découpage SRP

- `index.ts` : point d'entrée imposé par la découverte d'extensions Pi ; branche
  le transformer et la commande.
- `json-command.ts` : parse et exécute `/json` et `/json open [n]`.
- `markdown-fences.ts` : scan des fences Markdown fermées ou ouvertes.
- `json-structure.ts` : équilibrage des conteneurs et validation des fragments
  JSON incomplets.
- `detect-json.ts` : orchestre un scan unique et retourne blocs complets, fence
  ouverte ou racine brute ouverte.
- `json-value.ts` : type JSON récursif, parse typé et pretty-print.
- `ansi-text.ts`, `json-colors.ts`, `json-syntax.ts` : contrôle terminal,
  palette/fondu et coloration lexicale.
- `json-frame.ts` : layout borné, fondu, bordures et labels communs.
- `json-box.ts` : adapte un bloc complet ou un stream au cadre partagé.
- `transform-markdown.ts` : remplace les plages détectées sans mélanger
  détection, stockage et rendu.
- `blob-store.ts` : persistance des JSON pretty par hash et historique de
  récence pour `/json open`.

## Commandes

- `/json` ou `/json toggle` : bascule l'état d'expansion global, puis appelle
  `ctx.reload()` en TUI pour invalider le cache Markdown et redessiner le
  transcript.
- `/json open [n]` : ouvre le n-ième JSON le plus récent, avec `1` par défaut,
  dans l'éditeur multi-lignes Pi. **Ctrl+G** y ouvre `$EDITOR`.
- Un clic sur `ouvrir ⤢` ou `⤢ +N lignes · tout voir` ouvre le fichier via le
  handler `file://` de l'OS.

Le parseur de commande n'accepte que des entiers positifs complets : `2suffix`,
`0`, les arguments excédentaires et les entiers non sûrs sont rejetés.

## Persistance

- `$TMPDIR/pi-json-view/<hash>.json` — un fichier par contenu (une écriture,
  ensuite réutilisé) ; c'est la cible des liens cliquables et de `/json open`.
- `$TMPDIR/pi-json-view/index.json` — historique borné à 100 blobs. Nécessaire
  car `ctx.reload()` réimporte les extensions (`moduleCache: false`) : le registre
  en mémoire est vidé à chaque reload et relu depuis l'index.

## Limites connues

1. `ctrl+o` reste non-live pour ces blocs markdown ; seul `/json` force le
   redessin via reload.
2. Le reload réinitialise brièvement les autres extensions avant leur
   réenregistrement. Une invalidation ciblée du cache Markdown devrait être
   ajoutée upstream.
3. Les résultats d'outils ne passent pas par `registerMarkdownTransformer`.
4. Le clic utilise le handler OS, pas nvim directement.
5. Le JSON inline court, le JSON non strict et les constructions Markdown non
   conformes ne sont pas reformatés.
