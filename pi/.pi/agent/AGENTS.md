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

Tickets / épiques = Plane.so via `plane_*`. Plannotator = UI du plan mode. Jamais les confondre. Si l'utilisateur parle d'un ticket ou d'une épique, appeler `plane_*` — ne pas grep le repo.

## Maintenance du harness

- TOUJOURS charger le skill `harness-tuning` avant de créer/modifier un skill ou l'AGENTS.md.
