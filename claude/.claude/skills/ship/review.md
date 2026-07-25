# Revue adversariale interne

`/code-review` est un built-in `disable-model-invocation` : il ne peut être
lancé que par l'utilisateur. `/ship` conduit donc sa propre revue, spécifiée
ici pour être reproductible d'un run à l'autre.

Cible : le diff complet de l'épique, `git diff <base>...HEAD`.

## 1. Trouver — un subagent par dimension, en parallèle

Chaque agent reçoit le diff complet, les `CLAUDE.md` applicables et les
descriptions des tickets de l'épique. Il rend une liste de findings, chacun
avec fichier, ligne, et un **scénario de défaillance concret** : entrées ou
état précis → sortie fausse ou crash. Un finding sans scénario est jeté.

| Dimension | Ce qu'elle traque |
| --- | --- |
| Correction | Logique fausse, cas limites, `off-by-one`, états concurrents, transactions non atomiques |
| Contrat | Divergence entre ce que le front annonce et ce que l'API exige : champs requis/facultatifs, types, codes d'erreur, formes de réponse |
| Données | Normalisation (casse, espaces, unicode), unicité, migrations, index manquants, données périmées jamais reprises |
| Sécurité | Authz par ressource, origine et CSRF, traversée de chemin, injection, secrets, données d'un tenant visibles par un autre |
| Conformité | Écart aux `CLAUDE.md`, aux skills du stack et aux critères d'acceptation des tickets |

Adapter la liste au périmètre réel : pas de dimension Sécurité sur un diff
purement typographique, une dimension supplémentaire si l'épique touche une
surface particulière (paiement, cron, i18n, accessibilité).

## 2. Vérifier — réfuter chaque finding

Pour chaque finding, un subagent indépendant dont la consigne est de le
**réfuter**, pas de le confirmer. Il lit le code réel autour, pas seulement le
diff. Verdict `refuted` par défaut en cas de doute.

Un finding survit s'il n'est pas réfuté et que son scénario tient sur le code
tel qu'il est écrit. Les autres disparaissent — ils ne sont ni rapportés ni
« gardés pour info ».

Deux pièges qui produisent les faux positifs les plus coûteux :

- **Problème préexistant** — présent avant l'épique. Hors périmètre, sauf si
  le diff l'aggrave.
- **Garde ailleurs** — le cas est déjà couvert en amont (middleware, schéma de
  validation, contrainte DB). Le vérifier avant de rapporter.

## 3. Corriger

Corriger les findings survivants, du plus grave au moins grave, en commits
atomiques séparés du code de la fonctionnalité. Chaque correctif ajoute le
test qui aurait attrapé le bug — sinon rien ne prouve qu'il est corrigé.

Relancer tests, lint et typecheck après la dernière correction.

## 4. Rendre la main

`/ship` ne peut pas lancer `/code-review`. Dire à l'utilisateur, en clair, en
fin de run : la revue interne a tourné, voici ce qu'elle a corrigé, et
`/code-review xhigh --fix` reste à lancer manuellement sur la branche.
