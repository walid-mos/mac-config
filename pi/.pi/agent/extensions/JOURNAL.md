# Journal — extensions TUI

Journal de développement des extensions Pi de ce dépôt (branche `feat/tui-nice-to-haves`
et successeurs) : `compact-tools`, `edit-view`, `background`, `ui/frame`, `footer`,
`working-loader`, `json-view`, `double-escape`, `session-shortcuts`, `pi-notify`.

## Règles du journal

- Une entrée par action terminée : feature, fix, refactor, décision de conception,
  résultat de test, changement de direction. Pas d'entrée pour une action avortée
  sans effet (mentionner uniquement si elle a enseigné quelque chose).
- Entrées Strictement chronologiques, ajoutées en fin de section `Entrées`.
- Ne jamais réécrire ni supprimer une entrée passée : corriger par une entrée
  nouvelle qui référence la précédente.
- Une entrée tient en 3 à 6 puces. Pas de narration.

## Format d'entrée

```markdown
### AAAA-MM-JJ — sujet court
- Fait : ce qui a été livré ou décidé.
- Fichiers : chemins touchés (relatifs à `extensions/`).
- Tests : ce qui a été exécuté et le résultat (`make pi-test`, esbuild, …).
- Suite : la prochaine étape, ou « — ».
```

## Entrées

### 2026-08-30 — initialisation du journal
- Fait : création de ce journal + `AGENTS.md` de développement ; état de la branche consigné.
- Fichiers : `JOURNAL.md`, `AGENTS.md`.
- Tests : sans objet (documentation).
- Suite : première entrée de travail réel.
- État repris : derniers commits de la branche — edit-view en cadre de diffs par
  édition (68ec5438), tool background en row compacte (f882d237), sujets/résumés
  compacts (5c0948f2), extraction des primitives de cadre partagées `ui/frame`
  (14074adf), transcript compact pour tools self-rendered (2b0e1b3a).

### 2026-08-30 — indicateur de raisonnement dans le working-loader
- Fait : le loader bascule entre `✻ <mot>...` (travail, dim) et `✽ <mot>...`
  (raisonnement, accent) piloté par les events `message_update`
  (`thinking_start/delta` ↔ `text_start/toolcall_start`, reset sur
  `message_end`) ; vocabulaire dédié `THINKING_WORDS`, repaint immédiat au
  basculement sans attendre le tick de rotation.
- Fichiers : `working-loader/index.ts`, `working-loader/words.ts`,
  `tests/working-loader.test.ts`.
- Tests : `make pi-test` complet au vert ; esbuild index/words.
- Suite : —

### 2026-08-30 — déploiement Stow basculé sur le worktree
- Fait : `~/.pi/agent` pointait sur `~/.stow_repository` (checkout principal) —
  edit-view, thème mantle et compact-tools absents du déploiement ; anciens
  symlinks retirés puis `make pi` rejoué depuis le worktree ; `settings.json`
  runtime (defaultModel, hideThinkingBlock) adopté dans le worktree avant le
  bascule pour ne rien perdre.
- Fichiers : hors extensions (déploiement Stow, `pi/.pi/agent/settings.json`).
- Tests : `scripts/test-pi-startup.py` au vert après déploiement.
- Suite : ne pas oublier de rebasculer le stow sur le checkout principal en
  fin de vie de la branche.

### 2026-08-30 — marqueur de raisonnement à droite du loader (retour utilisateur)
- Fait : le basculement de glyph/couleur/vocabulaire du loader est reverté au
  profit d'un marqueur `✽ raisonnement` (accent) aligné à l'extrême droite de
  la ligne du loader pendant le streaming de thinking ; à gauche, les mots de
  travail `✻` tournent inchangés ; marqueur retiré hors raisonnement et tombé
  sur largeur insuffisante ; `THINKING_WORDS` supprimé (inutilisé).
- Fichiers : `working-loader/index.ts`, `working-loader/words.ts`,
  `tests/working-loader.test.ts`.
- Tests : node --test working-loader 12/12 ; esbuild index.
- Suite : —

### 2026-08-30 — incident : /reload pendant une fenêtre d'édition incohérente
- Fait : diagnostic du « loader crashé » chez l'utilisateur — en réalité, le
  /reload est tombé sur `words.ts` pendant qu'il contenait un double import
  (fenêtre de quelques minutes entre deux edits, corrigée juste après) ;
  l'extension échouait au chargement, d'où loader et marqueur absents.
- Fichiers : sans changement de code — repro avec le vrai thème pi
  (`initTheme` + surfaceRegistry) : `✻ mot...` + `✽ raisonnement` rendus à
  toutes les largeurs.
- Tests : repro node (wl-real3) au vert ; suite working-loader 12/12.
- Suite : leçon — ne jamais /reload pendant une série d'edits en cours ;
  attendre le vert de la gate.

### 2026-08-30 — fix : registre surface réellement global entre extensions
- Fait : diagnostic du pop/dépop du loader pendant les runs avec jobs
  background — pi charge chaque extension via un jiti frais (`moduleCache:
  false`), donc le singleton de module `surfaceRegistry` était dupliqué ; les
  registres isolés montaient le même host `ordered-above-editor` et
  s'évinçaient, d'où l'alternance loader ↔ `◆ BACKGROUND` capturée sous tmux.
  Fix définitif : registre et bindings du host stockés sur `globalThis` via des
  `Symbol.for(...)` process-globaux ; toutes les extensions partagent le même
  registre, le même host et l'ordre global des priorités.
- Fichiers : `ui/surface.ts`, `ui/ordered-widget-stack.ts`, `ui/README.md`,
  `AGENTS.md`, `tests/ordered-widget-stack.test.ts`,
  `tests/ui-registry-policy.test.ts`.
- Tests : deux imports isolés partagent le même objet registre et montent un
  seul host ; politique `setWidget`/`setFooter` ; `make pi-ui-test` 16/16 ;
  repro tmux réel — loader + background simultanés pendant les deux runs
  (shots 012–021 et 035–043), loader absent uniquement lorsque l'agent est
  idle ; `make pi-test` complet au vert.
- Suite : —

### 2026-08-30 — retrait des patchers d’artefacts générés
- Fait : suppression des trois patchers qui réécrivaient les distributions
  installées de Pi (`tool-execution`, thinking assistant, historique prompt),
  de leurs tests et de leur exécution automatique par `pi-post` ; les commits
  de branche dédiés à ces patchers ont été retirés de l’historique.
- Fichiers : hors extensions (`scripts/pi-patch-*.py`, tests associés, `Makefile`).
- Tests : `make pi-test` complet au vert.
- Suite : remplacer l’espacement compact par une composition d’extension et
  harmoniser le rendu de `write` avec `edit`.

### 2026-08-30 — pile compacte sans modification du runtime Pi
- Fait : les calls consécutifs `read`/`grep`/`find`/`ls`/`bash`/`background`
  partagent désormais un composant visible unique ; les composants précédents
  rendent zéro ligne, la dernière row compose la pile avec retrait et fondu
  `dim`/`muted`, supprimant les spacers intermédiaires imposés par Pi.
- Fichiers : `compact-tools/{stack,lifecycle,line,renderer,types}.ts`,
  `compact-tools.ts`, `compact-tools/README.md`, test compact-tools.
- Tests : compact-tools 25/25, esbuild de l’entrypoint, `make pi-test` complet
  au vert.
- Suite : harmoniser le rendu de `write` avec `edit`.

### 2026-08-30 — extraction du cadre de mutation partagé
- Fait : la composition visuelle du cadre `edit` (titre, rows de diff,
  plafonnement, fondu et pied) devient une primitive `mutation-view` neutre,
  sans changement de rendu, afin d’accueillir `write` sans duplication.
- Fichiers : `mutation-view/frame.ts`, `edit-view/frame.ts`,
  `edit-view/README.md`.
- Tests : edit-view 10/10, esbuild de l’entrypoint edit-view.
- Suite : brancher le renderer `write` sur cette primitive.
