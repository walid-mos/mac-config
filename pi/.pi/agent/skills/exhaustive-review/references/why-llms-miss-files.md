# Pourquoi les LLM ne sont pas exhaustifs (et ce qui marche)

Condensé de l'analyse faite le 2026-09-01 après un audit Pi raté (20 fichiers SRP-ifiés sur 30, audit déclaré « clos » puis reconnu incomplet quand challengé).

## Les trois comportements intrinsèques

1. **Salience, pas énumération.** Face à « review tout le code », le modèle ne construit jamais d'inventaire explicite. Il travaille par saillance : gros fichiers, fichiers intéressants, bugs évidents. La longue traîne « ennuyeuse » n'est jamais visitée. Symptôme type : N fichiers traités sur M, les oubliés sont les moins saillants.
2. **« Felt done » ≠ « is done ».** Le self-report de complétude est structurellement peu fiable (biais de complaisance, renforcé par le training vers des conclusions satisfaisantes). Un audit déclaré clos peut n'être qu'à 70 %.
3. **Context rot.** Sur un gros diff, au fichier 40 les fichiers 1-20 sont sortis de l'attention effective. Un passage unique et long garantit une qualité décroissante, même avec un prompt parfait.

## Le piège du prompt multi-objectifs

Un prompt empilant lint + review bugs + SOLID + design system + commits produit un triage interne : chaque objectif reçoit un traitement partiel. Cinq passages distincts, chacun avec son gate, donnent une exhaustivité par objectif qu'aucun prompt unique n'atteint.

## Les mécanismes qui produisent l'exhaustivité

| Mécanisme | Ce que ça corrige |
|---|---|
| Inventaire mécanique avant tout travail | Oublis de la longue traîne |
| Gate de fin scripté (exit code, pas ressenti) | « Felt done » |
| Deux phases : survey read-only puis exécution | Le mélange survey+fix qui fait sauter l'inventaire |
| Lots courts à contexte frais | Context rot |
| Une mission par passage | Le triage interne entre objectifs |
| Rapport d'espace négatif (ce qui n'a PAS été examiné) | Synthèse flatteuse |
| Re-vérification de couverture par contexte vierge | Self-report peu fiable |

Principe général : **transformer un problème de rappel (faible chez le LLM) en problème de liste (itération, fort chez le LLM)**.

## Leçons de test des gates (session réelle)

- Tester les gates sur un diff réel peut être trompeur : un diff ne contenant que des tests/MD fait passer un size-gate cassé. Valider sur un repo synthétique contrôlé (fichier de 300 lignes, budget 250 → FAIL attendu).
- `awk '$1 == f { print $2; exit }'` prend la PREMIÈRE occurrence : les doublons du manifeste masquent les verdicts. Utiliser la dernière occurrence (`'$1 == f { v = $2 } END { print v }'`).
- L'exclusion des non-fichiers production dans size-gate : `*test*|*spec*|*.md|*.csv|*JOURNAL*|*.json|*.patch`.

## Limites des linters pour SRP

Oxlint/fallow/tests mesurent erreurs statiques, complexité, duplication, dead code, régressions — pas la cohésion module. « Zéro finding introduit » ≠ « architecture SOLID ». Proxys mécaniques : budget de lignes par fichier, détection de cohabitation de responsabilités hétérogènes (ex. exécution de processus + détection de focus + politique de notification + singleton dans le même fichier = entorse SRP).
