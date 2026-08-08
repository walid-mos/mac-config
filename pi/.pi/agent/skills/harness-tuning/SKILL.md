---
name: harness-tuning
description: Create and maintain pi skills and agent instructions (AGENTS.md). MUST be used every time a skill is created or updated, or when AGENTS.md / agent rules are modified — ensures no rule duplication, correct skill structure, and optimal placement of instructions (system prompt vs tool description vs skill vs extension).
---

# Harness Tuning

Guide pour créer des skills pi et maintenir les instructions de l'agent (AGENTS.md) de façon optimale et fiable.

**À charger systématiquement avant toute création/modification de skill ou d'AGENTS.md.**

## Matrice de décision : où va une instruction ?

| Besoin | Emplacement | Chargement | Salience |
|---|---|---|---|
| Politique globale, s'applique à chaque session | `~/.pi/agent/AGENTS.md` | System prompt, chaque session | Forte au début, **diluée** en longue session |
| Mécanique d'usage d'un outil (quand l'appeler, comment remplir les params) | Description/schéma de l'outil | Re-envoyée à **chaque tour** | **Maximale** : lue au moment de la décision d'appel |
| Expertise ou workflow ponctuel | Skill (`~/.pi/agent/skills/`) | Description toujours en contexte, corps à la demande | Bonne si la description est spécifique |
| Comportement/UI impossible à exprimer en texte | Extension (`~/.pi/agent/extensions/`) | Code, toujours actif | Déterministe (pas de salience, c'est du code) |

**Règle d'or** : si une instruction ne sert que dans un contexte précis, elle ne doit PAS être dans l'AGENTS.md.

## Anti-duplication (le principe le plus important)

1. **Une seule source de vérité par détail** — chiffres, seuils, listes : un seul endroit. Dupliquer = drift (les versions divergent → le modèle en suit une au hasard).
2. **Redondance uniquement pour les déclencheurs critiques** — la règle dont l'oubli coûte le plus cher (ex : "TOUJOURS utiliser l'outil X") peut vivre dans AGENTS.md ET la description d'outil. Defense-in-depth assumée.
3. **Pas de mécanique d'outil dans l'AGENTS.md** — "5 max", "2-3 options", noms de paramètres : ça va dans la description de l'outil/skill.

## Règles pour écrire des règles

- **Brevité** — l'AGENTS.md est payé en tokens à chaque tour de chaque session. Chaque ligne doit le mériter.
- **Impératif, sans adoucisseur** — "Toujours X", "Jamais Y", pas "il serait bon de". Les règles molles sont ignorées.
- **Négatif + alternative positive** — "Jamais de question en texte libre" suivi de "...utiliser `ask_user_question`". Une interdiction sans issue est mal suivie.

## Template de base d'un skill

```
~/.pi/agent/skills/<nom-du-skill>/
├── SKILL.md              # Obligatoire : frontmatter + instructions
├── scripts/              # Optionnel : scripts exécutables
└── references/           # Optionnel : docs détaillées chargées à la demande
```

**SKILL.md minimal :**

````markdown
---
name: nom-du-skill
description: Ce que fait le skill et QUAND l'utiliser. Sois spécifique — c'est ce texte qui déclenche le chargement.
---

# Nom du Skill

## Setup (si nécessaire, une seule fois)

```bash
commande d'installation
```

## Usage

Instructions directes et actionnables. Référencer les fichiers avec des chemins
relatifs : [détails](references/REFERENCE.md), ./scripts/run.sh
````

**Contraintes du frontmatter :**
- `name` : 1-64 chars, lowercase, chiffres, hyphens (pas de leading/trailing ni doubles)
- `description` : max 1024 chars, **obligatoire** (skill non chargé sinon)
- Bon : *"Web search and content extraction via Brave Search API. Use for searching documentation, facts, or any web content."*
- Mauvais : *"Helps with search."*

## Checklist création/update d'un skill

- [ ] `description` : quoi + **quand l'utiliser** (le déclencheur)
- [ ] SKILL.md lean : instructions essentielles + pointeurs vers `references/` pour la profondeur
- [ ] Pas de chevauchement avec un skill existant ou une règle AGENTS.md
- [ ] Les scripts référencés existent et sont testés
- [ ] Chemins relatifs (jamais absolus) pour les références internes

## Checklist ajout/modification AGENTS.md

- [ ] La règle s'applique à **toutes** les sessions (sinon → skill)
- [ ] Elle ne duplique pas un détail déjà dans une description d'outil/skill
- [ ] Une ligne si possible, impérative, actionnable
- [ ] Alternative positive fournie si c'est une interdiction

## Vérification après modification

- Extension : `/reload` dans la session courante
- AGENTS.md, skills : nouvelle session
- Forcer le chargement d'un skill pour test : `/skill:<nom>`
- Syntaxe extension : `npx esbuild <file>.ts --outfile=/dev/null --format=esm --packages=external`
