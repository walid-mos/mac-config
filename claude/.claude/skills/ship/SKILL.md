---
name: ship
user-invocable: true
description: >-
  Execute a whole Plane epic autonomously: worktree from the base branch, every
  child ticket implemented and tested with atomic commits and Plane state
  transitions, then simplify, code-review and PR. Trigger on /ship, "réalise
  l'épique X", "implémente toutes les tâches de MINA-1", "lance la feature".
---

# Ship

Take one Plane epic from Backlog to an open pull request, without asking the
user anything between the first ticket and the PR.

`/backlog` writes the tickets. `/ship` executes them.

## Arguments

`/ship <EPIC-IDENTIFIER> [titre libre] [options]`

- `<EPIC-IDENTIFIER>` (requis) — identifiant Plane de l'épique, ex. `MINA-1`.
  Le texte libre qui suit n'est qu'un rappel du titre : la source de vérité est
  Plane, jamais le prompt.
- `--base <branch>` — branche de départ du worktree. Défaut : `main`.
- `--no-worktree` — travailler dans le repo courant (branche dédiée quand même).
- `--no-chrome` — sauter la vérification navigateur (sinon obligatoire dès
  qu'un ticket touche une surface web).
- `--only <IDS>` — restreindre à une liste de tickets, séparés par des virgules.
- `--stop-before-pr` — tout faire sauf ouvrir la PR.
- `--dry-run` — produire le plan d'exécution et s'arrêter là.

## FORBIDDEN / MANDATORY

| FORBIDDEN | MANDATORY |
|-----------|-----------|
| Demander une clarification au milieu de l'épique | Tout ce qui manque se décide en Phase 1, avant le premier commit |
| Un commit fourre-tout par ticket | Plusieurs commits atomiques, chacun compilable et testable seul |
| Passer un ticket en Done sans que son dernier commit soit poussé | Push d'abord, transition Plane ensuite |
| Marquer une tâche faite avec des tests rouges ou non lancés | Lancer les tests réellement et coller la sortie en cas d'échec |
| Réduire le périmètre en silence | Livrer le reste en entier et dire explicitement ce qui est bloqué et pourquoi |
| Inventer le contenu d'un ticket de mémoire | `retrieve_work_item` sur chacun, description lue avant d'écrire du code |
| Travailler directement sur `main` | Worktree ou branche dédiée depuis `--base` |
| Ouvrir la PR avant `/simplify` puis la revue | Ordre imposé : dev → `/simplify` → revue adversariale → `/pr` |
| Tenter `/code-review` (built-in `disable-model-invocation`) | Conduire la revue de [`review.md`](review.md), puis dire à l'utilisateur de lancer `/code-review xhigh --fix` lui-même |

## Phase 1 — Orient

En parallèle :

- **Plane** — résoudre le projet (`list_projects`, matcher le repo courant),
  puis `retrieve_work_item_by_identifier(<EPIC>)` et
  `list_work_items(project_id, pql='childOf("<EPIC>")')`. `retrieve_work_item`
  sur chaque enfant pour `description_html`, `priority`, `state`.
  `list_work_item_relations` sur chacun pour les `blocked_by`.
  `list_states(project_id)` pour récupérer les uuid de `In Progress` et `Done`.
- **Repo** — `CLAUDE.md` du projet, `package.json` / `Makefile` (commandes de
  test, lint, dev), conventions de commit, état git.

Charger les skills que le stack impose (`typescript`, `react`, `coding`,
`nextnode-*`, `tdd`…) — ils ne sont pas optionnels.

Construire l'**ordre d'exécution** : tri topologique des tickets sur les arêtes
`blocked_by`, priorité comme départage. Un ticket déjà `Done` est sauté (le
dire). Un cycle de blocage ou un ticket dont le blocker est hors épique →
signaler et ordonner à la main.

Sortir un plan court : ordre des tickets, commandes de test détectées, surfaces
web à vérifier via Chrome. Avec `--dry-run`, s'arrêter ici.

## Phase 2 — Worktree

Sauf `--no-worktree` : créer un worktree depuis `--base` à jour (`git fetch`
d'abord), branche `feat/<epic-slug>`. Y installer les dépendances si le projet
en a besoin. Tout le reste du run s'y déroule.

## Phase 3 — Boucle par ticket

Pour chaque ticket, dans l'ordre :

1. **In Progress** — `update_work_item(state=<In Progress uuid>)` avant la
   première ligne de code.
2. **Implémenter** — TDD quand le ticket a un critère d'acceptation
   vérifiable : test rouge, code, vert, refactor. Le code doit respecter SOLID
   et rester testable : dépendances injectées, pas de singleton caché, pas de
   couche qui en connaît trois autres.
3. **Committer en atomique** — un commit par unité cohérente (schéma, puis
   validation, puis câblage, puis tests), message conventional commit. Jamais
   un seul commit géant en fin de ticket.
4. **Tester pour de vrai** — suite de tests + lint + typecheck du projet. Rouge
   = le ticket n'avance pas, on corrige.
5. **Vérifier dans Chrome** — dès que le ticket produit ou modifie une surface
   web : lancer l'app, naviguer le parcours décrit par le ticket, vérifier le
   rendu et la console. Utiliser le skill `run` pour le démarrage et les outils
   `claude-in-chrome`. Un ticket purement back/infra en est dispensé — le dire.
6. **Push** — pousser la branche.
7. **Done** — `update_work_item(state=<Done uuid>)`, seulement après le push.

Si un ticket se révèle infaisable tel qu'écrit : implémenter tout ce qui l'est,
laisser le ticket en `In Progress`, commenter sur le ticket Plane
(`create_work_item_comment`) ce qui bloque, et continuer l'épique. Ne jamais
s'arrêter net sur un blocage local.

## Phase 4 — Clôture

Dans cet ordre, sans en sauter :

1. `/simplify` sur le diff complet de l'épique — réutilisation, altitude,
   duplication.
2. **Revue adversariale** — voir [`review.md`](review.md) : agents par
   dimension, passe de réfutation, correctifs en commits séparés.
   `/code-review` est `disable-model-invocation` et **ne peut pas** être lancé
   depuis `/ship` : ne pas essayer, ni via `Skill`, ni via `Bash`.
3. Vérification finale : suite complète verte, et re-passage Chrome sur les
   parcours si `/simplify` ou la revue ont touché du code UI.
4. `/pr` — la description couvre l'épique entière et cite les identifiants des
   tickets. Sauf `--stop-before-pr`, qui s'arrête ici et rend la main.

## Definition of done

Ne rien annoncer comme fini tant que tout ceci n'est pas vrai :

- Chaque ticket de l'épique est `Done` dans Plane, ou explicitement listé comme
  bloqué avec sa raison.
- Chaque ticket a plusieurs commits atomiques.
- Tests, lint et typecheck passent sur la branche finale — sortie réelle, pas
  une supposition.
- Les parcours web ont été vus dans Chrome.
- `/simplify` puis la revue adversariale ont tourné, dans cet ordre, et les
  findings survivants sont corrigés et testés.
- La PR est ouverte, sauf `--stop-before-pr`.

## Rapport final

Une ligne par ticket (identifiant, titre, état, nombre de commits), l'URL de la
PR, ce qui a été vérifié dans Chrome, ce que la revue adversariale a corrigé, et
ce qui reste ouvert. Terminer par le rappel que `/code-review xhigh --fix` est à
lancer manuellement. Pas de récap du code écrit.
