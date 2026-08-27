#!/usr/bin/env bash
# Filtre clean git pour hermes/.hermes/config.yaml.
#
# Hermes réécrit le provider actif, le modèle et son URL de base à chaque
# changement de modèle. Git normalise uniquement ces trois clés volatiles ; le
# reste de la configuration continue d'apparaître dans les diffs.
set -euo pipefail

awk '
  /^model:$/ { in_model = 1; print; next }
  in_model && /^[[:alnum:]_-]+:/ { in_model = 0 }
  in_model && /^  default:/ {
    print "  default: gpt-5.6-luna-900k"
    next
  }
  in_model && /^  provider:/ {
    print "  provider: openai-codex"
    next
  }
  in_model && /^  base_url:/ {
    print "  base_url: https://chatgpt.com/backend-api/codex"
    next
  }
  { print }
'
