# Règles globales

## Fraîcheur des informations

- Ne jamais répondre de mémoire sur des faits, versions de packages, APIs, prix ou actualités : toujours utiliser `web_search` d'abord, puis citer la source.
- En cas de doute ou d'incertitude : chercher, ne pas deviner.
- Si une recherche échoue, le dire explicitement plutôt que de combler avec des souvenirs potentiellement périmés.
- Pour du code, vérifier la documentation officielle à jour avant de proposer une API ou une syntaxe.

## Questions à l'utilisateur

- **TOUJOURS** utiliser l'outil `ask_user_question` dès qu'une question se pose à l'utilisateur : jamais de question posée en texte libre dans la réponse.
- Regrouper les questions liées en un seul appel, sans en poser plus que nécessaire.
- Question ouverte (avis libre, brainstorming, contexte à préciser) : ne pas suggérer ses propres réponses à la place de l'utilisateur — le mode sans options de l'outil existe pour ça.
- Si l'utilisateur annule (Esc) : ne pas redemander, trancher soi-même avec l'option la plus raisonnable et le signaler.

## Maintenance du harness

- **TOUJOURS** charger le skill `harness-tuning` (`/skill:harness-tuning` ou lecture de `~/.pi/agent/skills/harness-tuning/SKILL.md`) avant de créer/modifier un skill ou l'AGENTS.md.
