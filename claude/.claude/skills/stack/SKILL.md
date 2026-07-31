---
name: stack
user-invocable: true
description: >-
  Réaliser un travail de dev décrit librement (hors Plane) en le découpant dès le
  départ en un stack de PR lisibles : worktree, maillons ≤ budget, commits
  atomiques, tests, simplify, puis submit du stack. Pour le dev client sans Plane
  (Jira, pas de tickets connectés) et tout ce qui passe par /goal. Trigger on
  /stack, "découpe ça en PR", "empile les PR", "développe cette feature en stack".
---

# Stack

Prendre un objectif de dev décrit en langage libre et le livrer en **stack de
pull requests**, découpé dès le départ comme des commits empilés — sans attendre
la fin pour couper.

C'est `/ship` sans Plane : mêmes règles de découpe et de stacking, mais la source
de vérité est ta description (ou la session `/goal` en cours), pas des tickets.
Quand le projet est sous Plane, préférer `/ship`.

## Arguments

`/stack <description libre du travail> [options]`

- `<description>` (requis) — ce qu'il y a à faire. Aussi précis que possible :
  périmètre, contraintes, critères d'acceptation. C'est la seule source de vérité.
- `--base <branch>` — branche de départ du worktree et trunk du stack. Défaut :
  `main`.
- `--no-worktree` — travailler dans le repo courant (branche dédiée quand même).
- `--no-chrome` — sauter la vérification navigateur (sinon obligatoire dès qu'un
  maillon touche une surface web).
- `--max-files <N>` — plafond mou de fichiers par maillon. Défaut : `20`.
- `--max-lines <N>` — plafond mou de lignes changées par maillon. Défaut : `1000`.
- `--no-stack` — désactiver le stacking : une seule branche, une seule PR (`/pr`).
  Fallback aussi si l'extension `gh stack` manque.
- `--stop-before-pr` — construire le stack local mais ne pas `submit`.
- `--dry-run` — produire le plan (dont le découpage en maillons) et s'arrêter là.

## FORBIDDEN / MANDATORY

| FORBIDDEN | MANDATORY |
|-----------|-----------|
| Demander une clarification au milieu du dev | Tout ce qui manque se clarifie en Phase 1, avant le premier commit |
| Une PR fourre-tout de tout le travail | Un stack de maillons, chacun ≤ `--max-files` / `--max-lines`, reviewable seul |
| Un commit fourre-tout | Plusieurs commits atomiques, chacun compilable et testable seul |
| Couper un maillon au milieu d'un état incohérent | Un maillon compile, teste vert et se relit seul avant le suivant |
| Isoler un changement trivial dans sa propre PR | Fusionner ce qui est fortement couplé tant que le budget tient |
| Laisser une unité géante dans un seul maillon | La re-découper en plusieurs maillons par couche |
| Marquer un maillon fini avec des tests rouges ou non lancés | Lancer les tests réellement et coller la sortie en cas d'échec |
| Réduire le périmètre en silence | Livrer le reste en entier et dire explicitement ce qui est bloqué et pourquoi |
| Travailler directement sur `main` | Worktree ou branche dédiée depuis `--base` |
| `gh stack submit` avant `/simplify` global | Ordre imposé : dev → simplify par maillon → simplify global → submit |

## Phase 1 — Orient & découper

En parallèle :

- **Objectif** — relire la description (et le contexte `/goal` s'il y en a un).
  Ce qui reste ambigu et bloque le découpage se tranche ici, une bonne fois, pas
  au milieu du dev. Si une décision engage vraiment le client, la poser
  maintenant — jamais après le premier commit.
- **Repo** — `CLAUDE.md` du projet, `package.json` / `Makefile` (commandes de
  test, lint, dev), conventions de commit, état git.
- **Extension** — vérifier `gh stack` (`gh extension list | grep gh-stack`). Si
  absente : `gh extension install github/gh-stack`. Impossible → `--no-stack`.

Charger les skills que le stack impose (`typescript`, `react`, `coding`,
`nextnode-*`, `tdd`…) — ils ne sont pas optionnels.

**Découper le stack** — transformer le périmètre en une liste ordonnée de
**maillons** (une branche + une PR chacun), du plus fondamental au plus haut
(un maillon ne dépend que de ceux d'en dessous). Règles :

1. **Défaut** : une unité de travail cohérente = un maillon.
2. **Fusion** : regrouper dans un maillon ce qui est fortement couplé — l'un est
   intestable ou vide de sens sans l'autre (ex. `schéma DB` + `config Drizzle`) —
   *tant que* le diff cumulé estimé reste sous `--max-files` / `--max-lines`. Un
   changement trivial se fusionne avec son voisin couplé plutôt que d'avoir une
   PR solitaire.
3. **Split** : une unité dont le diff estimé dépasse le budget est éclatée en
   plusieurs maillons empilés, par couche (schéma → validation → câblage →
   tests / UI), chacun compilable seul.

Budget mou : dépasser un peu pour ne pas couper une unité atomique vaut mieux
qu'un maillon qui ne compile pas. Jamais de coupe au milieu d'un état rouge.

Sortir un plan court : liste des maillons (nom de branche, contenu, budget
estimé), commandes de test détectées, surfaces web à vérifier via Chrome. Avec
`--dry-run`, s'arrêter ici.

## Phase 2 — Worktree & init du stack

Sauf `--no-worktree` : `git fetch`, worktree depuis `--base` à jour, branche
racine du premier maillon, dépendances installées si besoin. Tout le run s'y
déroule.

`gh stack init --base <base> <slug-01-maillon>` (crée et checkout la branche du
bas). En `--no-stack`, une simple branche `feat/<slug>` suffit. Nommage des
maillons : `<slug>-NN-<slug-maillon>` (NN à deux chiffres, du bas vers le haut).

## Phase 3 — Boucle par maillon

Pour chaque maillon, dans l'ordre du stack :

1. **Implémenter** — TDD dès qu'il y a un critère d'acceptation vérifiable : test
   rouge, code, vert, refactor. Code SOLID et testable : dépendances injectées,
   pas de singleton caché, pas de couche qui en connaît trois autres.
2. **Committer en atomique** — un commit par unité cohérente (schéma, puis
   validation, puis câblage, puis tests), conventional commit, sur la branche du
   maillon. Jamais un seul commit géant.
3. **Tester pour de vrai** — suite de tests + lint + typecheck. Rouge = on
   corrige avant d'avancer.
4. **Vérifier dans Chrome** — dès que le maillon touche une surface web : lancer
   l'app (skill `run`), naviguer le parcours, vérifier rendu et console via
   `claude-in-chrome`. Maillon purement back/infra dispensé — le dire.
5. **Push** — pousser la branche du maillon (`gh stack push`). Le push crée la
   branche distante, **pas** la PR (submit en Phase 4).
6. **`/simplify` du maillon** — sur son diff seul : réutilisation, altitude,
   duplication. Ré-commiter, re-tester vert.
7. **Maillon suivant** — `gh stack add <slug-NN-maillon>` crée la branche du
   maillon suivant au-dessus et la checkout. Recommencer.

Si le diff réel dépasse largement le budget en cours de route : couper un maillon
supplémentaire (`gh stack add`) et y poursuivre. Le signaler.

Si une unité se révèle infaisable telle qu'écrite : implémenter tout ce qui l'est,
livrer le reste, et dire explicitement ce qui bloque et pourquoi. Ne jamais
s'arrêter net sur un blocage local sans livrer ce qui marche.

## Phase 4 — Clôture & submit

Dans cet ordre, sans en sauter :

1. **`/simplify` global** — sur le diff complet, tout le stack. Si un correctif
   touche un maillon du bas, propager vers le haut avec `gh stack rebase`, puis
   re-tester. Sûr : aucune PR n'est encore ouverte.
2. **Vérification finale** — suite complète verte sur tout le stack, re-passage
   Chrome si `/simplify` a touché du code UI.
3. **Submit** — `gh stack submit --auto --open` : pousse toutes les branches,
   crée toutes les PR d'un coup, chaînées. Chaque PR décrit son maillon. Sauf
   `--stop-before-pr` (stop après l'étape 2, stack local prêt) ou `--no-stack`
   (`/pr` sur la branche unique).

`/stack` **n'auto-merge pas**. Le merge reste une porte humaine : `gh stack merge`
une fois les PR revues.

## Definition of done

- Le travail décrit est livré en entier, ou le reste est explicitement listé comme
  bloqué avec sa raison.
- Découpé en maillons, chacun sous le budget (ou dépassement justifié et signalé),
  compilant et testant vert seul.
- Chaque maillon a plusieurs commits atomiques.
- Tests, lint, typecheck verts sur tout le stack — sortie réelle, pas supposée.
- Les parcours web ont été vus dans Chrome.
- `/simplify` a tourné par maillon **et** en global, correctifs commités et testés.
- Le stack de PR est soumis, sauf `--stop-before-pr`.

## Rapport final

Le stack (`gh stack view --short`), puis une ligne par maillon : nom, contenu,
nombre de commits, budget fichiers/lignes réel, URL de la PR. Ce qui a été
vérifié dans Chrome, ce qui reste ouvert ou bloqué, et la commande de merge
(`gh stack merge`). Pas de récap du code écrit.
