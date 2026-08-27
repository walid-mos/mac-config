# Spec template

The spec (a PRD) is the intermediate deliverable between the grill and the
tickets. It is rendered as `docs/interviews/<feature-slug>/spec.md`, approved,
then becomes the epics' bodies — it is not published as a work item of its own
unless the user asks.

The sections below are the content skeleton. Write it in the language of the
project's tracker content. Use the project's domain vocabulary verbatim.

No file paths and no code in the spec — that granularity belongs in the
tickets. One exception: a snippet that encodes a decision more precisely than
prose can (a state machine, a schema, a type shape). Trim it to the
decision-rich part.

```
## Problème

Le problème vécu, du point de vue de l'utilisateur. Ce qui est cassé ou
impossible aujourd'hui, et ce que ça lui coûte.

## Solution

La solution, du point de vue de l'utilisateur. Ce qu'il pourra faire après.

## Récits utilisateur

Liste numérotée, longue et exhaustive. Un récit par comportement observable,
y compris les chemins d'échec et les cas limites.

1. En tant que <acteur>, je veux <capacité>, afin de <bénéfice>.

## Vocabulaire

Chaque concept nouveau, avec son nom de domaine retenu et sa définition en une
phrase. Signaler explicitement tout terme existant dont il faut se démarquer.

## Décisions d'implémentation

Ce qui a été tranché pendant l'entretien :

- modules créés ou modifiés, et leurs interfaces
- schéma de données, migrations, unités et formats
- contrats d'API : entrées, sorties, codes, formes d'erreur
- états et transitions, y compris les transitions non désirées
- autorisation : ce qui est public, ce qui exige une session
- comportement en cas d'échec, vu de l'utilisateur
- décisions d'architecture, avec renvoi à l'ADR quand il en existe un

## Décisions de test

- ce qui fait un bon test ici : comportement externe, pas détail d'implémentation
- les coutures utilisées, existantes de préférence, la plus haute possible
- les modules réellement couverts
- l'art antérieur dans le repo : les tests semblables dont s'inspirer
- les commandes qui font foi (script npm, tâche turbo), telles qu'elles existent

## Hors périmètre

Ce qui n'est pas fait, et pourquoi. Y compris les décisions volontairement
reportées — elles vivent ici, jamais dans un ticket.

## Risques et pièges

Ce qui a été découvert en explorant le code et qui peut faire dérailler
l'implémentation. Chaque piège doit ensuite se retrouver dans le ticket qu'il
concerne.

## Notes

Le reste.
```

## Where the spec lands

The spec is not a work item. Its content is distributed:

- *Problème*, *Solution*, *Récits utilisateur* → the epics' `Intention`,
  `Valeur livrée`, and the tickets' `Récit`.
- *Décisions d'implémentation*, *Décisions de test* → the tickets'
  `Notes techniques` and `Critères d'acceptation`.
- *Vocabulaire* → the titles and bodies of everything, verbatim.
- *Risques et pièges* → the tickets' `Pièges`.
- *Hors périmètre* → mentioned in the epic that would otherwise seem to cover it.

If the user wants the spec itself kept on Plane, créer un work item dédié
(ou une note dans le corps de l'épique via `plane_update_workitem`).