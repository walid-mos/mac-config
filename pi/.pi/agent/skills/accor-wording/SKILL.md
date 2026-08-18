---
name: accor-wording
description: Audit exhaustif du wording FR/EN de @astore/menu-compliance contre le proto drinks-menu-compliance (source de vérité), via local execution multi-agents avec vérification adversariale. Trigger on /accor-wording, "audit le wording", "check le drift de wording", "vérifie le wording contre le proto".
---

# accor-wording — audit de drift de wording contre le proto

Vérifie que chaque chaîne visible par l'utilisateur dans
`apps/menu-compliance` est **strictement identique** (au caractère près) au
wording du prototype [drinks-menu-compliance](https://github.com/VianneyBertrand/drinks-menu-compliance),
la source de vérité. FR **et** EN.

## Phase 0 — Setup

```bash
git clone --depth 1 https://github.com/VianneyBertrand/drinks-menu-compliance /tmp/proto-accor-wording
```

Définir les variables :

- `APP=<repo>/apps/menu-compliance`
- `PROTO=/tmp/proto-accor-wording`

## Phase 1 — Checks déterministes (inline, pas d'agent)

1. **Parité de clés fr/en** :
   `diff <(jq -r 'paths(scalars)|join(".")' fr.json | sort) <(jq -r 'paths(scalars)|join(".")' en.json | sort)`
2. **Chaînes FR en dur hors catalogue** :
   `grep -rln "[éèêàçùûôîœ]" src --include="*.tsx" --include="*.ts" | grep -v test | grep -v i18n`
   → chaque hit hors `shared/i18n` doit être justifié ou couvert par un lecteur.

### Scopes des 5 lecteurs

| Key                    | Scope app (dans `apps/menu-compliance`)                                          | Scope proto                                                            |
| ---------------------- | -------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `catalogue-i18n`       | `src/shared/i18n/locales/fr.json` + `en.json`, mécanique `t()`                   | `src/lib/backoffice-i18n.ts`, `src/lib/hotel-i18n.ts`, composants      |
| `bo-sidebar-workspace` | `src/widgets/bo-sidebar/`, `src/entities/workspace/`, `src/entities/session/`    | `src/components/backoffice/`, `src/lib/backoffice-i18n.ts`             |
| `bo-pages-panels`      | `src/pages/back-office-home/`, pages CRUD, widgets, entités catégorie/partenaire | `src/pages/backoffice/`, `src/components/backoffice/`, backoffice-i18n |
| `hotel-side`           | `src/pages/hotel-home/`, `src/pages/bar-programme/`, hôtel features              | `src/components/hotel-home/`, `hotel-demo/`, `steps/`, hotel-i18n      |
| `auth-gates-errors`    | `src/pages/login/`, forbidden/not-found, gates, navigation                       | `src/components/auth/`, `src/components/errors/`, pages-erreur.md      |

### Tâche pour chaque lecteur

```
Tu es un auditeur de wording. App: <APP>. Proto (source de vérité): <PROTO>.
Ton scope: <scope_app> et <scope_proto>.

RÈGLES STRICTES :
- Objectif : chaque chaîne VISIBLE PAR L'UTILISATEUR dans l'app (catalogue i18n,
  chaînes en dur, aria-label, placeholder, title, textes d'erreur, tooltips) doit
  être STRICTEMENT identique au wording du proto pour le même écran/élément. FR et EN.
- L'app n'implémente qu'un sous-ensemble du proto : ne compare que les écrans/éléments
  que l'app implémente. Une feature du proto absente de l'app n'est PAS un finding.
- Comparaison au caractère près : accents, majuscules/minuscules, ponctuation,
  apostrophes typographiques (’ vs '), espaces insécables, points de suspension (… vs ...).
- Trouve la chaîne source correspondante dans le proto et cite protoRef fichier:ligne.
- INTERDIT : préférences de style, opinions, hypothèses. Uniquement des différences
  objectives et vérifiables.
- Si une chaîne de l'app n'a AUCUN équivalent dans le proto, c'est un finding
  category=extra-text avec protoText="" et protoRef="introuvable".
- Retourne un JSON : { filesRead: string[], findings: [{ file, line, category,
  title, appText, protoText, protoRef, evidence, severity }] }
```

Catégories autorisées : `wording-mismatch`, `missing-text`, `extra-text`,
`translation-mismatch`, `punctuation-case`.

Sévérité : `high` (visible par l'utilisateur), `medium` (visible mais rare),
`low` (aria-labels, placeholders techniques, tooltips).

## Phase 3 — Déduplication et filtrage (inline)

1. Dédupliquer les findings : clé = `file + '|' + appText.slice(0, 60)`
2. Exclure les findings sur les écrans exclus :

| Écran exclus                                                           | Raison                                  |
| ---------------------------------------------------------------------- | --------------------------------------- |
| `pages/forbidden/`, `pages/not-found/`, `app/ui/GateError`             | Pages d'erreur non encore implémentées  |
| `pages/login/`                                                         | Écran jetable, remplacé au cutover OIDC |
| Textes d'erreur inventés (deleteConflict, undoFailed, error générique) | Proto ne modélise pas ces toasts        |
| FR figé dans l'EN du proto que l'app traduit proprement                | Pas un drift                            |

## Phase 4 — Vérification adversariale

```
Tu es un vérificateur adversarial. Un auditeur affirme une différence de
wording entre l'app et le proto (source de vérité). Ta mission : le RÉFUTER.

Finding: <JSON>
App: <APP> — Proto: <PROTO>.

Relis les fichiers cités (app ET proto), refais les greps. Cherche si le
texte du proto cité est bien celui affiché pour le MÊME écran/élément.
Vérifie le verbatim au caractère près.

RÈGLES DE PÉRIMÈTRE (réfutent un finding) :
- Textes d'erreur inventés pour des états que le proto ne modélise pas → isReal=false
- Endroits où le proto laisse du FR figé dans son EN alors que l'app traduit
  proprement → isReal=false

Retourne : { isReal: boolean, reason: string, correctedEvidence?: string, severity?: string }
```

## Phase 5 — Synthèse

Rapport : verdict global, findings confirmés groupés par écran, réfutés avec
raison, exclus, compteurs (bruts → dédup → exclus → confirmés → réfutés, fichiers lus).

## Correction (si demandée)

Suivre le skill `accor` : branche `fix/<kebab>` depuis `develop` à jour,
commits atomiques Conventional Commits, baseline
`pnpm --filter @astore/api build && pnpm typecheck && pnpm lint && pnpm test`
verte, PR contre `develop`.
