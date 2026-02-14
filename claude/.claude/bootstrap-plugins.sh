#!/usr/bin/env bash
# ============================================================================
# Claude Code Plugin Bootstrap
#
# Syncs plugins across machines when settings.json is shared via stow/git.
# Reads enabledPlugins and extraKnownMarketplaces from settings.json,
# adds missing marketplaces, and installs missing plugins.
#
# Usage: bash ~/.claude/bootstrap-plugins.sh
# ============================================================================

set -euo pipefail

SETTINGS_FILE="${HOME}/.claude/settings.json"
INSTALLED_FILE="${HOME}/.claude/plugins/installed_plugins.json"
KNOWN_MARKETPLACES_FILE="${HOME}/.claude/plugins/known_marketplaces.json"

if ! command -v jq &>/dev/null; then
  echo "Error: jq is required. Install it with: brew install jq"
  exit 1
fi

if [[ ! -f "$SETTINGS_FILE" ]]; then
  echo "Error: ${SETTINGS_FILE} not found"
  exit 1
fi

# --- Marketplaces -----------------------------------------------------------

echo "=== Checking marketplaces ==="

marketplace_names=$(jq -r '.extraKnownMarketplaces // {} | keys[]' "$SETTINGS_FILE" 2>/dev/null)

for name in $marketplace_names; do
  # claude-plugins-official is built-in, skip it
  if [[ "$name" == "claude-plugins-official" ]]; then
    continue
  fi

  # Check if marketplace is already known locally
  if [[ -f "$KNOWN_MARKETPLACES_FILE" ]] && jq -e --arg n "$name" '.[$n]' "$KNOWN_MARKETPLACES_FILE" &>/dev/null; then
    echo "  [ok] marketplace: ${name}"
    continue
  fi

  # Extract the github repo from settings
  repo=$(jq -r --arg n "$name" '.extraKnownMarketplaces[$n].source.repo // empty' "$SETTINGS_FILE")
  if [[ -z "$repo" ]]; then
    echo "  [skip] marketplace: ${name} (no github repo found in settings)"
    continue
  fi

  echo "  [add] marketplace: ${name} (${repo})"
  claude plugin marketplace add "$repo" || echo "  [warn] failed to add marketplace: ${name}"
done

# --- Plugins ----------------------------------------------------------------

echo ""
echo "=== Checking plugins ==="

plugin_ids=$(jq -r '.enabledPlugins // {} | to_entries[] | select(.value == true) | .key' "$SETTINGS_FILE" 2>/dev/null)

for plugin_id in $plugin_ids; do
  # Check if already installed locally
  if [[ -f "$INSTALLED_FILE" ]] && jq -e --arg p "$plugin_id" '.plugins[$p] | length > 0' "$INSTALLED_FILE" &>/dev/null; then
    echo "  [ok] plugin: ${plugin_id}"
    continue
  fi

  echo "  [install] plugin: ${plugin_id}"
  claude plugin install "$plugin_id" || echo "  [warn] failed to install plugin: ${plugin_id}"
done

echo ""
echo "Done."
