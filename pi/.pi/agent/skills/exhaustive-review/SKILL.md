---
name: exhaustive-review
description: Use when the user asks for an exhaustive review, audit, or simplification of a scope — a git range, commit(s), a feature folder, or explicit files. Enforces a mechanical file inventory, one objective per pass, and scriptable completion gates — never self-reported completeness.
---

# Exhaustive Review

L'exhaustivité ne se promet pas, elle se vérifie. Sans mécanisme, un agent travaille par saillance (les gros fichiers, les bugs évidents), laisse la longue traîne de côté, et déclare « fini » quand ça y ressemble. Ce skill ne fait pas le travail — il garantit qu'aucun fichier du périmètre n'est passé sous silence, qu'un objectif n'en dilue pas les autres, et que « fini » soit prouvé par un gate, pas déclaré.

## Phase 0 — Périmètre (obligatoire, avant toute autre action)

```bash
scripts/inventory.sh <scope...>        # voir scripts/scope.sh pour la résolution
```

- `<scope>` = tout mélange de : range git `A..B` (branches, commits, `HEAD~5..HEAD`), dossier (feature), fichier(s) explicites. Répétable et mixable.
- Produit `.review-manifest.csv` : une ligne par fichier du périmètre. **Seule source de vérité.**
- Périmètre ambigu (plusieurs candidats plausibles, base incertaine) : `ask_user_question`.
- Ne jamais travailler « de mémoire » sur la liste des fichiers, ni l'estimer.

## Phase 1 — Survey (lecture seule)

- Remplir le manifeste : `fichier,verdict,note`, verdict ∈ `pending|done|skip` (skip = raison dans la note).
- Un objectif d'évaluation par survey : si la mission porte plusieurs objectifs (bugs, SOLID, tokens…), les noter en une ligne chacun dans `note`, mais les **corriger** en passages séparés (phase 2).
- Plus de 15 fichiers → lots de 8 maximum, dans l'ordre du manifeste, **à contexte frais** (nouvelle session ou sous-tâche déléguée par lot : un seul agent possède le manifeste, les lots ne font que relire et reporter). Pas de framework d'orchestration — cf. AGENTS.md.
- Ne modifier aucun fichier pendant le survey.

## Phase 2 — Un objectif par passage

Une mission = un objectif. Jamais deux. Objectifs typiques, à traiter en passages séparés : lint/format, bugs P0-P2, SOLID/SRP, design tokens.

- Chaque passage met à jour les verdicts du manifeste.
- Les commits suivent les règles Git de l'AGENTS.md ; ce skill n'y déroge pas.

## Phase 3 — Gates de fin (avant de dire « fini »)

```bash
scripts/coverage.sh <scope...>                 # exit 1 si un fichier du périmètre n'a pas de verdict
scripts/size-gate.sh [--budget N] <scope...>   # exit 1 si un fichier production dépasse le budget (défaut 250)
```

- Rejouer les gates avec **exactement le même scope** que `inventory.sh`.
- Un gate en échec = pas fini, quel que soit le ressenti. Corriger, relancer.
- `.review-manifest.csv` est un fichier de travail : ne jamais le committer.
- Terminer par le rapport d'espace négatif : lister explicitement ce qui n'a PAS été examiné et pourquoi.

## Interdits

- Jamais déclarer un audit « exhaustif » ou « clos » sans `coverage.sh` en exit 0.
- Jamais fusionner deux objectifs dans un même passage.
- Jamais résumer ou juger un fichier non visité : verdict `pending` tant qu'il ne l'est pas.
