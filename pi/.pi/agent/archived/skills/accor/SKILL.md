---
name: accor
user-invocable: true
description: >-
  Règles OBLIGATOIRES du client Accor (monorepo product-data-apps : @astore/api,
  @astore/menu-compliance, @astore/ui, apps/portail, apps/product-benchmark).
  Nomenclature git (branches, commits, titres de PR), périmètre intouchable
  (Terraform, product-benchmark), architecture (Clean Arch côté api, FSD côté
  fronts), modèle d'auth (data mart Snowflake), baseline qualité. À appliquer pour
  product-data-apps et ses worktrees (noms product-data-apps*), pas pour tout
  clients/accor. Trigger on /accor, ou dès qu'un fichier du monorepo
  product-data-apps (ou d'un worktree associé) est touché (branche, commit, PR, code).
---

# accor — règles obligatoires du monorepo product-data-apps

Contexte figé du client **Accor**, repo `product-data-apps`. Ces règles ne sont pas
optionnelles : elles priment sur les habitudes par défaut. Ce skill est la source
privée transverse. Les `AGENTS.md` existants des apps/packages (`apps/api/`,
`apps/*/` …) sont les sources de vérité détaillées locales.

## 1. Nomenclature git — non négociable

**Branches** : `<type>/<TICKET?>-<kebab-desc>`.
- `<type>` ∈ `feat` `fix` `chore` `docs` `refactor` `test` (le type dominant du diff).
- `<TICKET>` = l'id Jira quand le travail en a un (`DA-178`) ; **omis** s'il n'y en a pas
  (ex. `feat/pre-push-ai-review`).
- Exemples valides : `feat/DA-178-partners-api`, `refactor/auth-context-identity`,
  `fix/invoice-upload-timeout`.
- **Interdit** : index de stack dans le nom (`-01-`, `-02-`), noms libres non préfixés
  (`auth-rewire-02-server-authority`), `mc-partners-05-...`.

**Titres de PR** : Conventional Commit `<type>(scope): <description>`.
- Avec ticket, le style repo est `<type>(scope): DA-xxx — <description>`
  (ex. `feat(menu-compliance): DA-178 — partners CRUD view`).
- `<scope>` = zone touchée : `api`, `menu-compliance`, `ui`, `benchmark`, `auth`, `hooks`.

**Commits** : Conventional Commits, mêmes types/scopes. Atomiques — un commit compile et
teste seul. Impératif, expliquer le *pourquoi* quand il n'est pas évident.

**Base & flux** : brancher depuis `develop` à jour ; ouvrir la PR **contre `develop`**
(intégration → déploie l'env *dev* ; `main` = *prod*, promotions uniquement).

**Stacks** : via `gh stack`. Découpage : contrat Stack
([slicing.md](../../archived/skills/stack/references/slicing.md), archivé avec
l'ancienne pile d'orchestration) — pas de seuils ni d'algorithme
ici. Ordre livré : `dev → simplify maillon → simplify global → submit`.

> ⚠️ **Renommer une branche sur GitHub FERME ses PR** (le head ref est immuable, l'ancien
> nom disparaît → GitHub ferme la PR). Corollaire : **nommer correctement dès la création**.
> Une PR ne se supprime pas sur GitHub (seules les *issues* le peuvent) — une fermée reste en
> historique. Si un renommage a fermé des PR, recréer les PR sur les nouvelles branches et
> laisser `Superseded by #NN` sur les anciennes.

## 2. Périmètre — intouchable

- **JAMAIS Terraform / `infra/` / `*.tf`.** Sous aucun prétexte, même « juste une variable ».
- **JAMAIS `apps/product-benchmark`** (ni `apps/portail`) sauf demande explicite.
- Zone de travail Menu Compliance : `apps/api`, `apps/menu-compliance`, `packages/ui` et
  `packages/oxlint-config` si un partagé couplé l'exige. Toute sortie de ce périmètre se
  signale et se justifie **avant** de committer.

## 3. Architecture

- **`apps/api`** : Clean Architecture + DDD + CQRS + tRPC. Direction des dépendances
  `domains ← application ← infrastructure`, jamais l'inverse. Pas d'import cross-app.
  Frontières vérifiées par `dependency-cruiser` (`pnpm lint`). Détail : `apps/api/AGENTS.md`.
- **Fronts** (`menu-compliance`, `portail`, `product-benchmark`) : **Feature-Sliced Design**.
  Import strictement vers le bas (`pages → widgets → features → entities → shared`), jamais
  latéral ni montant. Public API par slice (`index.ts`). Détail : `apps/menu-compliance/AGENTS.md`.
- **Front product-data-apps vs proto** : invariant privé dans
  `clients/accor/AGENTS.md` (section *product-data-apps — front uniquement*). Ticket =
  scope ; proto déployé = vérité visuelle/comportementale **dans ce scope** ;
  inspecter le repo source puis **réimplémenter** (pas copier). Même politique hors
  `/accor-ship`.
- **Auth** : SSO authentifie l'**identité seule** (`{sub, email}`) ; `role` + `segment`
  proviennent du **data mart Snowflake**, jamais du JWT ni du client ; la whitelist
  (`whitelisted_emails`) est un **guard 403 manuel** rempli par SQL, **jamais** la source du
  rôle. Détail : `apps/menu-compliance/AGENTS.md` et `apps/api/AGENTS.md`.

## 4. Qualité

- **Aucun commentaire narratif.** Une ligne max, seulement une contrainte/invariant que le
  code ne peut pas exprimer. Jamais paraphraser le code ni s'adresser au reviewer.
- **Baseline avant « fini »** : `pnpm typecheck && pnpm lint && pnpm test` verts — sortie
  réelle, jamais supposée. Le front lit les types depuis le *build* de l'api
  (`pnpm --filter @astore/api build` avant de typechecker un front).
- **i18n** : un seul catalogue `shared/i18n/locales/*.json`, un seul lookup `t()`. Ajouter
  chaque clé dans `fr.json` **et** `en.json`.
- Pas d'`as` (sauf `as const`) ; valider/narrower à la place.

## 5. Lecture Jira / Confluence via API REST

Un profil `authFetch` nommé `accor` est configuré dans `~/.config/pi/web-search.json`.
Il utilise les cookies de la session Chrome pour t'authentifier sur
`accor-eprocurement-support.atlassian.net`.

**Ne JAMAIS fetcher une page Jira/Confluence en HTML** — ce sont des SPA dont le
contenu utile est chargé dynamiquement en JS. Toujours utiliser l'API REST.

### Lire un ticket Jira

```
URL exemple : https://accor-eprocurement-support.atlassian.net/browse/DA-176
API        : GET /rest/api/3/issue/{TICKET_KEY}
```

Extraire la clé du ticket (ex: `DA-176`) depuis l'URL et l'injecter dans l'endpoint REST :

```
fetch_content(auth: "accor", url: "https://accor-eprocurement-support.atlassian.net/rest/api/3/issue/DA-176")
```

### Lire une page Confluence

```
URL exemple : https://accor-eprocurement-support.atlassian.net/wiki/spaces/MID/pages/2043871247/...
API        : GET /wiki/api/v2/pages/{PAGE_ID}?body-format=atlas_doc_format
```

Extraire le `PAGE_ID` (entier) depuis l'URL Confluence (segment après `/pages/`).

```
fetch_content(auth: "accor", url: "https://accor-eprocurement-support.atlassian.net/wiki/api/v2/pages/2043871247?body-format=atlas_doc_format")
```

Le format `atlas_doc_format` renvoie du JSON ADF structuré. Si le fetch est tronqué
(limite 30k caractères), utiliser `get_search_content` avec le `responseId` et `offset`
pour récupérer la suite.

## 6. Skills liés

- `/accor-ship` — livrer une feature Menu Compliance en stack de PR (périmètre + proto figés).
- `/accor-review` — review dédiée Accor.
- `/accor-wording` — audit du drift de wording contre le proto.
- `/accor-teams-pr` — message Teams d'annonce des PR à review.
