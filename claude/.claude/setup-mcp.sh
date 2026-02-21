#!/usr/bin/env bash
# Run once per machine to register MCP servers in ~/.claude.json
# Requires: PLANE_API_KEY set in shell env

set -euo pipefail

echo "Setting up MCP servers..."

# Plane (self-hosted via uvx)
claude mcp remove plane -s user 2>/dev/null || true
claude mcp add-json plane '{
  "command": "uvx",
  "args": ["plane-mcp-server", "stdio"],
  "env": {
    "PLANE_API_KEY": "${PLANE_API_KEY}",
    "PLANE_WORKSPACE_SLUG": "${PLANE_WORKSPACE_SLUG}",
    "PLANE_BASE_URL": "https://projects.nextnode.fr/api"
  }
}' -s user

echo "Done. Restart Claude Code to connect."
