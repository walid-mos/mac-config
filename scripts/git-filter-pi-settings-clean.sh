#!/usr/bin/env bash
# Filtre clean git pour pi/.pi/agent/settings.json.
#
# Déclaré dans .gitattributes (filter=pi-settings), configuré dans .git/config
# par `make git-filters`. Git l'applique au fichier de travail avant chaque
# status/diff : les clés réécrites par pi à la volée (provider/modèle actif,
# dernière version du changelog vue) sont normalisées, donc changer de modèle
# dans pi ne salit plus le repo.
#
# Les valeurs canoniques DOIVENT rester identiques à celles commitées dans
# pi/.pi/agent/settings.json — c'est ici (et nulle part ailleurs) qu'on les
# met à jour si le défaut voulu change.
set -euo pipefail

# Pas de jq sur la machine : passe-through, ne jamais casser les commandes git.
command -v jq >/dev/null || { cat; exit 0; }

# -j : pas de newline finale, pour matcher le format du fichier commité.
jq -j '
  .defaultProvider = "openrouter"
  | .defaultModel = "deepseek/deepseek-v4-flash"
  | del(.lastChangelogVersion)
'
