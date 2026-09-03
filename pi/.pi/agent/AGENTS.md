# Règles globales

## Fraîcheur des infos

- Pour les faits externes, versions, APIs, prix et actualités, utiliser `web_search` avant toute recherche ou affirmation ; seules une clarification de périmètre et l’inventaire obligatoire d’`exhaustive-review` peuvent le précéder.
- Pour utiliser un outil ou une version installée, son schéma, son aide ou sa commande `spec` locale fait autorité ; utiliser le web pour les versions disponibles et les faits externes.
- Si la recherche échoue : le dire, ne pas combler, et citer la source disponible.
- Pour du code dépendant d’une API externe : consulter sa documentation officielle à jour, jamais une syntaxe mémorisée.

## Développement

- Avant toute écriture ou modification de code, charger le skill `coding`, quel que soit le skill ou workflow déjà actif.
- Toujours traiter le code comme greenfield : ne jamais ajouter de rétrocompatibilité, migration, shim, fallback, API dépréciée, chemin legacy ou support d’un état historique, sauf demande explicite de l’utilisateur.

## Réponses

- Ne jamais placer prose ou maquette TUI dans un bloc fenced `text` ; réserver les blocs de code au contenu dont la mise en forme littérale est nécessaire.

## Questions à l'utilisateur

- En TUI, TOUJOURS `ask_user_question` — jamais de question en texte libre. Si l’outil est indisponible ou la session non-TUI, interrompre la tâche et signaler que la clarification exige le TUI.

## Maintenance du harness

- TOUJOURS charger le skill `harness-tuning` avant de créer/modifier un skill, une extension Pi ou l'AGENTS.md.
- Ne jamais modifier directement une installation locale, une dépendance sous `node_modules`, un dossier `dist`/`build` ou tout autre artefact généré ou compilé, quel que soit le projet, sauf demande explicite de l’utilisateur. Modifier la source versionnée ou une configuration officiellement supportée.

## Git

- Ne jamais écraser ou supprimer des changements ou données non créés pour la tâche ; demander confirmation avant toute opération destructive ou irréversible.
- Par défaut, créer une branche dédiée avant le premier commit. Si l’utilisateur demande explicitement de travailler sur la branche principale, y committer directement.
- Par défaut, fusionner avec `git merge --no-ff` pour conserver un merge commit visible. Si l’utilisateur demande explicitement un fast-forward, utiliser `git merge --ff-only`, notamment pour une branche créée impromptument.
- Ne pas pousser systématiquement.
- Ne jamais signaler comme modification un fichier présent dans `git status` mais absent de `git diff` et `git diff --cached` ; c’est un effet de filtre Git sans changement à committer (notamment `pi/.pi/agent/settings.json`).
- **Commit atomique — définition unique** : un commit est atomique si et seulement si les 4 critères sont réunis :
    1. **Une seule intention** : un comportement ajouté/modifié, un correctif ou un refactor unique — révertible en une commande sans casser le reste.
    2. **Autonome** : compile et passe les tests à ce commit précis (`git checkout <sha>` + suite locale au vert), pas seulement en bout de branche.
    3. **Domaine unique** : config, migration, refactor et fix ne cohabitent dans un même commit que liés par une dépendance stricte ; sinon → commits séparés ordonnés.
    4. **Message fidèle** : Conventional Commit `type(scope): description` décrivant cette seule intention.
       Avant chaque commit, découper le travail pour satisfaire ces critères. Jamais de commit fourre-tout ni "WIP".

## Fixtures locales

- Supprimer à la fin les données de test temporaires créées dans des services locaux, sauf demande explicite de l’utilisateur. Les fixtures de test versionnées suivent la politique du skill `coding` et restent dans le dépôt lorsqu’elles verrouillent durablement un comportement.
