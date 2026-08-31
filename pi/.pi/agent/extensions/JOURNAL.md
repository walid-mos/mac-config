# Journal — extensions TUI

Journal de développement des extensions Pi de ce dépôt (branche `feat/tui-nice-to-haves`
et successeurs) : `compact-tools`, `mutation-view`, `background`, `ui/frame`, `footer`,
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

### 2026-08-30 — write et edit partagent le même langage visuel

- Fait : `write` possède désormais une row compacte pending/erreur puis un
  cadre de création au succès, identique au cadre `edit` ; les lignes sont des
  ajouts, plafonnées et estompées, tandis que `ctrl+o` restaure le `renderCall`
  natif et sa coloration syntaxique sans perdre le composant compact.
- Fichiers : `write-view/{index,body,component,frame}.ts`, README write-view,
  `compact-tools/{renderer,summary}.ts`, tests write/compact et docs compact.
- Tests : write-view 7/7, compact-tools + edit-view 35/35, esbuild write-view,
  `make pi-test` complet au vert.
- Suite : ajouter ces suites de rendu à la gate `pi-ui-test`.

### 2026-08-30 — gate UI couvre les renderers de tools

- Fait : `pi-ui-test` exécute maintenant systématiquement les suites
  compact-tools, edit-view et write-view avec les autres surfaces TUI.
- Fichiers : hors extensions (`Makefile`), `JOURNAL.md`.
- Tests : `make pi-ui-test` au vert, 58/58.
- Suite : validation visuelle dans un vrai transcript Pi.

### 2026-08-30 — erreurs de tool lues depuis le contexte renderer

- Fait : le renderer compact normalise `context.isError`, source réellement
  fournie par `ToolExecutionComponent`, dans le résultat avant de choisir
  glyphe, résumé et corps ; edit/write n’affichent donc jamais un cadre de
  succès lorsqu’une exécution a échoué.
- Fichiers : `compact-tools/{renderer,types}.ts`, test compact-tools.
- Tests : renderers compact/edit/write 43/43, esbuild compact-tools/write-view.
- Suite : validation visuelle dans un vrai transcript Pi.

### 2026-08-30 — inscription dynamique des tools empilables

- Fait : suppression de l’allowlist de noms dans la pile compacte ; tout tool
  utilisant `createCompactRenderers()` s’inscrit automatiquement, tandis que
  les vues riches déclarent `stackRows: false`. Un tool inconnu/non enregistré
  reste une frontière et conserve son renderer propre, sans fusion incorrecte.
- Fichiers : `compact-tools/{stack,renderer,lifecycle}.ts`, README et tests ;
  options edit/write.
- Tests : renderers compact/edit/write 44/44, esbuild des trois entrypoints.
- Suite : regrouper edit/write dans une seule extension mutation-view.

### 2026-08-30 — extension unique mutation-view

- Fait : fusion des anciennes extensions edit-view et write-view dans un seul
  entrypoint `mutation-view`, propriétaire des deux overrides et de leur design
  commun ; les variantes edit/write restent séparées en modules métier pour
  permettre un futur remplacement visuel sans réorganiser le chargement.
- Fichiers : `mutation-view/{index,frame,diff,edit,write}.ts`, README ; retrait
  des dossiers edit-view/write-view ; renommage des deux suites et gate.
- Tests : renderers 44/44, esbuild mutation-view/compact-tools, `make pi-test`
  complet au vert (pi-ui 60/60).

### 2026-08-30 — fix du reload après évolution de la pile compacte

- Fait : le contrat process-global de `CompactRowStack` passe de `v1` à `v2` ;
  un `/reload` ne réutilise plus l'ancien singleton dépourvu de `registerTool`,
  qui faisait échouer le chargement de mutation-view.
- Fichiers : `compact-tools/stack.ts`, test compact-tools.
- Tests : repro stale-v1 corrigée, compact-tools 28/28, esbuild
  mutation-view/compact-tools et `make pi-test` complet au vert (pi-ui 61/61).
- Suite : —

### 2026-08-30 — hiérarchie visuelle du transcript et des réponses

- Fait : les tools compacts forment une timeline lisible `├─` / `╰─`, stable
  à six calls visibles ; l'historique excédentaire est replié avec conservation
  du nombre d'erreurs, sans l'ancien escalier de rows presque invisibles.
- Fait : nouvelle extension `response-view` — séparateurs thémés `réponse`,
  ouverts pendant le streaming puis fermés au settle, plafonnés à 88 colonnes
  sur les écrans ultra-larges et strictement display-only.
- Fichiers : `compact-tools/{line,stack}.ts`, README compact ;
  `response-view/{index,frame}.ts`, README ; tests compact/response et Makefile.
- Tests : suites ciblées 33/33, esbuild des deux entrypoints, `make pi-ui-test`
  66/66 puis `make pi-test` complet au vert.
- Suite : validation visuelle après `/reload`.

### 2026-08-30 — fix : timeline réellement renouvelée au reload

- Fait : retour visuel utilisateur — les rows restaient dans l'ancien escalier
  après `/reload`, car le singleton `v2` avait déjà été créé avant la refonte ;
  la nouvelle timeline réutilisait donc l'ancienne méthode `render`.
- Fichiers : `compact-tools/stack.ts`, test compact-tools.
- Tests : protocole process-global passé à `v3`, repro stale-v2 couvert ; suites
  ciblées 33/33 et esbuild compact-tools/response-view au vert.
- Suite : `/reload`, puis contrôle sur le prochain groupe de tools.

### 2026-08-30 — suppression du versionnement manuel du reload

- Fait : remise en cause du contournement `row-stack.vN` après retour utilisateur ;
  seule la donnée inerte de la pile est désormais partagée dans `globalThis`,
  tandis que chaque graphe d'extension construit l'implémentation courante.
- Résultat : `/reload` prend automatiquement les nouvelles méthodes, sans bump,
  migration ni ancienne instance de classe conservée.
- Fichiers : `compact-tools/{stack.ts,README.md}`, test compact-tools.
- Tests : état partagé entre deux imports et instances d'implémentation distinctes,
  suites ciblées 33/33, absence de clé `row-stack.vN`, esbuild au vert.
- Suite : double `/reload` puis gate complet.

### 2026-08-30 — validation du reload sans version

- Fait : deux `/reload` consécutifs dans un vrai PTY Pi terminent proprement,
  sans erreur d'extension ni marqueur de largeur.
- Tests : `make pi-test` complet au vert, dont pi-ui 66/66, démarrages offline
  multi-largeurs et filtres Git.
- Suite : contrôle visuel utilisateur sur les prochains tools.

### 2026-08-31 — spinner sand dans le working-loader

- Fait : le glyphe statique `✻` devient l'animation `sand` canonique de
  `cli-spinners` (35 frames à 80 ms), sans changer la rotation des mots ni le
  marqueur de raisonnement aligné à droite.
- Fichiers : `working-loader/{index,rotation,spinner}.ts`, README working-loader,
  test working-loader.
- Tests : working-loader 13/13, esbuild de l'entrypoint et `make pi-test`
  complet au vert (pi-ui 67/67).
- Suite : validation visuelle après `/reload`.

### 2026-08-31 — alignement du loader avec les jobs Background

- Fait : après capture du pane Herdr réel, la row du working-loader reçoit le
  même retrait de deux colonnes que les rows de jobs Background ; le spinner
  et son libellé partagent désormais leur axe visuel avec les autres statuts.
- Fichiers : `working-loader/{index.ts,README.md}`, test working-loader.
- Tests : working-loader 13/13, esbuild de l'entrypoint et `make pi-test`
  complet au vert (pi-ui 67/67).
- Suite : contrôle visuel après `/reload`.

### 2026-08-31 — retour des widgets de premier niveau en colonne 0

- Fait : retour utilisateur sur le retrait précédent — le working-loader est
  un pair de l'en-tête Background, pas une row enfant ; les deux commencent
  donc en colonne 0, tandis que seuls les jobs Background restent indentés.
- Fichiers : `working-loader/{index.ts,README.md}`, test working-loader.
- Tests : working-loader 13/13, esbuild de l'entrypoint et `make pi-test`
  complet au vert (pi-ui 67/67).
- Suite : `/reload`, puis test visuel.

### 2026-08-31 — spinners working et Background sur le même axe

- Fait : clarification après capture Herdr — « les deux loaders » désignait le
  spinner `sand` et le spinner animé de la row de job Background ; retrait des
  deux espaces devant les jobs principaux, enfants de groupe ramenés de six à
  quatre espaces pour conserver leur profondeur relative.
- Fichiers : `background/display.ts`, README working-loader, tests background.
- Tests : suites background-display + working-loader 19/19, esbuild des deux
  entrypoints et `make pi-test` complet au vert (pi-ui 67/67).
- Suite : `/reload`, puis vérification dans le pane réel.

### 2026-08-31 — libellés des deux loaders en colonne 2

- Fait : suppression du second espace entre le spinner d'un job Background et
  son libellé ; working-loader, en-tête Background et jobs Background suivent
  désormais tous le rythme « glyphe colonne 0, libellé colonne 2 ».
- Fichiers : `background/display.ts`, README working-loader, test background.
- Tests : suites background-display + working-loader 19/19, esbuild Background
  et `make pi-test` complet au vert (pi-ui 67/67).
- Suite : `/reload`, puis vérification dans le pane réel.

### 2026-08-31 — aperçu roulant du reasoning

- Fait : le marqueur statique `✽ raisonnement` devient `nf-md-brain` suivi d'un
  extrait roulant des `thinking_delta`, aligné à droite et plafonné à 48
  colonnes ; fallback `raisonnement` avant le premier delta, suppression sur
  largeur étroite et hors reasoning.
- Sécurité/perf : buffer éphémère borné à 8 192 caractères, contrôles terminal
  et décoration Markdown retirés ; le tick `sand` à 80 ms cadence les repaints,
  sans timer ni appel modèle supplémentaire.
- Fichiers : `working-loader/{index,thinking-preview}.ts`, README et test.
- Tests : working-loader 14/14, esbuild de l'entrypoint et `make pi-test`
  complet au vert (pi-ui 68/68).
- Suite : `/reload`, puis validation du glyph et du rolling dans le pane réel.

### 2026-08-31 — aperçu reasoning stable et adaptatif

- Fait : remplacement du plafond fixe de 48 colonnes par une région ancrée à
  droite visant la moitié du terminal, avec un minimum lisible de 32 colonnes
  sous lequel l'aperçu disparaît.
- Stabilité : les deltas restent accumulés en continu ; le placeholder
  `raisonnement` est supprimé au profit d'un premier extrait utile après 800 ms,
  puis de snapshots espacés de 2,5 s et garantis visibles pendant cet intervalle.
  L'aperçu roule sur le dernier bloc sans additionner les summaries antérieurs.
  La sortie différée conserve le dernier extrait et absorbe les transitions
  reasoning/non-reasoning brèves sans effet de clignotement.
- Transcript : working-loader ne touche plus au label natif ; `Ctrl+\`` reste
  exclusivement piloté par Pi.
- Fichiers : `working-loader/{index,thinking-preview}.ts`, README et tests.
- Tests : working-loader 17/17 et pi-ui 71/71.
