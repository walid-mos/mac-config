#!/usr/bin/env bash
# Run once per machine to register MCP servers in ~/.claude.json
set -euo pipefail

echo "Setting up MCP servers..."

# Context7 — library documentation lookup
claude mcp remove context7 -s user 2>/dev/null || true
claude mcp add context7 -s user -- npx -y @upstash/context7-mcp@latest

echo "Done. Restart Claude Code to connect."
