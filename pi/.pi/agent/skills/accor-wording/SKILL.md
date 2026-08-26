---
name: accor-wording
user-invocable: true
description: >-
    Audit exhaustif du wording FR/EN de @astore/menu-compliance contre le proto
    drinks-menu-compliance (source de vérité), via local execution multi-agents avec
    vérification adversariale. Trigger on /accor-wording, "audit le wording",
    "check le drift de wording", "vérifie le wording contre le proto".
---

# accor-wording — audit de drift de wording contre le proto

Vérifie que chaque chaîne visible par l'utilisateur dans
`apps/menu-compliance` est **strictement identique** (au caractère près) au
wording du prototype [drinks-menu-compliance](https://github.com/VianneyBertrand/drinks-menu-compliance),
la source de vérité. FR **et** EN.

## Phase 0 — Setup (you, inline)

```bash
git clone --depth 1 https://github.com/VianneyBertrand/drinks-menu-compliance /tmp/proto-accor-wording
```

- `APP=<repo>/apps/menu-compliance`
- `PROTO=/tmp/proto-accor-wording`

List files per scope with `git ls-files` (APP) and `find` (PROTO). Embed the
**explicit sorted lists** in `UNITS`. Children never re-derive the partition.

## Phase 1 — Checks déterministes (inline, pas d'agent)

1. **Parité de clés fr/en** :
   `diff <(jq -r 'paths(scalars)|join(".")' fr.json | sort) <(jq -r 'paths(scalars)|join(".")' en.json | sort)`
2. **Chaînes FR en dur hors catalogue** :
   `grep -rln "[éèêàçùûôîœ]" src --include="*.tsx" --include="*.ts" | grep -v test | grep -v i18n`
   → chaque hit hors `shared/i18n` doit être justifié ou couvert par un lecteur.

## Phase 2 — Fan-out (verbatim)

### Scopes (`UNITS` keys)

| Key                    | Scope app (`apps/menu-compliance`)                                               | Scope proto                                                            |
| ---------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `catalogue-i18n`       | `src/shared/i18n/locales/fr.json` + `en.json`, mécanique `t()`                   | `src/lib/backoffice-i18n.ts`, `src/lib/hotel-i18n.ts`, composants      |
| `bo-sidebar-workspace` | `src/widgets/bo-sidebar/`, `src/entities/workspace/`, `src/entities/session/`    | `src/components/backoffice/`, `src/lib/backoffice-i18n.ts`             |
| `bo-pages-panels`      | `src/pages/back-office-home/`, pages CRUD, widgets, entités catégorie/partenaire | `src/pages/backoffice/`, `src/components/backoffice/`, backoffice-i18n |
| `hotel-side`           | `src/pages/hotel-home/`, `src/pages/bar-programme/`, hôtel features              | `src/components/hotel-home/`, `hotel-demo/`, `steps/`, hotel-i18n      |
| `auth-gates-errors`    | `src/pages/login/`, forbidden/not-found, gates, navigation                       | `src/components/auth/`, `src/components/errors/`, pages-erreur.md      |

### Reader task (every `reader`)

```
Audit question: every user-visible string in the app (i18n, hardcoded, aria-label, placeholder, title, errors, tooltips) must match the proto for the SAME screen/element, character-exact, FR and EN.

App: <APP>. Proto (source of truth): <PROTO>.
Your partition (read ALL of these files):
- …

RULES:
- App implements a subset of the proto: a proto-only feature is NOT a finding.
- Character-exact: accents, case, punctuation, ’ vs ', nbsp, … vs ...
- Cite protoRef as file:line. No proto equivalent → category=extra-text, protoText="", protoRef="introuvable".
- Forbidden: style opinions. Categories: wording-mismatch, missing-text, extra-text, translation-mismatch, punctuation-case.
- Severity: high (user-visible), medium (rare), low (aria/technical placeholder/tooltip).
```

### EXCLUDE (before any verifier)

| Écran / classe                                                         | Raison                                  |
| ---------------------------------------------------------------------- | --------------------------------------- |
| `pages/forbidden/`, `pages/not-found/`, `app/ui/GateError`             | Pages d'erreur non encore implémentées  |
| `pages/login/`                                                         | Écran jetable, remplacé au cutover OIDC |
| Textes d'erreur inventés (deleteConflict, undoFailed, error générique) | Proto ne modélise pas ces toasts        |
| FR figé dans l'EN du proto que l'app traduit proprement                | Pas un drift                            |

Verifier extra: invented error toasts and proto-FR-stuck-in-EN that the app translates → `isReal=false`.

## Phase 3 — Synthèse

Rapport : verdict, findings confirmés groupés par écran, réfutés avec raison,
exclus, compteurs (units, failed, filesRead, raw → triaged → confirmed →
rejected). `stats.failed` must appear.

## Correction (si demandée)

Suivre le skill `accor` : branche `fix/<kebab>` depuis `develop` à jour,
commits atomiques Conventional Commits, baseline
`pnpm --filter @astore/api build && pnpm typecheck && pnpm lint && pnpm test`
verte, PR contre `develop`.
