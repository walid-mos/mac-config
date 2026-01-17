# MCP Server Installation Commands

## GitHub (requires authentication)

```bash
GITHUB_TOKEN=$(gh auth token) && claude mcp add -t http -s user -H "Authorization: Bearer $GITHUB_TOKEN" -- github https://api.githubcopilot.com/mcp
```

**Requirements:** `gh` CLI authenticated with scopes `repo`, `read:org`

## Context7 (public)

```bash
claude mcp add -t http -s user context7 https://mcp.context7.com/mcp
```

## Linear (public)

```bash
claude mcp add -t http -s user linear-server https://mcp.linear.app/mcp
```

## Verify

```bash
claude mcp list
```
