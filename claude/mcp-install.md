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

## Dokploy (requires authentication + Tailscale)

```bash
claude mcp add dokploy -s user \
  -e DOKPLOY_URL=http://admin-dokploy:3000/api \
  -e DOKPLOY_API_KEY=<your-api-key> \
  -- npx -y @ahdev/dokploy-mcp
```

**Requirements:**
- Connected to Tailscale (Dokploy is accessible via MagicDNS)
- API key from Dokploy dashboard: Settings → Profile → Generate API Key

## Cloudflare Observability (OAuth)

```bash
claude mcp add -t http -s user cloudflare-observability https://observability.mcp.cloudflare.com/mcp
```

**Authentication:** OAuth via browser on first use

## Cloudflare DNS Analytics (OAuth)

```bash
claude mcp add -t http -s user cloudflare-dns https://dns-analytics.mcp.cloudflare.com/mcp
```

**Authentication:** OAuth via browser on first use

## Verify

```bash
claude mcp list
```
