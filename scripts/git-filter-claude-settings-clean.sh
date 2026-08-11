#!/usr/bin/env bash
# Filtre clean git pour claude/.claude/settings.json.
#
# Déclaré dans .gitattributes (filter=claude-settings), configuré dans
# .git/config par `make git-filters`. Git l'applique au fichier de travail
# avant chaque status/diff : les clés réécrites par Claude Code à la volée
# (modèle actif via /model) sont normalisées, donc changer de modèle ne salit
# plus le repo.
#
# La valeur canonique DOIT rester identique à celle commitée dans
# claude/.claude/settings.json — c'est ici (et nulle part ailleurs) qu'on la
# met à jour si le défaut voulu change.
set -euo pipefail

# Pas de jq sur la machine : passe-through, ne jamais casser les commandes git.
command -v jq >/dev/null || { cat; exit 0; }

jq '
  .model = "claude-fable-5[1m]"
'
