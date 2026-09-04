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

### 2026-08-31 — thinking natif compact et discret

- Fait : response-view retire le gras, groupe les summaries Codex par trois
  lignes et ne reformate pas la prose complète. Pi conserve l'italique natif,
  avec `thinkingText` à `surface2`.
- Fichiers : `response-view/`, thème Catppuccin Latte, README et tests.
- Tests : response-view 5/5, esbuild et pi-ui 72/72 ; `make pi-test` complet au
  vert.
- Suite : `/reload`, puis validation visuelle dans le pane réel.

### 2026-08-31 — mutation-view en onglet de fichier ouvert

- Fait : remplacement du cadre fermé edit/write par un en-tête `┌ tool ─ chemin`
  plafonné à 88 colonnes, un rail gauche ouvert et une affordance `ctrl+o` sans
  bordure basse ; edit expose `−n +n`, write `+n lignes` et les éditions
  multiples portent un repère explicite.
- Responsive : chemin complet quand il tient, basename puis retrait des stats
  sur largeur étroite ; contenu toujours borné à 18 lignes avec fin atténuée et
  compteur des lignes masquées.
- Fichiers : `mutation-view/{frame,edit,write}.ts`, README et tests edit/write.
- Tests : suites mutation 17/17, esbuild, `make pi-ui-test` 72/72 et
  `make pi-test` complet au vert.
- Suite : `/reload`, puis retour visuel dans un transcript réel.

### 2026-08-31 — fonds pastel sur le diff edit

- Fait : les suppressions et ajouts edit reçoivent sur toute la largeur du rail
  un fond rouge/vert Catppuccin mélangé à 15 % avec la base Latte ; le contexte
  et write restent sans fond.
- Atténuation : les trois dernières lignes d'un aperçu plafonné diminuent aussi
  le fond (10 %, 6 %, 3 %) ; rendu truecolor et conversion ANSI 256 couleurs.
- Fichiers : `mutation-view/{frame,edit}.ts`, README et test edit.
- Tests : suites mutation 18/18, esbuild et `make pi-test` complet au vert
  (pi-ui 73/73).
- Suite : `/reload`, puis validation de l'intensité dans le transcript réel.

### 2026-08-31 — mutation-view alignée sur la largeur du transcript

- Fait : retour capture utilisateur — suppression du plafond arbitraire de 88
  colonnes ; en-tête, rail et fonds edit/write consomment désormais toute la
  largeur réellement fournie au renderer, comme le texte normal d'un output.
- Fichiers : `mutation-view/frame.ts`, README et tests edit/write.
- Suite : `/reload`, puis validation de l'alignement sur le même terminal.

### 2026-08-31 — largeur naturelle, numéros de ligne et wrap

- Fait : correction du plein écran jugé trop large — mesure adaptative entre 56
  et 112 colonnes selon le contenu ; edit consomme le diff natif numéroté de Pi
  et write numérote ses lignes dès 1.
- Wrap : les lignes longues sont découpées sans ellipsis, avec gouttière vide
  sur les continuations et fond pastel répété sur chaque segment visuel.
- Fichiers : `mutation-view/{frame,diff,edit,write}.ts`, README et tests.
- Tests : suites mutation 20/20, esbuild et `make pi-ui-test` 82/82 au vert ;
  gate complète toujours bloquée uniquement par le timeout de shutdown
  Background déjà consigné, fixture `sleep 120` supprimée.
- Suite : `/reload`, puis validation visuelle de la mesure et du wrap.

### 2026-08-31 — pleine largeur avec marge de gouttière

- Fait : retour capture utilisateur — abandon de la largeur naturelle ; le bloc
  prend la largeur du transcript moins une marge droite égale à `signe + numéro
    - séparateur`, tout en conservant numéros et wrap.
- Fix : le fond pastel en escalier venait du trim des espaces terminaux par Pi ;
  le padding coloré emploie désormais des espaces insécables, garantissant un
  rectangle stable jusqu'à la marge.
- Fichiers : `mutation-view/frame.ts`, README et tests edit/write.
- Tests : suites mutation 20/20, esbuild et `make pi-ui-test` 82/82 au vert ;
  gate complète toujours bloquée par le timeout de shutdown Background hors
  périmètre, fixture `sleep 120` supprimée.
- Suite : `/reload`, puis contrôle visuel du bord droit des fonds.

### 2026-08-31 — ctrl+o rétabli pour edit

- Diagnostic : `ctrl+o` est le toggle global `app.tools.expand`, pas une action
  propre à mutation-view. Le natif Pi affiche le diff edit principalement dans
  `renderCall`, alors que l'override ne lui rendait que `renderResult`.
- Fix : edit délègue maintenant aussi son call natif en vue étendue, comme write.
- Fichiers : `mutation-view/index.ts`, README et test edit.
- Tests : suites mutation 20/20 et esbuild au vert.

### 2026-08-31 — raccourci global d'expansion remis sur ctrl+o

- Diagnostic : le code edit/write était correct après le fix précédent, mais la
  configuration active surchargeait `app.tools.expand` avec `ctrl+shift+\`` ;
le hint `ctrl+o` ne pouvait donc pas agir.
- Fix : `keybindings.json` lie explicitement `app.tools.expand` à `ctrl+o`, qui
  reste le raccourci global d'expansion des tools.
- Validation : JSON de configuration parsé avec succès ; `/reload` requis.

### 2026-08-31 — actions clavier préservées par double-escape

- Diagnostic final : le décorateur d'éditeur `double-escape` masquait la surface
  `actionHandlers` de `CustomEditor`. Pi ne pouvait donc pas lui injecter les
  actions applicatives (`app.tools.expand`, modèles, thinking, etc.), quel que
  soit le raccourci configuré.
- Fix : le wrapper expose et relaie les handlers/callbacks du CustomEditor sous-
  jacent, mais n'interprète lui-même que `app.interrupt` pour le double Escape.
  Un éditeur incompatible échoue explicitement au lieu de dupliquer tout le
  routage clavier de Pi.
- Tests : double-escape 9/9 et esbuild au vert, dont régression ctrl+o via la
  surface CustomEditor et refus explicite d'une base incompatible.

### 2026-08-31 — expansion mutation sans rupture visuelle

- Retour : la vue native activée par `ctrl+o` supprimait toute la DA propre des
  blocs `edit`/`write`.
- Fix : la vue étendue conserve le renderer mutation et révèle toutes les lignes
  au lieu de déléguer `renderCall`/`renderResult` au renderer natif.
- Le mode replié garde sa limite de 18 lignes ; le footer étendu indique
  `ctrl+o · replier`.

### 2026-08-31 — registre unique des tool views

- Ajout de `compact-tools/registry.ts`, source de vérité exhaustive pour le
  propriétaire, la stack, le masquage après succès et la stratégie d'expansion
  de chaque tool utilisant la row partagée.
- `createCompactRenderers()` applique et valide cette politique ; les extensions
  propriétaires ne passent plus de flags parallèles susceptibles de diverger.
- `edit` et `write` sont enregistrés par une factory mutation commune au lieu de
  deux branches quasi identiques.
- Fallow : `audit --base 78ea48f` au vert et aucun clone proche sur le diff
  (`dupes --near --changed-since`) ; avertissement attendu sur l'absence de
  `node_modules` à la racine de ce dépôt de dotfiles.

### 2026-08-31 — invariants tool views persistés pour les agents

- Ajout dans `extensions/AGENTS.md` des règles imposant le registre unique,
  l'absence de listes/flags parallèles, la factory commune pour tools homologues
  et la conservation de la DA en expansion custom.
- Le gate Fallow structurel est désormais explicitement requis après toute
  modification de l'architecture des tool views.

### 2026-08-31 — barre de lecture forte pour les réponses

- Fait : la réponse assistant s'ouvre par une barre Catppuccin contrastée avec
  diamant accentué, label `RÉPONSE` et fermeture discrète ; le Markdown reste
  intact, le streaming reste ouvert et les faibles largeurs passent en compact.
- Fichiers : `response-view/{frame,index}.ts`, README et test response-view.
- Tests : response-view 6/6, esbuild et `make pi-ui-test` 85/85 au vert ; contrôle
  ANSI avec le vrai thème Latte à 88/52/12 colonnes. Gate complète bloquée par
  le timeout de shutdown Background déjà consigné ; fixture `sleep 120` supprimée.
- Suite : `/reload`, puis validation dans le transcript réel.

### 2026-08-31 — réponse Powerline asymétrique (retour utilisateur)

- Direction : abandon du cadre teinté, jugé trop proche du modèle précédent, au
  profit d'un cartouche Powerline inversé et d'une fermeture déportée à droite.
- Fait : diamant + capsule concentrent l'accent, la trace chaud→muted donne le
  mouvement et l'espace négatif délimite le Markdown sans fond ni rails.
- Fichiers : `response-view/{frame,index}.ts`, README et test response-view.
- Tests : response-view 6/6, esbuild, contrôle Latte à 88/52/16/12 colonnes et
  `make pi-ui-test` 85/85 au vert.
- Suite : `/reload`, puis validation dans le transcript réel.

### 2026-09-01 — trace Powerline atténuée et réponses sans fences text

- Retour capture : la transition violette vers muted ressemblait à une progress
  bar abrupte ; la capsule conserve seule l'accent, suivie d'une trace courte
  entièrement muted `╺━━┅┄╴` et d'un sign-off allégé `╶┄ ◇`.
- Harness : règle globale ajoutée pour réserver les blocs fenced au contenu dont
  la mise en forme littérale est nécessaire, jamais à la prose ou aux mockups TUI.
- Fichiers : `response-view/frame.ts`, README, `../AGENTS.md` et test response-view.
- Tests : response-view 6/6, esbuild, config Pi, contrôle Latte réel et
  `make pi-ui-test` 85/85 au vert ; gate complète bloquée par le timeout de
  shutdown Background connu après 70/70 tests, fixtures absentes.
- Suite : `/reload` pour l'extension ; nouvelle session pour la règle AGENTS.

### 2026-09-01 — trait restauré, pill Powerline supprimé

- Clarification utilisateur : le trait pleine largeur était la partie réussie ;
  le cartouche inversé ` RÉPONSE ` portait l'excès de contraste.
- Fait : retour du trait accent→muted intégral, précédé d'un diamant et d'un label
  texte simples ; fermeture légère `╶┄ ◇` conservée.
- Fichiers : `response-view/{frame,index}.ts`, README et test response-view.
- Tests : response-view 6/6, esbuild, contrôle Latte réel et `make pi-ui-test`
  85/85 au vert ; gate complète bloquée par le timeout Background connu après
  70/70 tests, fixtures absentes.
- Suite : `/reload`, puis validation visuelle.

### 2026-09-01 — gradient continu et fermeture renforcée

- Fait : remplacement de la marche accent/muted par une interpolation smoothstep
  sur 18 cellules, dérivée des couleurs du thème actif sans palette dupliquée.
- Terminal : rendu truecolor natif, quantification ANSI 256 et fallback sémantique
  lorsque le thème n'expose pas ses séquences ; largeur visible inchangée.
- Fermeture : diamant creux `◇` conservé, rail muted renforcé en `╶━━━━━━`.
- Fichiers : `response-view/frame.ts`, README et test response-view.
- Tests : response-view 8/8, esbuild, contrôle Latte réel et `make pi-ui-test`
  87/87 au vert ; gate complète bloquée par le timeout Background connu après
  70/70 tests, fixtures absentes.
- Suite : `/reload`, puis validation visuelle.

### 2026-09-01 — onde fade-in / fade-out ample

- Retour : le simple accent→muted restait trop timide malgré l'interpolation.
- Fait : onde smoothstep étendue à 52 cellules — départ muted, montée mauve,
  plateau saturé de 16 % de la courbe, puis extinction longue vers muted.
- Fallback : même hiérarchie muted/accent/muted sans dépendre du truecolor.
- Fichiers : `response-view/frame.ts`, README et test response-view.
- Tests : response-view 8/8, esbuild, contrôle Latte réel et `make pi-ui-test`
  87/87 au vert ; gate complète bloquée par le timeout Background connu après
  70/70 tests, fixtures absentes.
- Suite : `/reload`, puis validation visuelle.

### 2026-09-01 — fades géométriques aux extrémités, sans fallback

- Correction du retour précédent : fade-out demandé à l'extrémité droite du
  trait supérieur, fade-in au départ gauche du rail de fermeture — pas une onde
  chromatique au milieu.
- Fait : couleur supérieure accent→muted sur 24 cellules puis matière
  `━→┅→┄→╴` ; fermeture `╶→┄→┅→━` suivie d'un rail lourd et du `◇`.
- Contrat : suppression du thème partiel et du fallback muted/accent/muted ; le
  renderer exige `getFgAnsi()` et `getColorMode()` du thème Pi actif.
- Fichiers : `response-view/{frame,index}.ts`, README et test response-view.
- Tests : response-view 8/8, esbuild, contrôle Latte réel et `make pi-ui-test`
  87/87 au vert ; gate complète bloquée par le timeout Background connu après
  70/70 tests, fixtures absentes.
- Suite : `/reload`, puis validation visuelle.

### 2026-09-01 — opacité chromatique, ponctuation minimale

- Retour : la succession de glyphes donnait encore un effet coupé au hachoir ;
  conserver quelques points, mais porter le fade par couleur et opacité.
- Fait : 16 cellules smoothstep `muted→dim` sur le trait lourd, terminées par
  `┈┈·` puis une cellule invisible ; fermeture symétrique `dim→muted`.
- Le rendu n'alterne plus entre traits lourds, légers et hachés : les points ne
  sont qu'une ponctuation finale, l'extinction est chromatique.
- Fichiers : `response-view/frame.ts`, README et test response-view.
- Tests : response-view 8/8, esbuild, contrôle Latte réel et `make pi-ui-test`
  87/87 au vert ; gate complète bloquée par le timeout Background connu après
  70/70 tests, fixtures absentes.
- Suite : `/reload`, puis validation visuelle.

### 2026-09-01 — fade jusqu'au canvas réellement visible

- Diagnostic : `muted→dim` ne variait que de 16 niveaux RGB sur Latte ; le code
  interpolait, mais l'amplitude était trop faible pour produire une opacité
  perceptible.
- Fait : cible remplacée par `userMessageBg`, teinte de fond proche du canvas ;
  Latte couvre désormais `#8c8fa1→#e6e9ef` sur 16 tons smoothstep.
- Fermeture : courbe exactement inverse depuis le fond vers `muted` ; `┈┈·`
  reste la seule ponctuation de densité.
- Contrat : ajout de `getBgAnsi()` au thème requis, toujours sans fallback.
- Fichiers : `response-view/frame.ts`, README et test response-view.
- Tests : response-view 8/8, esbuild, contrôle Latte réel et `make pi-ui-test`
  87/87 au vert.
- Suite : `/reload`, puis validation visuelle.

### 2026-09-01 — largeur mutation et fade proportionnel heavy

- Retour : les points fins rompaient la graisse du rail ; les traits réponse
  devaient rejoindre la même gouttière droite que les surfaces edit/write.
- Fait : suppression du plafond 88, largeur `terminal−8`, fades dimensionnés à
  34 % du trait avec minimum 16 cellules sur ouverture et fermeture.
- Typographie : remplacement de `┈┈·` par `┉┉`, pointillés heavy assortis à `━` ;
  aucune alternance d'épaisseur, disparition finale portée par la couleur.
- Fichiers : `response-view/frame.ts`, README et test response-view.
- Tests : response-view 8/8, esbuild, contrôle 120 colonnes et
  `make pi-ui-test` 87/87 au vert.
- Suite : `/reload`, puis validation visuelle.

### 2026-09-01 — rails light homogènes

- Retour : la graisse heavy uniforme restait trop invasive sur les nouvelles
  règles presque pleine largeur.
- Fait : bascule atomique du jeu heavy `╺━┉` vers le jeu light `╶─┈`, sur
  l'ouverture comme la fermeture ; aucune épaisseur mixte.
- Inchangés : largeur `terminal−8`, fade 34 %, interpolation vers le canvas,
  diamant et comportement streaming.
- Fichiers : `response-view/frame.ts`, README et test response-view.
- Tests : response-view 8/8, esbuild, contrôle 120 colonnes et
  `make pi-ui-test` 87/87 au vert.
- Suite : `/reload`, puis validation visuelle.

### 2026-09-01 — filigrane unique, fermeture supprimée

- Retour : déplacer le diamant creux en ouverture et retirer complètement le
  trait inférieur pour alléger la surface.
- Fait : `◆` devient `◇` en tête ; suppression du rail final, de son fade-in,
  de `responseBottomRule()` et de la branche streaming/final devenue inutile.
- Inchangés : rail supérieur light, largeur `terminal−8`, fade 34 % vers le
  canvas, label simple et contenu Markdown intact.
- Fichiers : `response-view/{frame,index}.ts`, README et test response-view.
- Tests : response-view 8/8, esbuild, contrôle Latte 120 colonnes et
  `make pi-ui-test` 87/87 au vert.
- Suite : `/reload`, puis validation visuelle.

### 2026-09-01 — frontières textuelles multiples dans les tool stacks

- Fix : chaque bloc texte visible coupe maintenant la pile compacte restaurée
  ou streamée ; le suivi par compteur évite de retraiter les deltas déjà vus.
- Fichiers : `compact-tools/stack.ts`, test compact-tools.
- Tests : compact-tools 31/31 et esbuild de l'entrypoint au vert.
- Suite : —

### 2026-09-01 — loader continu pendant les retries automatiques

- Fix : le working-loader se retire sur `agent_settled`, pas sur `agent_end`,
  afin de rester stable pendant retry, compaction automatique et follow-up.
- Fichiers : `working-loader/{index.ts,README.md}`, test working-loader.
- Tests : working-loader 18/18 et esbuild de l'entrypoint au vert.
- Suite : —

### 2026-09-01 — complexité mutation répartie par responsabilité

- Refactor : le wrap de glyphes, la gouttière, le rôle et le fond d'une ligne
  de diff sont isolés ; `diffRow` ne combine plus six décisions hétérogènes.
- Fichier : `mutation-view/frame.ts`.
- Tests : mutation-view 21/21, esbuild et Fallow avec couverture au vert.
- Suite : —

### 2026-09-01 — validation d'état compact déclarative

- Refactor : la validation du store process-global compose des prédicats ciblés
  au lieu d'une chaîne booléenne cyclomatique.
- Fichier : `compact-tools/stack.ts`.
- Tests : compact-tools 31/31, esbuild et Fallow avec couverture au vert.
- Suite : —

### 2026-09-01 — transitions thinking simplifiées

- Refactor : les décisions de sortie, de tick, de clipping et de dispatch du
  stream sont réparties en helpers testables et à responsabilité unique.
- Fichiers : `working-loader/{index,thinking-preview}.ts`.
- Tests : working-loader 18/18, esbuild et Fallow avec couverture au vert.
- Suite : —

### 2026-09-01 — format NextNode appliqué au périmètre revu

- Maintenance : Oxfmt a normalisé les sources, tests et documents modifiés
  depuis la précédente review avec la configuration NextNode externe.
- Contrat : aucun fichier de configuration Oxfmt, Oxlint ou Fallow n'est ajouté
  au dépôt.
- Tests : contrôle Oxfmt 38/38 et `make pi-ui-test` 92/92 au vert.
- Suite : —

### 2026-09-01 — copies de groupes compacts sans spread

- Optimisation : les snapshots de groupes utilisent `Array.from` plutôt qu'un
  spread dans `map`, et l'import de type devenu mort est supprimé.
- Fichiers : `compact-tools/{stack,overrides}.ts`.
- Tests : compact-tools 31/31 et Oxfmt au vert ; alertes Oxlint ciblées supprimées.
- Suite : —

### 2026-09-01 — langage compact exhaustif pour l’accès web

- Fait : `web_search`, `source_check`, `fetch_content` et `get_search_content`
  partagent désormais une row mono-ligne pending/succès/erreur ; les messages
  asynchrones content-ready, erreur de fetch et résultats curator suivent le
  même langage, avec contenu riche conservé en expansion.
- Architecture : helper de rendu unique ajouté au patch pnpm de
  `pi-web-access` ; statut, troncature et shell ne sont plus dupliqués entre
  les tools web. Les patches unifiés sont exclus du contrôle whitespace Git.
- Fichiers : hors extensions (`npm-patches/pi-web-access.patch`, test
  pi-web-render, `Makefile`, `.gitattributes`).
- Tests : pi-web-render 3/3 et esbuild des deux entrypoints au vert ; pi-ui et
  startup bloqués par le refactor concurrent footer/design-system incomplet
  (`LATTE`/palette absents), hors périmètre web ; Fallow indisponible dans le
  PATH de ce worktree.
- Suite : `/reload` après stabilisation du refactor footer concurrent.

### 2026-09-01 — format NextNode remis à niveau après la branche web

- Maintenance : Oxfmt 0.65.0 a normalisé les sources et tests modifiés avec le
  profil NextNode (tabs, sans points-virgules, quotes simples, imports triés).
- Fichiers : sources/tests TUI modifiés depuis la précédente passe et nouveau
  décorateur `top-line` encore hors commit.
- Tests : contrôle Oxfmt ciblé au vert ; gate Pi complète à relancer.
- Suite : audit et corrections P0-P2.

### 2026-09-01 — design system Pi centralisé

- Architecture : la palette Catppuccin et les conversions terminal vivent
  désormais sous `ui/design-system` ; footer, JSON, mutation et response-view
  ne dépendent plus d’un module visuel voisin et partagent les mêmes primitives
  RGB, blend et ANSI 256.
- Correctif : les tokens `base` et `surface1` suivent leurs valeurs canoniques
  du thème, avec un test de dérive entre le JSON Pi et la palette TypeScript.
- Tests : assertions palette/RGB/ANSI, Oxlint ciblé et gate Pi complète au vert
  (166 tests UI).
- Suite : étendre la gate UI aux suites actuellement orphelines.

### 2026-09-01 — réponse web préservée hors curation

- Correctif : le rendu étendu non-curated partage désormais le renderer de
  détails de requête avec la branche curated ; réponse synthétisée, erreur et
  sources restent toutes visibles.
- Tests : le helper est extrait du patch versionné et bundlé en isolation ; une
  régression couvre explicitement réponse + source. Application directe et
  inverse du patch vérifiées, 167 tests UI au vert.
- Suite : harmoniser l’état partiel des rows compactes avant la review finale.

### 2026-09-01 — statut compact partiel fiable

- Correctif : un `renderResult` partiel conserve désormais la row en état
  pending ; seul le résultat terminal publie le succès et fige `endedAt`.
- Tests : cycle partiel puis final verrouillé dans la suite compact-tools ;
  Oxfmt, Oxlint strict et 32 tests ciblés au vert.
- Suite : réduire la complexité des extracteurs de sujets et résumés.

### 2026-09-01 — dispatch compact simplifié

- Refactor : `subjectFor` et `summarizeResult` délèguent à des extracteurs
  spécialisés par tool ; les signatures internes n’emploient plus de `any` ni
  d’argument inutilisé.
- Qualité : les deux findings Fallow de `compact-tools/summary.ts` disparaissent
  ; 32 tests ciblés, Oxfmt et Oxlint strict au vert.
- Suite : simplifier le parsing de la forme canonique des éditions.

### 2026-09-01 — arguments edit canoniques

- Refactor : mutation-view valide exclusivement `path` + `edits[]`, avec des
  chaînes strictes pour chaque remplacement ; les aliases et sérialisations
  historiques ne sont plus interprétés.
- Qualité : le dernier finding de complexité introduit disparaît de Fallow ;
  14 tests mutation ciblés et lint source au vert.
- Suite : éliminer la duplication structurelle des décorateurs d’éditeur.

### 2026-09-01 — composition des décorateurs d’éditeur

- Architecture : l’installation idempotente des décorateurs vit dans
  `ui/editor-decorator.ts` ; des métadonnées suivent toute la chaîne de
  factories afin d’éviter un nouvel emballage à chaque `session_start`.
- Qualité : les trois clones Fallow disparaissent sans modifier ni absorber le
  décorateur `top-line` local ; 169 tests UI au vert.
- Suite : borner le marqueur de troncature des surfaces étroites.

### 2026-09-01 — surfaces étroites bornées

- Correctif : le marqueur ajouté après une surface plafonnée passe par la même
  troncature ANSI-safe que chaque ligne de contenu ; aucune row ne dépasse plus
  la largeur annoncée.
- Qualité : le tri local utilise `toSorted` ; 8 tests surface et Oxlint strict
  au vert.
- Suite : versionner les configurations NextNode des trois outils de qualité.

### 2026-09-01 — format NextNode étendu au harness Pi

- Style : Oxfmt couvre désormais les 148 sources et tests TypeScript suivis du
  harness, y compris background, footer, sessions et leurs suites jusque-là
  hors de la première passe.
- Tests : gate Pi complète au vert après normalisation (70 background,
  19 notifications, 169 UI, Stow/startup, largeurs et filtres Git).
- Suite : activer les configurations versionnées Oxfmt, Oxlint et Fallow.

### 2026-09-01 — transformations de tableaux immuables

- Refactor : le tail de thinking et ses assertions utilisent `toReversed` et
  `toSorted`, sans mutation intermédiaire ; le contrôle du registre UI trie de
  la même manière.
- Tests : 19 tests working-loader/registre et Oxlint ciblé au vert.
- Suite : typer les frontières encore exposées en `any`.

### 2026-09-01 — frontières Pi typées

- Refactor : pi-notify reçoit désormais `ExtensionAPI`/`ExtensionContext` et
  laisse les handlers d’événements inférer leurs payloads ; mutation-view ne
  force plus de génériques `any` sur sa définition de tool.
- Tests : harness notification typé, narrowing corrigé sur l’appel Herdr ;
  40 tests notifications/mutations et Oxlint ciblé au vert.
- Suite : corriger les derniers diagnostics Oxlint structurels.

### 2026-09-01 — diagnostics Oxlint résolus

- Qualité : suppression d’un générique fantôme, conservation de la cause de
  config invalide, collections immuables explicites et attente directe du Set
  d’opérations d’artefacts.
- Tests : 70 tests background, 169 tests UI et analyse Oxlint complète au vert.
- Suite : extraire la dernière duplication Fallow introduite.

### 2026-09-01 — actions Activity factorisées

- Refactor : les footers liste/détail d’Activity décrivent leurs actions dans
  une structure commune ; séparateurs, rôles et labels ont un renderer unique.
- Qualité : zéro complexité ou duplication introduite selon Fallow ; 70 tests
  background et Oxlint ciblé au vert.
- Suite : rendre la gate de qualité reproductible depuis le Makefile.

### 2026-09-01 — gate qualité Pi versionnée

- Tooling : configurations locales Oxfmt 0.65.0, Oxlint 1.80.0 et Fallow
  3.21.0 ; `pi-quality-test` les exécute avant la gate fonctionnelle avec une
  base surchargeable par `FALLOW_BASE_REF`.
- Politique : cyclomatique/cognitive restent bornées à 15 ; CRAP est neutralisé
  faute de couverture instrumentée. Les findings hérités restent visibles mais
  seuls les écarts introduits bloquent.
- Qualité : zéro dead code, complexité ou duplication introduite ; suppression
  d’une directive Fallow devenue obsolète.
- Suite : corriger la course des notifications de fin concurrentes.

### 2026-09-01 — notifications obsolètes annulées

- Correctif : chaque sonde de focus porte une génération ; un nouveau run ou
  une notification plus récente invalide la résolution asynchrone précédente,
  qui ne peut plus remplacer le toast courant.
- Tests : une fin lente suivie d’un nouveau run reste silencieuse, puis la fin
  courante est bien livrée ; 20 tests pi-notify et Oxlint au vert.
- Suite : retirer les derniers aliases d’arguments historiques des mutations.

### 2026-09-01 — arguments write canoniques

- Refactor : mutation-view accepte uniquement un `path` non vide et un
  `content` string ; l’alias historique `file_path` et les coercitions sont
  supprimés.
- Tests : cas invalides explicites, 7 tests write et Oxlint ciblé au vert.

### 2026-09-01 — responsabilités pi-notify séparées

- Refactor : la façade `pi-notify.ts` ne fait plus que composer quatre modules :
  processus best-effort, sonde Herdr, publication/queues et hooks Pi.
- Architecture : chaque module a désormais une seule raison de changer ; les
  exports publics et le comportement restent identiques.
- Tests : 20 tests notifications et Oxlint ciblé au vert.
- Suite : séparer l’état, l’analyse de transcript et le rendu compact stack.

### 2026-09-01 — compact stack composée

- Refactor : `CompactRowStack` devient un coordinateur fin ; état process-global,
  transitions de transcript et rendu des lignes vivent dans trois modules dédiés.
- Architecture : aucune logique de parsing ou de présentation ne reste dans la
  façade publique, et l’état partagé demeure inerte à travers les reloads jiti.
- Tests : 32 tests compact-tools et Oxlint ciblé au vert.
- Suite : dissocier layout, contenu diff et chrome du cadre mutation.

### 2026-09-01 — cadre mutation décomposé

- Refactor : `frame.ts` orchestre désormais quatre responsabilités isolées :
  contrats, layout/wrapping, chrome terminal et rendu coloré du diff.
- Architecture : la géométrie ne connaît plus la palette, et le chrome reçoit
  seulement une séquence ANSI optionnelle sans calculer la couleur métier.
- Tests : 21 tests edit/write et Oxlint ciblé au vert.
- Suite : séparer liste, détail et viewport du renderer Activity.

### 2026-09-01 — renderer Activity par surface

- Refactor : l’ancienne unité de 485 lignes devient une façade vers les
  renderers liste, détail, output et notice, avec chrome et contrats partagés.
- Architecture : chaque surface évolue indépendamment ; le viewport est seul à
  connaître scrollbar/sanitization et le chrome seul à gérer pages/footers.
- Tests : 70 tests background, intégration process et Oxlint ciblé au vert.
- Suite : découper les suites de tests monolithiques par contrat public.

### 2026-09-01 — tests pi-notify par unité

- Tests : l’ancienne suite unique est séparée entre poster/queues, sonde Herdr
  et hooks Pi, avec un harness de processus partagé.
- Gate : `pi-notify-test` énumère explicitement les trois contrats ; les 20
  scénarios et Oxlint restent au vert.
- Suite : séparer les tests compact-tools et working-loader par responsabilité.

### 2026-09-01 — tests compact-tools par contrat

- Tests : les 666 lignes sont redistribuées en suites summary/line, renderer et
  stack, appuyées par des factories partagées de contexte natif.
- Gate : les 32 scénarios restent explicitement énumérés par `pi-ui-test` et
  passent avec Oxlint strict.
- Suite : isoler transitions, primitives et intégration dans working-loader.

### 2026-09-01 — tests working-loader par couche

- Tests : la suite de 514 lignes devient trois unités indépendantes pour les
  primitives temporelles, le lifecycle de surface et le streaming thinking.
- Harness : scheduler, thème et API Pi factices sont partagés sans dupliquer les
  scénarios ; les 18 tests et Oxlint restent au vert.
- Suite : scinder les scénarios mutation edit entre parsing/diff et rendu.

### 2026-09-01 — tests edit par contrat

- Tests : parsing/diff canonique, géométrie du frame et intégration renderer ont
  désormais leurs suites autonomes et un thème ANSI minimal partagé.
- Gate : les 14 scénarios edit et Oxlint ciblé passent après découpage.
- Suite : auditer les derniers modules runtime de plus de 300 lignes hérités.

### 2026-09-01 — audit SRP final

- Décision : les gros runtime hérités restants sont des aggregate roots ou
  composants stateful uniques (`ActivityPage`, supervisor, stream/Bash runtime)
  et ne sont pas découpés selon un seuil arbitraire ; Fallow ne relève aucune
  complexité ni duplication introduite dans les 171 fichiers modifiés.
- Tests : gate complète au vert — 70 background, 20 notifications, 169 UI,
  Stow/startup, largeurs et filtres Git.

### 2026-09-02 — outils rares différés et documentation Pi contextuelle

- Fait : `load_tools` conserve uniquement les tools fichiers/shell au démarrage
  et active additivement web, frontend, MCP ou Agents/Background à la demande ;
  les schémas différés restent enregistrés pour le chargement natif Pi.
- Prompt : le bloc documentaire Pi disparaît des tâches ordinaires ; pour une
  tâche Pi, ses chemins restent disponibles mais la lecture est limitée aux
  sections et références nécessaires, sans obligation de lire chaque `.md`.
- Mesure : prompt neuf `gpt-5.6-sol` réduit de 8 148 à 2 645 tokens
  d'entrée (-67,5 %), avec 8 tools actifs au lieu de 20.
- Fichiers : `tool-loader.ts`, `prompt-policy.ts`, tests associés ; gate
  `pi-prompt-test` ajoutée au `Makefile`.
- Tests : esbuild des deux extensions, 7 tests ciblés, Oxlint et `make pi-test`
  complet au vert (192 Agents, 80 Background, 20 notifications, 170 UI).
- Suite : `/reload`, puis validation d'un chargement web et frontend réel.

### 2026-09-03 — un seul style compact pour tous les tools

- Fait : `compact-tools/api.ts` publie une façade process-global (slot
  `piCompactStyle`) consommée par des bridges embarqués dans les patches npm ;
  spec `external` par défaut au registre : tout tool sans style propre reçoit
  la row compacte empilable, jamais la box Pi.
- Fait : les quatre tools web (patch pi-web-access régénéré), `load_tools`,
  les cinq tools frontend, les quatre tools pr-review et mcp/mcpScript/tools
  directs MCP passent par la façade ; trois nouveaux patches pnpm.
- Décision : style par défaut = façade partagée, pas de duplicate du style dans
  les patches ; un nouveau package npm = un mini-patch branchant ses tools.
- Limite : `[compaction]` et `[skill]` restent des composants codés en dur dans
  le cœur Pi, non restylables par extension.
- Tests : esbuild de tous les modules touchés, suites Agents/Background/UI au
  vert, démarrage Pi réel (`test-pi-config`, `test-pi-startup`) ; nouveau patch
  déployé via `pnpm patch`/`patch-commit` et `pi-post` étendu à 4 packages.

### 2026-09-03 — response-view : réponses intermédiaires minimalistes

- Fait : distinction réponse finale / sortie intermédiaire — un message suivi
  de tool calls perd le diamant et le label « RÉPONSE » et n'ouvre plus qu'un
  trait `muted` pleine largeur ; pendant le streaming tout reste minimal,
  l'en-tête n'est révélé qu'au `message_end` si la réponse est finale.
- Décision : qualification par empreinte SHA-256 des blocs texte, hydratée
  depuis `getBranch()` au `session_start` et tenue à jour au `message_end` ;
  l'API du transformer n'expose ni identité ni stopReason du message.
- Fichiers : `response-view/index.ts`, `response-view/frame.ts`
  (extraction `renderTrace`, ajout `intermediateTopRule` et
  `frameIntermediateMarkdown`), `response-view/README.md`.
- Tests : suite `response-view.test.ts` au vert sans modification (rendu final
  inchangé), esbuild et typecheck strict contre les types pi-coding-agent
  0.84.1, smoke du routage streaming/intermédiaire/final/thinking.
- Suite : verrou comportemental du routage par l'agent de tests.

### 2026-09-04 — ligne de statut de session minimaliste

- Fait : restauration de l’activity strip archivée sous forme d’une ligne
  française discrète (durée, tours, outils, agents appelés/actifs), avec accent
  limité aux activités en cours.
- Placement : le registre reste une simple échelle ; `sessionStatus: 0` réserve
  la première ligne, avant le loader, Agents et Background.
- Fichiers : `activity-strip.ts`, `activity-strip/state.ts`,
  `activity-strip/README.md`, `ui/ordered-widget-stack.ts`, `ui/README.md`.
- Tests : smokes état/lifecycle/priorité, esbuild, Oxlint, Fallow et `make
pi-test` complet au vert (194 Agents, 83 Background, 20 notifications, 187 UI).
- Suite : `/reload` pour activer l’extension dans la session courante.

### 2026-09-04 — statut en retrait sous le thinking

- Fait : ligne davantage atténuée (`dim` majoritaire, aucun accent) et décalée
  de deux colonnes pour ne plus coller au bord gauche.
- Placement : `working: 0`, puis `sessionStatus: 10` ; le loader/thinking est le
  seul widget au-dessus du statut, Goal, Agents et Background restent dessous.
- Fichiers : `activity-strip.ts`, `activity-strip/README.md`,
  `ui/ordered-widget-stack.ts`, `ui/README.md`.
- Tests : première gate rejetée par le verrou historique `working: 50`, puis
  relance complète au vert à 50/75 ; retour final appliqué à 0/10, prouvé par
  smoke d’ordre, esbuild, Oxfmt, Oxlint et Fallow.
- Suite : `/reload` puis validation visuelle utilisateur.

### 2026-09-04 — rail de télémétrie fonctionnel du prompt

- Fait : le statut devient un rail adaptatif gauche/droite : durée, tours,
  outils, commandes, erreurs, fichiers lus/modifiés, churn, tokens
  input/output/cache et débit output, face à l’activité courante.
- Périmètre : métriques remises à zéro par prompt ; seules les opérations
  réussies alimentent fichiers/churn, les erreurs tools/provider restent
  visibles, puis le bilan disparaît vingt secondes après `agent_settled`.
- Style : une ligne sans cadre ni accent, uniquement `muted`/`dim`, avec quatre
  niveaux de dégradation responsive et thinking/statut aux priorités 0/10.
- Fichiers : `activity-strip.ts`, `activity-strip/{state,render}.ts`,
  `activity-strip/README.md`.
- Tests : smoke lifecycle et métriques au vert à 120 colonnes, disparition à
  20 000 ms prouvée ; esbuild, Oxfmt et Oxlint ciblés au vert.
- Suite : `/reload` puis validation visuelle utilisateur.

### 2026-09-04 — validation du rail de télémétrie

- Fait : le loader utilise le rang dédié `thinking: 0`, le statut reste à 10 ;
  `working: 50` demeure le rang des autres indicateurs de travail.
- Preuve visuelle : à 120 colonnes, tous les groupes tiennent sur une ligne et
  l’activité courante reste justifiée à droite ; le délai de retrait mesuré est
  exactement 20 000 ms.
- Tests : `make pi-test` complet au vert — 194 Agents, 83 Background,
  20 notifications, 187 UI, Stow, démarrage réel et filtres Git.
- Suite : `/reload` puis validation visuelle utilisateur.

### 2026-09-04 — trois îlots sémantiques sans pseudo-console

- Fait : suppression des commandes et de l’activité courante déjà visibles dans
  le transcript ; la ligne est recomposée en trois îlots explicites `PROMPT`,
  `TRAVAIL` et `TOKENS`.
- Style : aucun rail ni suite d’abréviations opaques ; micro-labels `dim`,
  valeurs `muted` et espace terminal distribué équitablement entre les groupes.
- Responsive : versions éditoriale, compacte et minimale validées à 160, 120,
  78 et 60 colonnes ; les tokens du prompt et le travail produit restent
  prioritaires.
- Fichiers : `activity-strip/state.ts`, `activity-strip/render.ts`,
  `activity-strip/README.md` et `activity-strip.ts`.
- Tests : smoke métriques/lifecycle au vert, disparition à 20 s confirmée et
  `make pi-test` complet au vert (187 tests UI).
- Suite : `/reload` puis validation visuelle utilisateur.

### 2026-09-04 — timeline réellement animée

- Fait : suppression complète des outils, commandes, fichiers et churn ; la
  surface ne conserve que le temps de traitement et les tokens du prompt.
- Dynamique : horloge rotative et tête de lecture à 250 ms ; l’output avance
  pendant le stream via une estimation signalée par `~`, puis l’usage provider
  exact remplace l’estimation à la fin du tour.
- Style : timeline `dim` avec impulsion `muted`, aucune couleur d’accent ; état
  final figé avec `✓` pendant vingt secondes.
- Fichiers : `activity-strip.ts`, `activity-strip/state.ts`,
  `activity-strip/render.ts`, `activity-strip/README.md`.
- Tests : smoke animation/stream/réconciliation/lifecycle au vert ; esbuild,
  Oxfmt, Oxlint et `make pi-test` complet au vert (187 tests UI).
- Suite : `/reload` puis validation visuelle utilisateur.

### 2026-09-04 — piste courte et débit de génération

- Fait : piste animée plafonnée à 24 colonnes ; l’espace restant est laissé
  respirer avant les tokens au lieu d’allonger artificiellement le trait.
- Mesure : `tok/s` utilise maintenant l’output cumulé sur le seul temps de
  streaming modèle mesuré localement ; outils et attentes n’abaissent plus le
  débit affiché.
- Exactitude : estimation `~` pendant les deltas, puis numérateur provider exact
  et durée cumulée des fenêtres de stream à chaque fin de tour.
- Fichiers : `activity-strip/state.ts`, `activity-strip/render.ts`,
  `activity-strip.ts`, `activity-strip/README.md`.
- Tests : smoke multi-tour à 30 tok/s exact et piste ≤ 24 colonnes ; `make
pi-test` complet au vert (187 tests UI).
- Suite : `/reload` puis validation visuelle utilisateur.
