---
name: stack
user-invocable: true
description: >-
    Découper un travail de dev décrit librement en un stack de pull requests
    propres : features ordonnées, chacune sur une branche empilée, commits
    atomiques, tests verts, /visual-check par maillon UI, /simplify par maillon
    puis global, puis submit du
    stack. Pour le dev hors Plane et tout ce qui passe par /goal. Trigger on
    /stack, "découpe ça en PR", "empile les PR", "développe cette feature en stack".
---

# Stack

Livrer un objectif de dev décrit en langage libre comme un **stack de PR** :
découpé dès le départ en features lisibles et empilées comme des commits — pas
une PR fourre-tout en fin de course.

## Arguments

`/stack <description libre> [options]`

- `<description>` (requis) — ce qu'il y a à faire (périmètre, contraintes,
  critères d'acceptation). Source de vérité.
- `--base <branch>` — branche de départ. Défaut : `main`.
- `--no-worktree` — travailler dans le repo courant (branche dédiée quand même).
- `--max-files <N>` — plafond mou de fichiers par maillon. Défaut : `20`.
- `--max-lines <N>` — plafond mou de lignes changées par maillon. Défaut : `1000`.
- `--no-stack` — une seule branche, une seule PR. Fallback si `gh stack` manque.
- `--dry-run` — produire le plan (dont le découpage) et s'arrêter.

## Découpage

Transformer le périmètre en une liste ordonnée de **maillons** (une branche +
une PR chacun), du plus fondamental au plus haut (un maillon ne dépend que de
ceux d'en dessous).

1. **Défaut** : une feature cohérente = un maillon.
2. **Fusion** : ce qui est fortement couplé (l'un est intestable sans l'autre,
   ex. schéma DB + config) partage un maillon _tant que_ le diff cumulé estimé
   reste sous le budget.
3. **Split** : une feature dont le diff estimé dépasse le budget se coupe en
   plusieurs maillons par couches (schéma → validation → câblage → UI), chacun
   compilable seul.

Un maillon doit se relire et se tester seul. Budget mou : dépasser un peu pour
ne pas couper une unité atomique vaut mieux qu'un maillon qui ne compile pas.
Jamais de coupe au milieu d'un état rouge.

Sortir un plan court : liste des maillons (nom de branche, contenu, budget
estimé) et commandes de test détectées. Avec `--dry-run`, s'arrêter ici.

## Objectif — engager le loop /goal

Avant l'exécution, appeler `goal_set` avec une condition vérifiable depuis les
sorties de commandes du transcript :

```
goal_set({ condition: "Stack construit localement : gh stack view --short
  affiche N maillons, tests/lint/typecheck verts, /visual-check par maillon UI
  (screenshots + console + parcours d'acceptation dans le transcript),
  /simplify par maillon et global effectués. Pas de push (manuel).
  Stop after 25 turns." })
```

L'extension `/goal` auto-continue de tour en tour jusqu'à `met` / `impossible` /
`stuck`. Règles : **prove don't declare**, un step vérifiable par tour, aucune
question en cours de route. La condition exclut délibérément le push (manuel
dans `/stack`).

## Exécution

1. **Orient** — relire la description ; repérer dans le repo les commandes de
   test/lint/dev (`package.json`, `Makefile`) et les conventions de commit.
   Trancher les ambiguïtés maintenant, avant le premier commit.
2. **Worktree & init** — `git fetch`, worktree depuis `--base` à jour.
   `gh stack init --base <base> <slug-01-maillon>`. Nommage des maillons :
   `<slug>-NN-<slug-maillon>` (NN à deux chiffres, du bas vers le haut).
3. **`/simplify global`** sur le diff complet du stack, avant tout submit.

Le stack reste **local** — aucune branche ni PR n'est poussée. Le push est
manuel (`git push` ou `gh stack push`), quand le développeur est prêt.

## Règles

- Jamais de question au milieu du dev — tout se tranche au départ.
- Jamais de PR fourre-tout, jamais de commit fourre-tout.
- Un maillon compile, teste vert et se relit seul avant le suivant.
- Ne jamais travailler directement sur `main`.
- Si une feature se révèle infaisable : implémenter tout ce qui l'est, livrer le
  reste, et dire explicitement ce qui bloque et pourquoi.
- Si le diff réel dépasse largement le budget en cours de route : couper un
  maillon supplémentaire (`gh stack add`) et le signaler.

## Rapport final

`gh stack view --short`, puis une ligne par maillon : nom, contenu, nombre de
commits, budget fichiers/lignes réel. Ce qui reste ouvert ou bloqué. Rappeler
que le push est manuel : `git push` puis `gh stack submit --auto --open` quand
le développeur est prêt, et `gh stack merge` une fois les PR revues. Pas de
récap du code écrit.
