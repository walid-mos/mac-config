# Paste Mode (Step 3A)

The pasted text may be one of two formats:

## Format 1: Network request outside of sandbox

If the pasted text contains "Network request outside of sandbox" or "Host:" followed by a domain, this is a **sandbox network prompt**. Parse it:
1. Extract the hostname from the `Host:` line (e.g. `api.github.com`).
2. **Extract root domain** using the domain extraction rule in [SKILL.md](SKILL.md) (e.g. `api.github.com` -> `github.com`).
3. Target list = `allow` (unless prefixed with deny/blacklist).
4. Resolve to pattern: `WebFetch(domain:<rootDomain>)`
5. **Additionally**: read `~/.claude/settings.json` and check if `sandbox.network.allowedDomains` exists. If the wildcard domain `*.<rootDomain>` (or `"*"`) is NOT already in the array, add `*.<rootDomain>` to `allowedDomains`. This covers both the tool permission and sandbox network layers.
5. Go to Step 4.

## Format 2: Standard tool permission prompt

The pasted text looks like a Claude permission prompt:
```
[optional: deny/blacklist prefix]
ToolName [subtype]

   specific-command-or-path
   description text
```

Parse it:
1. Check if the first word is `deny` or `blacklist` -> target list = `deny`, consume that word. Otherwise target list = `allow`.
2. Find the tool line - the first non-empty, non-deny/blacklist line. Extract the tool name (first word). Ignore subtypes like "command" after it.
3. Find the first indented line (3+ leading spaces) - this is the specific command/path. Trim whitespace.
4. Resolve to a pattern:

| Tool | Resolution |
|---|---|
| `Bash` | Extract first word of the indented command -> `Bash(<firstWord>:*)` |
| `Read` | Use the indented path -> `Read(<path>)` |
| `Edit` | Extract parent directory of the indented path -> `Edit(<parentDir>/**)` |
| `Write` | Extract parent directory -> `Write(<parentDir>/**)` |
| `WebFetch` | If the indented line contains a hostname or URL, extract the root domain (see [SKILL.md](SKILL.md)) -> `WebFetch(domain:<rootDomain>)`. Otherwise `WebFetch(*)`. |
| `WebSearch` | `WebSearch(*)` |
| `mcp__*` (any MCP tool) | Strip the last segment (after final `__`) -> `<prefix>__*` (e.g. `mcp__plugin_context7_context7__query-docs` -> `mcp__plugin_context7_context7__*`) |
| Other | Use the tool name as-is |

5. **Heuristic auto-detection**: After resolving the permission pattern, scan the FULL pasted text for known heuristic warning phrases. If any are found, also run **Step 3D-add** (see [bypass-mode.md](bypass-mode.md)) for the matching heuristic name(s):

| Phrase in pasted text | Heuristic name |
|---|---|
| `command_substitution` or `command substitution` | `command_substitution` |
| `expansion obfuscation` or `brace with quote` | `brace_obfuscation` |
| `evaluates arguments as shell code` | `dot_source` |
| `heredoc` | `heredoc` |
| `quoted characters in flag names` | `quoted_flags` |
| `Compound commands with cd and git` | `cd_git_compound` |
| `consecutive quote characters` | `consecutive_quotes` |

Go to Step 4.
