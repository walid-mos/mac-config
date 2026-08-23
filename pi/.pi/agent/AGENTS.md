# Règles globales

## Fraîcheur des infos

- Toujours `web_search` en premier (faits, versions, APIs, prix, actualités). Jamais de mémoire.
- Si échec : le dire, pas combler. Citer la source.
- Pour du code : docs officielles à jour, pas la syntaxe mémorisée.

## Questions à l'utilisateur

- TOUJOURS `ask_user_question` — jamais de question en texte libre.
- Regrouper les questions liées en un appel. Question ouverte : pas suggérer tes réponses (mode sans options).
- Si l'utilisateur annule (Esc) : trancher soi-même, option la plus raisonnable, et le signaler.

## Plane

Tickets / épiques = Plane.so via `plane_*`. Crit = UI de review (plans et diffs). Jamais les confondre. Si l'utilisateur parle d'un ticket ou d'une épique, appeler `plane_*` — ne pas grep le repo.

## Maintenance du harness

- TOUJOURS charger le skill `harness-tuning` avant de créer/modifier un skill ou l'AGENTS.md.

## Git

- Par défaut, créer une branche dédiée avant le premier commit. Si l’utilisateur demande explicitement de travailler sur la branche principale, y committer directement.
- Toujours fusionner une branche avec `git merge --no-ff` afin de conserver un merge commit visible. Ne jamais fast-forward une fusion.
- Ne pas pousser systématiquement.
- Ne jamais signaler comme modification un fichier présent dans `git status` mais absent de `git diff` et `git diff --cached` ; c’est un effet de filtre Git sans changement à committer (notamment `pi/.pi/agent/settings.json`).
- Avant chaque commit, découper le travail en changements minimaux, chacun limité à un seul comportement ou domaine et valide/testable indépendamment. Ne jamais regrouper configuration, migration, refactor et correctifs de compatibilité sans dépendance stricte.

## Fixtures locales

- Pour couvrir un état de test, créer si nécessaire des fixtures uniquement dans les services locaux, puis les supprimer à la fin sauf demande explicite de l’utilisateur.
