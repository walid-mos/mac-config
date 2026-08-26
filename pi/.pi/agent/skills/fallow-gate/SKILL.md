---
name: fallow-gate
description: >-
    Exécuter Fallow (codebase intelligence JS/TS/Astro : dead code, dépendances
    circulaires, duplication, complexité) avec fallback sans installation pour
    les repos clients où on ne peut rien ajouter. Utiliser comme gate
    structurel d'un diff (`audit --base`), comme source de cibles de duplication
    pour /simplify (`dupes --near`), ou quand il est demandé de « lancer
    fallow », auditer le dead code, ou chercher des doublons.
---

# Fallow gate

## Résoudre le binaire — jamais d'installation dans le projet

Essayer dans l'ordre, s'arrêter au premier hit :

1. `command -v fallow`, sinon `node_modules/.bin/fallow` (repos NextNode :
   version épinglée via `@nextnode-solutions/standards` + devDep exacte).
2. `npx -y fallow` (cache npx, hors du repo).

Repos clients : npx uniquement — ne jamais toucher aux manifests,
package.json, CI, ni rien installer.

## Appels canoniques

| Usage              | Commande                                                            | Lecture                                                                     |
| ------------------ | ------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| Gate changed-code  | `fallow audit --base <ref> --quiet`                                 | exit 0 = pass · 1 = findings **introduits** par le diff · 2 = erreur réelle |
| Cibles duplication | `fallow dupes --format json --quiet --near [--changed-since <ref>]` | `clone_groups[].fingerprint`, `suggested_name`, économie estimée            |
| Dead code          | `fallow dead-code --format json --quiet`                            | tableaux `unused_*` (exports, files, types, deps)                           |
| Auto-fix           | `fallow fix --dry-run` puis `fallow fix --yes`                      | `--yes` requis en non-TTY                                                   |

Règles : parser stdout comme JSON seulement avec `--format json` ; garder
stderr séparé (jamais `2>&1`) ; exit 2 = config/setup cassée, bloquant mais
pas des findings ; télémétrie toujours off — ne jamais l'activer.

## Intégration workflows

- `/simplify` : injecter les fingerprints `dupes --near --changed-since` dans
  les `retrievalCandidates` du manifest (leads déterministes, jamais preuve) ;
  après application des sets, relancer `audit --base` en lock structurel
  complémentaire du `LOCK`.
