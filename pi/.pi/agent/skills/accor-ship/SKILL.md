---
name: accor-ship
user-invocable: true
description: >-
    Développer une feature du produit Menu Compliance (front @astore/menu-compliance
    + API @astore/api) dans le monorepo accor product-data-apps, en stack de PR :
    chaque maillon implémenté via local execution (front/code en parallèle avec 1:1 proto
    fidélité), simplify par maillon puis global, sous le /goal auto-continue loop.
    Trigger on /accor-ship, ou quand l'utilisateur décrit une feature Menu
    Compliance à livrer dans ce repo.
---

# accor-ship

Livrer une feature de **Menu Compliance** dans le monorepo accor
`product-data-apps`, en **stack de PR lisibles**. C'est `/ship` avec le contexte
produit accor figé : périmètre, prototype source, et règles d'intégration ci-dessous
sont acquis — l'utilisateur ne fournit que **la feature** (et un ticket au besoin).

## Arguments

`/accor-ship <description de la feature> [référence ou contenu du ticket] [options]`

- `<description>` (requis) — la feature à livrer. Seule source de vérité avec le
  ticket éventuel.
- `[ticket]` — lien, identifiant ou texte collé du ticket. Le lire en entier avant
  d'écrire du code ; ne jamais inventer son contenu de mémoire.
- Options `/ship` acceptées telles quelles : `--base` (défaut : `develop`),
  `--no-worktree`, `--no-chrome`, `--max-files`, `--max-lines`, `--no-stack`,
  `--stop-before-pr`, `--dry-run`.

## Périmètre — figé, non négociable

| Touche                                                                                                | Ne touche pas                                          |
| ----------------------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `apps/menu-compliance` (front, `@astore/menu-compliance`)                                             | `apps/product-benchmark` — jamais, sous aucun prétexte |
| `apps/api` (back, `@astore/api`) — pour l'API dont la feature a besoin                                | `apps/portail` sauf demande explicite                  |
| `packages/ui`, `packages/oxlint-config` si un changement partagé l'exige et reste couplé à la feature |                                                        |

Toute modification hors de ce périmètre se signale et se justifie avant de committer.

## Prototype source & récupération des assets

**Source de vérité ultime côté front : le prototype déployé
`https://drinks-menu-compliance-vite.vercel.app/`.** Code source :
`https://github.com/VianneyBertrand/drinks-menu-compliance`.

**TOUT développement front doit être une copie 1:1 exacte, visuellement, du
prototype déployé.** Pixel, couleurs, espacements, typographie, layout, états,
animations : identiques. Aucune interprétation, aucune « amélioration » visuelle.
En cas de doute sur un rendu, l'URL déployée tranche — pas le code, pas le goût.

C'est un prototype produit par un LLM : **rendu visuel exactement ce qu'on veut**,
**code de très mauvaise qualité**. Deux règles opposées :

1. **Fidélité visuelle totale (1:1).** Récupérer _obligatoirement tous les assets
   visuels_ — images, icônes, SVG, polices, tokens de couleur, espacements,
   structure de layout. Le rendu final doit être indiscernable du prototype déployé.
2. **Code réécrit, pas copié.** Ne jamais recopier le code du prototype tel quel.
   L'intégrer dans notre stack (React + TS + conventions `@nextnode-solutions/*`),
   propre, testable, SOLID. Les skills `react`, `typescript`, `coding`, `nextnode-*`
   ne sont pas optionnels.

### Limite d'autorité du prototype — visuel/front SEULEMENT

L'autorité du proto s'arrête à **ce qui s'affiche** : pixels, layout, libellés,
états, comportements d'écran. Tout le reste du proto est vibecodé et **n'a aucune
autorité** : back, API, hooks, stores, et **surtout modèle de données / base**.

- **INTERDIT** de dériver du proto un schéma DB, des colonnes, un modèle de données,
  des valeurs par défaut persistées, une règle métier ou une décision produit lue
  dans son code (`src/lib/*`, commentaires de débriefs, fixtures, localStorage).
  Le proto montre _ce que l'écran affiche_, jamais _comment on le stocke_.
- Sources de vérité côté back : **le ticket/la spec**, l'architecture du repo
  (`AGENTS.md`), et l'existant en base. Le modèle de données se conçoit depuis le
  besoin, pas depuis les types du proto.
- Toute décision métier qui n'apparaît que dans le code du proto (structure d'un
  barème, valeurs, cas limites, vocabulaire persisté) est une **hypothèse à faire
  valider par l'utilisateur en Phase 1** — via `ask_user_question` — avant d'être
  gravée en schéma DB ou en contrat API. La citer avec sa source ; ne jamais la
  présenter comme acquise.
- Ce qui reste légitime à lire dans le proto pour le back : les libellés affichés
  et la forme des écrans, pour dimensionner les DTO _après_ validation du modèle.

Récupérer le proto : `git clone` du repo en scratchpad ou lecture via `gh`/WebFetch
pour inventorier assets et markup ; ouvrir l'URL déployée via `/visual-check`
comme référence visuelle de contrôle. Ne pas ajouter le proto comme dépendance ni le
laisser traîner dans le repo.

## Repo — commandes détectées

- Package manager : `pnpm` (workspace + turbo). Ne jamais `npm`/`yarn`.
- Dev de la feature : `pnpm dev:compliance` (lance `@astore/api` + le front compliance).
- Tests / lint / typecheck : `pnpm test`, `pnpm lint`, `pnpm typecheck`
  (turbo ; filtrer au besoin `--filter @astore/menu-compliance` / `@astore/api`).
- Format : `pnpm format`.
- Base de départ du stack : `develop` (pas `main`).
- Conventions de commit : conventional commits (commitlint actif). Commits atomiques.
- Lire le `CLAUDE.md` de `apps/menu-compliance` et de `apps/api` avant de coder.

## Architecture API — conventions (ne jamais enfreindre)

Côté `apps/api`, le module `menu-compliance` est en clean archi. Deux layers,
`application/` (use cases) et `domains/` (entités + ports). Sous chaque layer :
un dossier par **bounded context** (`catalogue`, `workspaces`, `access`,
`file-storage`…), et sous un BC **un dossier par agrégat** dès qu'il grossit.

```
apps/api/src/menu-compliance/
  application/<bc>/<agrégat>/<use-case>.ts   # 1 handler par fichier, DTO input/output colocalisé
  domains/<bc>/<agrégat>/<x>.entity.ts       # données du domaine, rien d'autre
  domains/<bc>/<agrégat>/<x>.repository.ts    # port + les results que le repo RETOURNE
  domains/<bc>/<value-object>.ts             # partagé dans le BC → racine du BC (ex. segment.ts)
```

- **Un use case = un fichier** (`create-partner.ts`, `list-partners.ts`…), avec
  son DTO d'entrée/sortie **dans le même fichier**. Pas de fusion multi-handlers.
- **INTERDIT — dossiers `commands/` et `queries/`** (bucket CQRS par nature).
  **INTERDIT — fichier `types.ts`** fourre-tout. Les types vivent avec leur use case.
- Délimiter par agrégat (`partners/`, `categories/`, `products/`, `rules/`…) au
  lieu d'empiler à plat dans le BC. Un value object partagé reste à la racine du BC.
- Placement d'un type de result : s'il est **retourné par le repo**, il va dans
  `*.repository.ts` ; s'il est **composé par le handler**, il reste avec le handler.
  `*.entity.ts` ne contient que des données du domaine, jamais un DTO d'app.

## Stack — sur quel maillon committer

Un correctif/refactor s'applique sur **le maillon qui a introduit le fichier**,
jamais sur un maillon aval. Avant de committer dans un stack :
`git log --all --source -- <fichier>` pour trouver la branche d'origine, committer
**là**, puis restack l'aval. Ne jamais poser un commit API sur la PR de la vue.

## Objectif — engager le loop /goal

Appeler `goal_set` avec la condition accor :

```
goal_set({ condition: "Feature Menu Compliance livrée : stack soumis depuis develop,
  tous les tickets Done (ou bloqués listés), tests/lint/typecheck verts,
  /simplify par maillon et global effectués, /visual-check 1:1 vs proto
  (screenshots dans le transcript, drinks-menu-compliance-vite.vercel.app),
  apps/product-benchmark intact,
  descriptions de PR conformes à .github/PULL_REQUEST_TEMPLATE.md. Stop after 30 turns." })
```

L'extension `/goal` auto-continue de tour en tour. Règles : **prove don't
declare**, un step vérifiable par tour, aucune question en cours de route.

## Exécution — déléguer à `/ship`

Cette feature se livre via le workflow **`/ship`**, avec les valeurs accor
ci-dessus injectées. Invoquer le skill `ship` et suivre ses phases, en respectant
en plus :

- **Base** : `develop` par défaut (`--base develop`).
- **Découpe** : la couche « assets + intégration visuelle » et la couche « API »
  forment des maillons distincts quand le budget l'impose ; les regrouper seulement
  si fortement couplés.
- **`/visual-check` obligatoire** (sauf `--no-chrome`) : dès qu'un maillon
  touche le front, charger le skill `visual-check`. Lancer `pnpm dev:compliance`,
  ouvrir en parallèle le prototype déployé
  (`https://drinks-menu-compliance-vite.vercel.app/`) et l'app locale, naviguer
  le même parcours (`frontend_act`) et vérifier que le rendu est une **copie 1:1**
  (screenshots côte à côte) plus une console propre. Le moindre écart visuel =
  maillon non fini. Ne pas déclarer un maillon front fini sans cette comparaison.
- **`/simplify` par maillon** : charger le skill `simplify` sous **son** contrat
  (`/simplify maillon`), avant le maillon suivant.
- **`/simplify` global** : skill `simplify` sous son contrat (`/simplify global`),
  avant `submit`. Propager (`gh stack rebase`) si un correctif touche le bas.
- **Submit** : `gh stack submit` seulement après les deux passes `/simplify`.
  Pas d'auto-merge.
- **Descriptions de PR** : chaque PR du stack suit **strictement**
  `.github/PULL_REQUEST_TEMPLATE.md` du repo (sections Ticket — ou justification
  de son absence dans le Summary —, Summary, Scope coché, Changes, How was this
  tested?, Checklist). Jamais de structure libre. Vérifier chaque corps contre le
  template avant de considérer le submit fini ; `gh stack submit` ne le fait pas
  tout seul — repasser en `gh pr edit --body-file` si besoin. Même contrainte
  en `--no-stack` : le skill `pr` ne connaît pas le template Accor — réécrire
  le body avant de considérer le submit fini.

## Definition of done

- La feature est livrée en entier, ou le reste est listé comme bloqué avec sa raison.
- Aucun schéma DB, contrat API ou décision métier n'est dérivé du code du proto ;
  toute hypothèse métier issue du proto a été validée par l'utilisateur en Phase 1.
- Rendu du front **copie 1:1 du prototype déployé**
  (`https://drinks-menu-compliance-vite.vercel.app/`), assets récupérés, comparé
  côte à côte via `/visual-check` (screenshots dans le transcript) ; code réécrit
  propre — jamais le code du proto copié.
- `apps/product-benchmark` intact.
- Découpé en maillons sous budget, chacun compilant et testant vert seul, plusieurs
  commits atomiques par maillon.
- `pnpm test`, `pnpm lint`, `pnpm typecheck` verts sur tout le stack — sortie réelle.
- `/simplify` a tourné **par maillon puis en global**, correctifs commités et testés.
- Stack de PR soumis depuis `develop` (`gh stack submit`), sauf `--stop-before-pr`.
- Chaque description de PR est conforme à `.github/PULL_REQUEST_TEMPLATE.md`.
