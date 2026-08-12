---
name: accor-wording
description: Audit exhaustif du wording FR/EN de @astore/menu-compliance contre le proto drinks-menu-compliance (source de vérité), via swarm multi-agents avec vérification adversariale. Trigger on /accor-wording, "audit le wording", "check le drift de wording", "vérifie le wording contre le proto".
---

# accor-wording — audit de drift de wording contre le proto

Vérifie que chaque chaîne visible par l'utilisateur dans
`apps/menu-compliance` est **strictement identique** (au caractère près) au
wording du prototype [drinks-menu-compliance](https://github.com/VianneyBertrand/drinks-menu-compliance),
la source de vérité. FR **et** EN.

## Procédure

1. **Clone frais du proto** dans le scratchpad (jamais de copie stale) :
   `git clone --depth 1 https://github.com/VianneyBertrand/drinks-menu-compliance <scratchpad>/proto`
2. **Checks déterministes d'abord** (inline, pas d'agent) :
   - Parité de clés fr/en :
     `diff <(jq -r 'paths(scalars)|join(".")' fr.json | sort) <(jq -r 'paths(scalars)|join(".")' en.json | sort)`
   - Chaînes FR en dur hors catalogue :
     `grep -rln "[éèêàçùûôîœ]" src --include="*.tsx" --include="*.ts" | grep -v test | grep -v i18n`
     → chaque hit hors `shared/i18n` doit être justifié ou couvert par un lecteur.
3. **Swarm** : lancer le workflow embarqué, avec les chemins en `args` :
   ```
   Workflow({
     scriptPath: "~/.claude/skills/accor-wording/workflow.js",  // chemin absolu résolu
     args: { APP: "<repo>/apps/menu-compliance", PROTO: "<scratchpad>/proto" }
   })
   ```
   Le script fan-out 5 lecteurs sonnet (catalogue i18n, sidebar/workspace BO,
   pages+panneaux BO, côté hôtel, auth/gates/erreurs), déduplique en code,
   filtre les exclusions, puis vérifie chaque finding restant avec un opus
   adversarial. Fable reste orchestrateur/synthétiseur — aucun subagent sur Fable.
4. **Synthèse** (boucle principale) : spot-checker inline 2–3 findings limites
   dans les fichiers proto avant de les reporter. Livrer : verdict global,
   findings confirmés groupés par écran (tableau App vs Proto + protoRef),
   réfutés avec raison, exclus, compteurs honnêtes
   (bruts → dédup → exclus → confirmés → réfutés, fichiers lus).

## Règles de périmètre (décisions actées — ne pas re-litiger)

- **Écrans 403 / 404 / 500 (`ForbiddenPage`, `NotFoundPage`, `GateError`) :
  exclus** tant qu'ils ne sont pas réellement implémentés. Le workflow les
  classe dans `excluded` (pas des findings). Le jour où ils sont implémentés,
  retirer les patterns correspondants de `EXCLUDED_PATHS`/`EXCLUDED_KEYS` dans
  `workflow.js` — le wording proto de référence est
  `proto/src/components/errors/*.tsx` + `proto/docs/pages-erreur.md`
  (notamment : bouton « Se déconnecter », jamais « Changer de compte »).
- **`LoginPage` : exclue** — écran jetable, remplacé au cutover OIDC.
- **Textes d'erreur inventés par l'app** pour des états que le proto ne
  modélise pas (le proto n'émet aucun toast d'erreur : `deleteConflict`,
  `undoFailed`, `error` générique, échecs réseau) : **pas des findings**.
  Les lister en remarques — ils n'ont pas de source de vérité, à faire valider
  par Vianney si le 100 % strict doit les couvrir.
- **FR figé dans l'EN du proto** (ex. pagination) : l'app qui traduit
  proprement n'est **pas** un drift.
- **aria-labels / title / placeholders comptent** comme wording (severity
  basse s'ils sont invisibles à l'écran, normale si tooltip/placeholder visible).
- Une feature du proto absente de l'app n'est pas un finding ; un texte
  manquant ou différent sur un écran implémenté en est un.
- Un écran de l'app sans équivalent proto suit le pattern « page en
  attente » : `h1` = titre de nav, rien d'autre (cf. `AnalysesPage`,
  `CampaignsPage`, `ComplianceFilesPage`). « À venir. » (`ComingSoonPanel`)
  n'existe que pour les onglets internes de `BarProgrammePage`. Tout
  titre/texte inventé ailleurs est un finding `extra-text`.

## Sources de wording

| Côté | Où |
|---|---|
| App | `src/shared/i18n/locales/fr.json` + `en.json` (catalogue unique), chaînes en dur résiduelles dans les tsx |
| Proto | `src/lib/backoffice-i18n.ts`, `src/lib/hotel-i18n.ts`, en dur dans `src/components/**`, décisions de rédaction dans `docs/` (ex. `pages-erreur.md`) |

## Correction (si demandée)

Suivre le skill `accor` : branche `fix/<kebab>` depuis `develop` à jour,
commits atomiques Conventional Commits, baseline
`pnpm --filter @astore/api build && pnpm typecheck && pnpm lint && pnpm test`
verte, PR contre `develop`. Précédent : PR #128.
