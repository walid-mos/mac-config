# Instructions globales

## Estimation

- **Ne jamais estimer en temps de travail** (heures, jours, semaines). Toujours estimer en **difficulté**, en utilisant l'analogie des tailles de moteur :
  - **V12** - effort énorme, complexité maximale, risque élevé (ex : refonte d'archi, nouveau produit).
  - **V8** - gros chantier, plusieurs sous-systèmes, intégrations multiples.
  - **I6** - feature substantielle, périmètre clair mais non-trivial.
  - **I4** - tâche standard, périmètre cerné, peu de risque.
  - **I3** - petite tâche, modification ponctuelle, faible risque.
- Cette règle s'applique partout : interviews de planification, backlog Linear, plans HTML, discussions ad-hoc, recommandations d'architecture.
- Si l'utilisateur insiste pour une estimation temporelle, redemander confirmation avant de produire une durée.

## Git & GitHub

- **Ne jamais ajouter `Co-Authored-By: Claude ...`** dans les messages de commit.
- **Ne jamais ajouter** la ligne `🤖 Generated with [Claude Code](https://claude.com/claude-code)` dans les bodies de PR.
- Les commits et PRs doivent apparaître comme rédigés uniquement par l'utilisateur, sans aucune trace d'attribution à Claude.

## Execution discipline

- **Read before you write.** Before adding or modifying code, read the target file's exports, its callers, and the shared utilities it depends on. Never create a helper that duplicates one already in the codebase — find it and reuse it.
- **Surface conflicts, don't average them.** If two patterns coexist in the codebase for the same problem, pick one explicitly and flag the inconsistency to the user. Never produce a third hybrid pattern that silently blends them.
- **LLM only for judgment calls.** Use the model for tasks that genuinely require judgment: classification, drafting, summarization, extraction. Never delegate to the model what deterministic code can do — routing, retries, status-code handling, deterministic transforms. If code can answer, code answers.
- **Fail loud.** Never report "completed successfully" if any part of the work was silently skipped, ignored, or approximated. Surface uncertainty (missing records, unverified steps, unconfirmed assumptions) instead of hiding it behind apparent success.

## Greenfield par défaut — pas de fallback, pas de migration

### HARD RULE — c'est la règle la plus importante du repo

**Toujours greenfield. Jamais de fallback. Jamais de migration.** Sauf si l'utilisateur le demande **explicitement et précisément**, tu écris l'implémentation propre et directe, point. **Aucun critère ne surpasse cette règle.**

- **Pas de fallback** : ne jamais ajouter de code de repli (`try X else legacy Y`, double-écriture, branche de compat, garde "au cas où"). Une seule voie, la bonne.
- **Pas de migration** : ne jamais écrire de script de migration, de bridge, d'adaptateur de transition, ni conserver l'ancien code à côté du nouveau.
- **Pas de backup** : ne jamais dupliquer/sauvegarder l'ancienne version "pour sécurité". On remplace, on ne conserve pas.
- **Greenfield** : implémentation neuve et directe, comme si le legacy n'existait pas.

### APIs

- **Respecter l'API existante par défaut.** Ne pas la modifier de ta propre initiative.
- Si une **spec demande explicitement** de changer l'API → tu fais le changement **en greenfield** : tu réécris proprement la nouvelle forme. **Pas de backup, pas de migration, pas de couche de compat** — sauf demande expresse de l'utilisateur.

### La seule exception

L'utilisateur dit **précisément et explicitement** qu'il veut un fallback, une migration ou un backup. Tant que ce n'est pas dit noir sur blanc, la réponse par défaut est **greenfield, rien d'autre**. Dans le doute → demander, ne jamais présumer qu'un fallback/une migration est souhaité. Vaut **surtout sur les features**.

## Subagent routing

### HARD RULE — tout fichier React passe OBLIGATOIREMENT par `react-implementer`

Dès que tu écris, modifies ou refactors du code **React** (`.tsx` / `.jsx`, ou tout fichier qui importe React / utilise du JSX), tu **dois déléguer au subagent `react-implementer`**. **Aucune exception, aucun critère ne surpasse cette règle.**

- **INTERDIT sur le main thread** : ne JAMAIS éditer un fichier React directement depuis le thread principal — pas même une modif triviale (une prop, un import, un `className`, un typo dans du JSX). Le main thread ne charge pas la doctrine (`coding`, `javascript`, `typescript`, `react` skills) et produit du code qui viole les règles du repo (SOLID/composition, useEffect, état dérivé, etc.).
- **INTERDIT via un subagent générique** : déléguer du travail React à `general-purpose`, `Plan`, `Explore` ou tout autre subagent qui n'est pas `react-implementer` est tout aussi proscrit, pour la même raison (doctrine non chargée).
- **Seule voie autorisée pour écrire du React** : `react-implementer`, et lui seul.
- Le main thread garde le droit de **lire / explorer** du React (comprendre, planifier, router), d'éditer des fichiers **non-React** (docs `.md`, config, scripts) et d'orchestrer la délégation. Lire est autorisé ; **écrire/éditer un fichier React ne l'est pas**.

Règle mnémotechnique : pour écrire du React, c'est **`react-implementer` ou rien**. Jamais le main thread, jamais un autre agent.

## Build-or-Borrow — gate avant écriture de code

### HARD RULE — platform-native a précédence absolue

Si un outil, framework, action ou SDK déjà présent dans le projet fournit nativement la feature demandée, on l'utilise. **Aucun critère ne surpasse cette règle.** Réécrire un job, un script ou un helper à côté d'une feature native est un bug, jamais une décision défendable.

Exemples canoniques à vérifier avant de coder :
- Une action GitHub déjà utilisée → lire son README et lister ses inputs avant d'ajouter quoi que ce soit autour (cas `tauri-action` + `uploadUpdaterJson`).
- Un framework déjà en place → utiliser ses primitives (`<Image>` Next.js, endpoints Astro, hooks React) avant d'en réimplémenter une variante.
- Un SDK déjà installé → utiliser ses helpers documentés avant d'écrire le tien.

Red flag : tu te retrouves à écrire un fichier à côté d'un outil pour lui faire faire ce qu'il sait déjà faire → arrêt immédiat, retour à la doc de l'outil.

### Quand le gate s'applique

- Nouvelle intégration avec un outil tiers (action GH, SDK, lib non déjà utilisée).
- Domaine listé dans la colonne **Borrow par défaut** ci-dessous.
- Ajout d'une nouvelle dépendance au `package.json` (ou équivalent).
- Helper générique de plus de ~30 LOC qui sent le truc déjà résolu ailleurs.

Le gate **ne s'applique pas** pour : business logic propre, refacto pur, tests, scripts one-shot internes, modifs triviales.

### Artefact obligatoire avant toute écriture de code

```
## Build-or-Borrow Probe
- Besoin: <1 ligne>
- Voie platform-native: <feature de l'outil déjà intégré, sinon "n/a">
- Voie DIY: <approche + ~LOC + footgun>
- Voie borrow: <package candidat + maturité/poids>
- Précédent repo: <résultat grep>
- Décision: <use-platform-native | DIY | borrow | reuse-repo>
- Pourquoi: <critère explicite>
```

Si une ligne est vide ou bullshit → blocage, on ne code pas. Si `Voie platform-native` est non-`n/a`, la décision **doit** être `use-platform-native` (cf. HARD RULE).

### Défauts par catégorie (en l'absence de platform-native)

**Borrow par défaut** — footgun trop élevé ou spec mouvante : dates / fuseaux / calendrier (date-fns, Temporal), crypto / hashing, parsing de formats complexes (CSV, YAML, ICS, MIME), validation de schéma (Zod, Valibot), i18n et formats de nombre, markdown, charts, drag-and-drop, auth / JWT.

**DIY ou natif par défaut** — package = overkill : `fetch` HTTP simple, JSON, utilities <30 LOC (debounce, chunk, capitalize, sleep), business logic propre, wrappers fins autour d'un primitive natif.

**Reuse repo-existing par défaut** : logger, helpers, patterns déjà présents. `grep` du repo obligatoire avant d'ajouter tout helper générique.

## NextNode - Contexte business

NextNode est l'activité de conseil de l'utilisateur. Garder ce contexte en tête pour toute recommandation d'architecture, packaging ou tooling.

- **Owner**: freelance software engineer growing NextNode into a structured agency.
- **Tech stack**: Node.js, Astro, React.
- **Target clientele**: French PME/ETI (SMBs and mid-caps).
- **Product positioning**: externalized CTO - owns the full IT scope, small projects to large ones.
- **Freelance clients** (personal, billed outside NextNode): large enterprises - Hermès, Certigo, Allianz Trade. These inform quality standards but are not the NextNode target.
- **Current NextNode clients**: early-stage, low-stakes work (florist, friend's static site). Not representative of the target - the business is in a ramp-up phase.

**How to apply**: favor solutions that scale from solo-operator to small-team delivery, prioritize developer-ergonomics and reusability across client projects, and pitch recommendations at a PME/ETI budget and maturity level (not enterprise, not toy project).
