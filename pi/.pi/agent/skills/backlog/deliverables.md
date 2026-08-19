# Deliverables

Tous les livrables de ce skill sont des documents Markdown.

## Gate 2 — `round-<n>.md`

Un document par round d'interview. Structure :

- Une section par domaine de décision (Données, Contrats, États, Auth, …)
- Chaque question pré-répondue avec ta recommandation
- Le round final append un `## Récapitulatif` — toutes les décisions prises
  sur une ligne, dont l'approbation ferme le grill.

## Gate 3 — `spec.md`

Le spec (PRD), sections = le squelette du [spec-template.md](spec-template.md).
Approuvé avant de passer au découpage.

## Gate 4 — `breakdown.md`

- Graphe de dépendances (mermaid `flowchart`)
- Une section par épique : outcome + tickets (titre, valeur, bloqué par, body)
- Table des résultats de la gate agent-ready
- Approuvé = feu vert pour publier dans Plane

## After publishing

Rapport compact dans le chat : identifiants des épiques, nombre de tickets,
frontier, dégradations éventuelles.