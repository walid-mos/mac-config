# Manual Mode (Step 3B)

1. Check if the first word is `deny` or `blacklist` -> target list = `deny`, consume that word. Otherwise target list = `allow`.
2. Join remaining words as the input.
3. Resolve using this table (case-insensitive matching):

| Input Pattern | Resolved Permission |
|---|---|
| `bash` (alone) | `Bash` |
| `read` (alone) | `Read` |
| `edit` (alone) | `Edit` |
| `write` (alone) | `Write` |
| `glob` (alone) | `Glob` |
| `grep` (alone) | `Grep` |
| `notebook` or `notebookedit` | `NotebookEdit` |
| `webfetch` or `web fetch` | `WebFetch(*)` |
| `webfetch <domain>` or `web fetch <domain>` | Extract root domain (see [SKILL.md](SKILL.md)) -> `WebFetch(domain:<rootDomain>)` |
| `domain <domain>` or `host <domain>` | Extract root domain (see [SKILL.md](SKILL.md)) -> `WebFetch(domain:<rootDomain>)` - also add `*.<rootDomain>` to `sandbox.network.allowedDomains` |
| `websearch` or `web search` | `WebSearch(*)` |
| `skill` | `Skill` |
| `task` | `Task` |
| `plugin` or `plugins` | `Plugin:*` |
| `bash <cmd>` (e.g. `bash git`) | `Bash(<cmd>:*)` |
| `bash <cmd> <subcmd>` (e.g. `bash git commit`) | `Bash(<cmd> <subcmd> *)` |
| Any common CLI tool alone (e.g. `git`, `npm`, `docker`, `gh`, `curl`, `rm`, `jq`, ...) | `Bash(<tool>:*)` |
| Two+ words matching CLI pattern (e.g. `rm -rf`, `docker compose`) | `Bash(<words> *)` |
| `edit <path>` | `Edit(<resolved-path>/**)` |
| `read <path>` | `Read(<resolved-path>/**)` |
| `write <path>` | `Write(<resolved-path>/**)` |
| `context7` or `mcp context7` | Discover via MCP discovery - see [mcp-discovery.md](mcp-discovery.md) |
| `mcp <name>` | Discover via MCP discovery - see [mcp-discovery.md](mcp-discovery.md) |
| Anything starting with `mcp__` | Strip last segment after `__` -> `<prefix>__*` |

Path resolution: Expand `~` to the user's home directory. If the path doesn't end with `**`, append `/**`.
