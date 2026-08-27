---
name: ship
user-invocable: true
description: >-
  Execute a whole Plane epic autonomously: worktree from the base branch, every
  child ticket implemented and tested with atomic commits, sliced into a stack
  of readable PRs, each maillon implemented via local execution (parallel front/code),
  visually and functionally verified via /visual-check, simplified via
  /simplify, and submitted — under the /goal auto-continue loop.
  Trigger on /ship, "réalise l'épique X", "implémente toutes les tâches de MINA-1",
  "lance la feature". Lookup seul ("c'est quoi le ticket X") : plane_* tools, pas /ship.
---

# Ship

Take one Plane epic from Backlog to an open **stack of pull requests**, without
asking the user anything between the first ticket and the submit.


## Objectif — engager le loop /goal

Avant toute implémentation, appeler `goal_set` avec une condition vérifiable
depuis les sorties de commandes du transcript (jamais une déclaration) :

```
goal_set({ condition: "Épique <EPIC> livrée : stack soumis (gh stack view --short
  affiche N branches), tous les tickets Done dans Plane (ou bloqués listés avec
  leur raison), tests/lint/typecheck verts sur tout le stack (sorties dans le
  transcript), /visual-check par maillon UI (screenshots + console + parcours
  d'acceptation dans le transcript), /simplify par maillon et global effectués.
  Stop after 30 turns." })
```

L'extension `/goal` auto-continue alors de tour en tour jusqu'à `met` /
`impossible` / `stuck`. Règles du loop (skill `goal`) :

- **Prove, don't declare** — l'évaluateur ne voit que le transcript : chaque
  condition doit être prouvée par une sortie de commande réelle, pas affirmée.
- **Un step vérifiable par tour** — préférer le résultat d'une commande à un
  paragraphe.
- **Aucune question en cours de route** — tout se tranche en Phase 1.
- `--stop-before-pr` → la condition devient « stack construit localement, simplify
  global fait, sans submit » (le push reste hors du loop).
- Ajuster « Stop after N turns » à la taille de l'épique (25 par défaut).

## Arguments

`/ship <EPIC-IDENTIFIER> [titre libre] [options]`

- `<EPIC-IDENTIFIER>` (requis) — identifiant Plane de l'épique, ex. `MINA-1`.
  Le texte libre qui suit n'est qu'un rappel du titre : la source de vérité est
  Plane, jamais le prompt.
- `--base <branch>` — branche de départ du worktree et trunk du stack. Défaut :
  `main`.
- `--no-worktree` — travailler dans le repo courant (branche dédiée quand même).
- `--no-chrome` — sauter `/visual-check` (sinon obligatoire dès qu'un ticket
  touche une surface web).
- `--only <IDS>` — restreindre à une liste de tickets, séparés par des virgules.
- `--max-files <N>` / `--max-lines <N>` — transmis au contrat Stack
  ([slicing.md](../stack/references/slicing.md)). Pas de défauts propres.
- `--no-stack` — désactiver le stacking : une seule branche, une seule PR en fin
  (comportement historique). Fallback aussi si l'extension `gh stack` manque.
- `--stop-before-pr` — construire le stack local mais ne pas `submit`.
- `--dry-run` — produire le plan d'exécution (dont le découpage en maillons) et
  s'arrêter là.

## FORBIDDEN / MANDATORY

| FORBIDDEN | MANDATORY |
|-----------|-----------|
| Demander une clarification au milieu de l'épique | Tout ce qui manque se décide en Phase 1, avant le premier commit |
| Une PR fourre-tout de toute l'épique | Stack de maillons selon [slicing.md](../stack/references/slicing.md) |
| Un commit fourre-tout par ticket | Plusieurs commits atomiques, chacun compilable et testable seul |
| Couper un maillon au milieu d'un état incohérent | Un maillon compile, teste vert et se relit seul avant de passer au suivant |
| Passer un ticket en Done sans que sa branche soit poussée | Push de la branche d'abord, transition Plane ensuite |
| Marquer une tâche faite avec des tests rouges ou non lancés | Lancer les tests réellement et coller la sortie en cas d'échec |
| Réduire le périmètre en silence | Livrer le reste en entier et dire explicitement ce qui est bloqué et pourquoi |
| Inventer le contenu d'un ticket de mémoire | `plane_get_workitem` sur chacun, description lue avant d'écrire du code |
| Travailler directement sur `main` | Worktree ou branche dédiée depuis `--base` |
| `gh stack submit` avant `/simplify` global | Ordre imposé : dev → simplify par maillon → simplify global → submit |

## Phase 1 — Orient & découper

En parallèle :

- **Plane** — résoudre le projet (`plane_list_projects`, matcher le repo courant),
  puis `plane_get_workitem(<EPIC>)` et `plane_list_workitems(project_id=<uuid>)`.
  `plane_get_workitem` sur chaque enfant pour `description`, `priority`, `state`.
  `plane_list_states(project_id)` pour récupérer les uuid de `In Progress` et `Done`.
- **Repo** — `CLAUDE.md` du projet, `package.json` / `Makefile` (commandes de
  test, lint, dev), conventions de commit, état git.
- **Extension** — vérifier `gh stack` (`gh extension list | grep gh-stack`). Si
  absente : `gh extension install github/gh-stack`. Impossible → basculer en
  `--no-stack` et le dire.

Charger les skills que le stack impose (`typescript`, `react`, `coding`,
`nextnode-*`) — ils ne sont pas optionnels. Dès qu'un maillon touche
une surface web : charger aussi `visual-check` (source de vérité du check
navigateur — ne pas réécrire son workflow ici).

Construire l'**ordre d'exécution** : tri topologique des tickets. Un ticket déjà
`Done` est sauté (le dire). Un cycle de blocage → signaler et ordonner à la main.

**Découper le stack** — passer les tickets ordonnés, leurs faits (description,
couplage, edges, surfaces, acceptation) et les flags `--max-files` /
`--max-lines` au contrat [slicing.md](../stack/references/slicing.md).
Ship n'a pas d'algorithme de découpe propre : pas de « 1 ticket = 1
maillon », pas de fusion/split locaux.

Sortir un plan court : liste des maillons (nom de branche, tickets inclus,
budget fichiers/lignes estimé), commandes de test détectées, surfaces web et
parcours d'acceptation à vérifier via `/visual-check`. Avec `--dry-run`,
s'arrêter ici.

## Phase 2 — Worktree & init du stack

Sauf `--no-worktree` : `git fetch`, puis créer un worktree depuis `--base` à
jour, branche racine du premier maillon. Y installer les dépendances si besoin.
Tout le reste du run s'y déroule.

Initialiser le stack sur le premier maillon :
`gh stack init --base <base> <slug-01-maillon>` (crée et checkout la branche du
bas). En `--no-stack`, une simple branche `feat/<epic-slug>` suffit.

Nommage des branches de maillon : `<epic-slug>-NN-<slug-maillon>` (NN à deux
chiffres, du bas vers le haut).

## Phase 3 — Boucle par maillon (exécution locale par maillon)

Pour chaque maillon, dans l'ordre du stack :

1. **In Progress** — passer tous les tickets du maillon en
   `plane_update_workitem(identifier=<id>, stateId=<In Progress uuid>)`, avant l’implémentation.
3. **Tester pour de vrai** — suite de tests + lint + typecheck du projet après
   application. Rouge = le maillon n'avance pas, on corrige en fix direct (pas
   une nouvelle boucle). Si fallow se résout (skill `fallow-gate`), y ajouter le
   gate `audit --base <branche de base du stack>` : findings introduits par le
   maillon = correction avant push.
4. **`/visual-check` + parcours fonctionnel** — dès que le maillon produit ou
   modifie une surface web (sauf `--no-chrome`) :
   - Charger le skill `visual-check` et l'exécuter sur les **pages du maillon**
     (paths du ticket / proto, pas un crawl de tout le site).
   - En plus du rendu : exercer le **parcours d'acceptation** du ticket avec
     `frontend_act` (click, type, submit…) et `frontend_eval` pour les critères
     exacts (texte, état, compteurs). Console clean exigée.
   - Anomalie visuelle, console error, ou parcours cassé = maillon non fini.
     Corriger en fix direct, re-check, puis seulement push.
   Maillon purement back/infra dispensé — le dire.
5. **Push** — pousser la branche du maillon (`gh stack push` ou `git push`). Le
   push crée seulement la branche distante, **pas** la PR (submit en Phase 4).
6. **Done** — `plane_update_workitem(identifier=<id>, stateId=<Done uuid>)` pour
   chaque ticket du maillon, seulement après le push.

Si un split en cours de route s'impose : ré-appliquer le contrat Stack,
`gh stack add <slug-NN-maillon>` (nouvelle branche au-dessus), y poursuivre.
Le signaler dans le rapport.

Quand tous les tickets du maillon sont faits :

- **Maillon suivant** — `gh stack add <slug-NN-maillon>` crée la branche du
  maillon suivant au-dessus et la checkout. Recommencer la boucle.

Si un ticket se révèle infaisable tel qu'écrit : implémenter tout ce qui l'est,
laisser le ticket en `In Progress`, commenter sur le ticket Plane
(`plane_create_comment`), et continuer l'épique. Ne jamais s'arrêter net sur un
blocage local.

## Phase 4 — Clôture & submit

Dans cet ordre, sans en sauter :

1. **`/simplify` global** — skill `simplify` sous son contrat
   (`/simplify global`). Si un correctif touche un maillon du bas, propager
   vers le haut avec `gh stack rebase`, puis re-tester. Sûr : aucune PR n'est
   encore ouverte.
2. **Vérification finale** — suite complète verte sur tout le stack, et
   re-`/visual-check` des parcours si `/simplify` a touché du code UI.
3. **Submit** — `gh stack submit --auto --open` : pousse toutes les branches,
   crée toutes les PR d'un coup, prêtes à review, chaînées sur GitHub. Titres et
   descriptions par maillon citent les tickets Plane couverts. Sauf
   `--stop-before-pr`, qui s'arrête après l'étape 2 et rend la main avec le stack
   local prêt. En `--no-stack` : charger le skill `pr` sur la branche unique
   au lieu de `submit`.

Ship **n'auto-merge pas**. Le merge du stack reste une porte humaine explicite :
`gh stack merge` (ou `gh stack merge --yes`) une fois les PR revues.

## Definition of done

Ne rien annoncer comme fini tant que tout ceci n'est pas vrai :

- Chaque ticket de l'épique est `Done` dans Plane, ou explicitement listé comme
  bloqué avec sa raison.
- Chaque ticket a plusieurs commits atomiques.
- Le travail est découpé selon le contrat Stack, chaque maillon compilant et
  testant vert seul (dépassement de budget justifié et signalé si besoin).
- Tests, lint et typecheck passent sur tout le stack — sortie réelle, pas une
  supposition.
- Les parcours web ont un `/visual-check` dans le transcript (screenshots vus,
  console, parcours d'acceptation exercé) — ou maillon back/infra explicitement
  dispensé, ou `--no-chrome`.
- `/simplify` a tourné par maillon **et** en global, correctifs commités et testés.
- Le stack de PR est soumis (`gh stack submit`), sauf `--stop-before-pr`.

## Rapport final

Le stack (`gh stack view --short`), puis une ligne par maillon : nom, tickets
inclus (identifiant + état), nombre de commits, budget fichiers/lignes réel, URL
de la PR. Ce qui a été vérifié via `/visual-check`, et ce qui reste ouvert ou bloqué.
Rappeler la commande de merge (`gh stack merge`). Pas de récap du code écrit.