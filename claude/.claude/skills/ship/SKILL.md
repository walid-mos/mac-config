---
name: ship
user-invocable: true
description: >-
  Execute a whole Plane epic autonomously: worktree from the base branch, every
  child ticket implemented and tested with atomic commits, sliced into a stack
  of readable PRs, then simplified and submitted. Trigger on /ship, "réalise
  l'épique X", "implémente toutes les tâches de MINA-1", "lance la feature".
---

# Ship

Take one Plane epic from Backlog to an open **stack of pull requests**, without
asking the user anything between the first ticket and the submit.

`/backlog` writes the tickets. `/ship` executes them et les découpe en PR
lisibles, empilées comme des commits.

## Arguments

`/ship <EPIC-IDENTIFIER> [titre libre] [options]`

- `<EPIC-IDENTIFIER>` (requis) — identifiant Plane de l'épique, ex. `MINA-1`.
  Le texte libre qui suit n'est qu'un rappel du titre : la source de vérité est
  Plane, jamais le prompt.
- `--base <branch>` — branche de départ du worktree et trunk du stack. Défaut :
  `main`.
- `--no-worktree` — travailler dans le repo courant (branche dédiée quand même).
- `--no-chrome` — sauter la vérification navigateur (sinon obligatoire dès
  qu'un ticket touche une surface web).
- `--only <IDS>` — restreindre à une liste de tickets, séparés par des virgules.
- `--max-files <N>` — plafond mou de fichiers par maillon de PR. Défaut : `20`.
- `--max-lines <N>` — plafond mou de lignes changées par maillon. Défaut : `1000`.
- `--no-stack` — désactiver le stacking : une seule branche, une seule PR en fin
  (comportement historique). Fallback aussi si l'extension `gh stack` manque.
- `--stop-before-pr` — construire le stack local mais ne pas `submit`.
- `--dry-run` — produire le plan d'exécution (dont le découpage en maillons) et
  s'arrêter là.

## FORBIDDEN / MANDATORY

| FORBIDDEN | MANDATORY |
|-----------|-----------|
| Demander une clarification au milieu de l'épique | Tout ce qui manque se décide en Phase 1, avant le premier commit |
| Une PR fourre-tout de toute l'épique | Un stack de maillons, chacun ≤ `--max-files` / `--max-lines`, reviewable seul |
| Un commit fourre-tout par ticket | Plusieurs commits atomiques, chacun compilable et testable seul |
| Couper un maillon au milieu d'un état incohérent | Un maillon compile, teste vert et se relit seul avant de passer au suivant |
| Isoler un ticket trivial dans sa propre PR | Fusionner les tickets adjacents fortement couplés tant que le budget tient |
| Laisser un ticket géant dans un seul maillon | Le re-découper en plusieurs maillons par couche |
| Passer un ticket en Done sans que sa branche soit poussée | Push de la branche d'abord, transition Plane ensuite |
| Marquer une tâche faite avec des tests rouges ou non lancés | Lancer les tests réellement et coller la sortie en cas d'échec |
| Réduire le périmètre en silence | Livrer le reste en entier et dire explicitement ce qui est bloqué et pourquoi |
| Inventer le contenu d'un ticket de mémoire | `retrieve_work_item` sur chacun, description lue avant d'écrire du code |
| Travailler directement sur `main` | Worktree ou branche dédiée depuis `--base` |
| `gh stack submit` avant `/simplify` global | Ordre imposé : dev → simplify par maillon → simplify global → submit |

## Phase 1 — Orient & découper

En parallèle :

- **Plane** — résoudre le projet (`list_projects`, matcher le repo courant),
  puis `retrieve_work_item_by_identifier(<EPIC>)` et
  `list_work_items(project_id, pql='childOf("<EPIC>")')`. `retrieve_work_item`
  sur chaque enfant pour `description_html`, `priority`, `state`.
  `list_work_item_relations` sur chacun pour les `blocked_by`.
  `list_states(project_id)` pour récupérer les uuid de `In Progress` et `Done`.
- **Repo** — `CLAUDE.md` du projet, `package.json` / `Makefile` (commandes de
  test, lint, dev), conventions de commit, état git.
- **Extension** — vérifier `gh stack` (`gh extension list | grep gh-stack`). Si
  absente : `gh extension install github/gh-stack`. Impossible → basculer en
  `--no-stack` et le dire.

Charger les skills que le stack impose (`typescript`, `react`, `coding`,
`nextnode-*`, `tdd`…) — ils ne sont pas optionnels.

Construire l'**ordre d'exécution** : tri topologique des tickets sur les arêtes
`blocked_by`, priorité comme départage. Un ticket déjà `Done` est sauté (le
dire). Un cycle de blocage ou un ticket dont le blocker est hors épique →
signaler et ordonner à la main.

**Découper le stack** — regrouper les tickets ordonnés en une liste ordonnée de
**maillons** (une branche + une PR chacun). L'ordre des maillons = l'ordre
topologique (un maillon ne dépend que de ceux d'en dessous). Règles :

1. **Défaut** : 1 ticket = 1 maillon.
2. **Fusion** : des tickets adjacents peuvent partager un maillon *seulement si*
   ils sont fortement couplés — l'un est intestable ou vide de sens sans l'autre
   (ex. `schéma DB` + `config Drizzle`) — *et* que leur diff cumulé estimé reste
   sous `--max-files` / `--max-lines`. Un ticket trivial (poignée de lignes) se
   fusionne par défaut avec son voisin couplé plutôt que d'avoir une PR solitaire.
3. **Split** : un ticket dont le diff estimé dépasse le budget est éclaté en
   plusieurs maillons empilés, par couche (schéma → validation → câblage →
   tests / UI), chacun compilable seul.

Le budget est mou : dépasser un peu pour ne pas couper une unité atomique est
préférable à un maillon qui ne compile pas. Ne jamais couper au milieu d'un état
rouge.

Sortir un plan court : liste des maillons (nom de branche, tickets inclus,
budget fichiers/lignes estimé), commandes de test détectées, surfaces web à
vérifier via Chrome. Avec `--dry-run`, s'arrêter ici.

## Phase 2 — Worktree & init du stack

Sauf `--no-worktree` : `git fetch`, puis créer un worktree depuis `--base` à
jour, branche racine du premier maillon. Y installer les dépendances si besoin.
Tout le reste du run s'y déroule.

Initialiser le stack sur le premier maillon :
`gh stack init --base <base> <slug-01-maillon>` (crée et checkout la branche du
bas). En `--no-stack`, une simple branche `feat/<epic-slug>` suffit.

Nommage des branches de maillon : `<epic-slug>-NN-<slug-maillon>` (NN à deux
chiffres, du bas vers le haut).

## Phase 3 — Boucle par maillon

Pour chaque maillon, dans l'ordre du stack :

Pour chaque ticket du maillon, dans l'ordre :

1. **In Progress** — `update_work_item(state=<In Progress uuid>)` avant la
   première ligne de code.
2. **Implémenter** — TDD quand le ticket a un critère d'acceptation vérifiable :
   test rouge, code, vert, refactor. Le code respecte SOLID et reste testable :
   dépendances injectées, pas de singleton caché, pas de couche qui en connaît
   trois autres.
3. **Committer en atomique** — un commit par unité cohérente (schéma, puis
   validation, puis câblage, puis tests), message conventional commit, sur la
   branche du maillon courant. Jamais un seul commit géant.
4. **Tester pour de vrai** — suite de tests + lint + typecheck du projet. Rouge
   = le ticket n'avance pas, on corrige.
5. **Vérifier dans Chrome** — dès que le ticket produit ou modifie une surface
   web : lancer l'app (skill `run`), naviguer le parcours du ticket, vérifier le
   rendu et la console via `claude-in-chrome`. Ticket purement back/infra
   dispensé — le dire.
6. **Push** — pousser la branche du maillon (`gh stack push` ou `git push`). Le
   push crée seulement la branche distante, **pas** la PR (submit en Phase 4).
7. **Done** — `update_work_item(state=<Done uuid>)`, seulement après le push.

Si le diff réel d'un maillon dépasse largement le budget en cours de route :
couper un maillon supplémentaire (`gh stack add <slug-NN-maillon>` ouvre une
nouvelle branche au-dessus) et y poursuivre. Le signaler dans le rapport.

Quand tous les tickets du maillon sont faits :

- **`/simplify` du maillon** — sur le diff du maillon seul : réutilisation,
  altitude, duplication. Ré-commiter les correctifs, re-tester vert.
- **Maillon suivant** — `gh stack add <slug-NN-maillon>` crée la branche du
  maillon suivant au-dessus et la checkout. Recommencer la boucle.

Si un ticket se révèle infaisable tel qu'écrit : implémenter tout ce qui l'est,
laisser le ticket en `In Progress`, commenter sur le ticket Plane
(`create_work_item_comment`) ce qui bloque, et continuer l'épique. Ne jamais
s'arrêter net sur un blocage local.

## Phase 4 — Clôture & submit

Dans cet ordre, sans en sauter :

1. **`/simplify` global** — sur le diff complet de l'épique, tout le stack :
   duplication et abstractions qui n'apparaissent qu'en voyant l'ensemble. Si un
   correctif touche un maillon du bas, propager vers le haut avec
   `gh stack rebase`, puis re-tester. Sûr : aucune PR n'est encore ouverte.
2. **Vérification finale** — suite complète verte sur tout le stack, et
   re-passage Chrome sur les parcours si `/simplify` a touché du code UI.
3. **Submit** — `gh stack submit --auto --open` : pousse toutes les branches,
   crée toutes les PR d'un coup, prêtes à review, chaînées sur GitHub. Titres et
   descriptions par maillon citent les tickets Plane couverts. Sauf
   `--stop-before-pr`, qui s'arrête après l'étape 2 et rend la main avec le stack
   local prêt. En `--no-stack` : `/pr` sur la branche unique au lieu de `submit`.

Ship **n'auto-merge pas**. Le merge du stack reste une porte humaine explicite :
`gh stack merge` (ou `gh stack merge --yes`) une fois les PR revues.

## Definition of done

Ne rien annoncer comme fini tant que tout ceci n'est pas vrai :

- Chaque ticket de l'épique est `Done` dans Plane, ou explicitement listé comme
  bloqué avec sa raison.
- Chaque ticket a plusieurs commits atomiques.
- Le travail est découpé en maillons, chacun sous le budget (ou dépassement
  justifié et signalé), compilant et testant vert seul.
- Tests, lint et typecheck passent sur tout le stack — sortie réelle, pas une
  supposition.
- Les parcours web ont été vus dans Chrome.
- `/simplify` a tourné par maillon **et** en global, correctifs commités et testés.
- Le stack de PR est soumis (`gh stack submit`), sauf `--stop-before-pr`.

## Rapport final

Le stack (`gh stack view --short`), puis une ligne par maillon : nom, tickets
inclus (identifiant + état), nombre de commits, budget fichiers/lignes réel, URL
de la PR. Ce qui a été vérifié dans Chrome, et ce qui reste ouvert ou bloqué.
Rappeler la commande de merge (`gh stack merge`). Pas de récap du code écrit.
