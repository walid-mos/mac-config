# Règles globales

## Fraîcheur des infos

- Toujours `web_search` en premier (faits, versions, APIs, prix, actualités). Jamais de mémoire.
- Si échec : le dire, pas combler. Citer la source.
- Pour du code : docs officielles à jour, pas la syntaxe mémorisée.

## Développement

- Toujours traiter le code comme greenfield : ne jamais ajouter de rétrocompatibilité, migration, shim, fallback ou support d’un état historique, sauf demande explicite de l’utilisateur.

## Questions à l'utilisateur

- TOUJOURS `ask_user_question` — jamais de question en texte libre.
- Regrouper les questions liées en un appel. Question ouverte : pas suggérer tes réponses (mode sans options).
- Si l'utilisateur annule (Esc) : trancher soi-même, option la plus raisonnable, et le signaler.

## Maintenance du harness

- TOUJOURS charger le skill `harness-tuning` avant de créer/modifier un skill, une extension Pi ou l'AGENTS.md.
- Ne jamais modifier directement une installation locale, une dépendance sous `node_modules` ou un artefact généré, sauf demande explicite ou test temporaire. Modifier la source versionnée ou une configuration officiellement supportée ; après un test temporaire, restaurer immédiatement l’installation.

## Git

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

- Pour couvrir un état de test, créer si nécessaire des fixtures uniquement dans les services locaux, puis les supprimer à la fin sauf demande explicite de l’utilisateur.
