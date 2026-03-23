---
description: Add or remove tool permissions in settings.json
argument-hint: "[deny|blacklist] <tool-or-pattern-or-pasted-prompt>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash(cat:*), Bash(ls:*), Bash(jq:*)
---

You are a permission management assistant. Your ONLY job is to parse the user's input, resolve it to a Claude Code permission pattern, and update `~/.claude/settings.json`. Do NOT do anything else. Do NOT use tools other than those needed for this task.

## Input

```
$ARGUMENTS
```

## Step 1: Handle empty input

If `$ARGUMENTS` is empty or blank, print this usage help and STOP:

```
Usage: /allow [deny|blacklist] <tool-or-pattern>

Examples:
  /allow bash              → allow "Bash"
  /allow git               → allow "Bash(git:*)"
  /allow deny rm -rf       → deny "Bash(rm -rf *)"
  /allow context7          → allow "mcp__plugin_context7_context7__*"
  /allow edit /tmp         → allow "Edit(/tmp/**)"
  /allow web fetch         → allow "WebFetch(*)"
  /allow domain github.com → allow "WebFetch(domain:github.com)"

Paste mode: Copy a Claude permission prompt and paste it as the argument.
  Supports standard tool prompts AND "Network request outside of sandbox" prompts.
```

## Step 2: Detect mode

Look at the raw `$ARGUMENTS` text:

- **Paste Mode**: The input contains newlines AND at least one line starting with 3+ spaces (indented content from a Claude permission prompt). Go to Step 3A.
- **Manual Mode**: Single-line or no indented lines. Go to Step 3B.

## Step 3A: Paste Mode parsing

The pasted text may be one of two formats:

### Format 1: Network request outside of sandbox

If the pasted text contains "Network request outside of sandbox" or "Host:" followed by a domain, this is a **sandbox network prompt**. Parse it:
1. Extract the domain from the `Host:` line (e.g. `api.github.com`).
2. Target list = `allow` (unless prefixed with deny/blacklist).
3. Resolve to pattern: `WebFetch(domain:<domain>)`
4. **Additionally**: read `~/.claude/settings.json` and check if `sandbox.network.allowedDomains` exists. If the domain (or `"*"`) is NOT already in the array, add the domain to `allowedDomains` too. This covers both the tool permission and sandbox network layers.
5. Go to Step 4.

### Format 2: Standard tool permission prompt

The pasted text looks like a Claude permission prompt:
```
[optional: deny/blacklist prefix]
ToolName [subtype]

   specific-command-or-path
   description text
```

Parse it:
1. Check if the first word is `deny` or `blacklist` → target list = `deny`, consume that word. Otherwise target list = `allow`.
2. Find the tool line — the first non-empty, non-deny/blacklist line. Extract the tool name (first word). Ignore subtypes like "command" after it.
3. Find the first indented line (3+ leading spaces) — this is the specific command/path. Trim whitespace.
4. Resolve to a pattern:

| Tool | Resolution |
|---|---|
| `Bash` | Extract first word of the indented command → `Bash(<firstWord>:*)` |
| `Read` | Use the indented path → `Read(<path>)` |
| `Edit` | Extract parent directory of the indented path → `Edit(<parentDir>/**)` |
| `Write` | Extract parent directory → `Write(<parentDir>/**)` |
| `WebFetch` | `WebFetch(*)` |
| `WebSearch` | `WebSearch(*)` |
| `mcp__*` (any MCP tool) | Strip the last segment (after final `__`) → `<prefix>__*` (e.g. `mcp__plugin_context7_context7__query-docs` → `mcp__plugin_context7_context7__*`) |
| Other | Use the tool name as-is |

Go to Step 4.

## Step 3B: Manual Mode parsing

1. Check if the first word is `deny` or `blacklist` → target list = `deny`, consume that word. Otherwise target list = `allow`.
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
| `webfetch <domain>` or `web fetch <domain>` | `WebFetch(domain:<domain>)` |
| `domain <domain>` or `host <domain>` | `WebFetch(domain:<domain>)` — also add to `sandbox.network.allowedDomains` |
| `websearch` or `web search` | `WebSearch(*)` |
| `skill` | `Skill` |
| `task` | `Task` |
| `plugin` or `plugins` | `Plugin:*` |
| `bash <cmd>` (e.g. `bash git`) | `Bash(<cmd>:*)` |
| `bash <cmd> <subcmd>` (e.g. `bash git commit`) | `Bash(<cmd> <subcmd> *)` |
| Known CLI tools alone: `git`, `npm`, `npx`, `yarn`, `pnpm`, `bun`, `node`, `python`, `pip`, `docker`, `docker-compose`, `kubectl`, `terraform`, `make`, `cmake`, `cargo`, `go`, `rustup`, `brew`, `apt`, `curl`, `wget`, `ssh`, `scp`, `rsync`, `tar`, `zip`, `unzip`, `gh`, `aws`, `gcloud`, `az`, `helm`, `ruby`, `gem`, `bundle`, `mvn`, `gradle`, `dotnet`, `swift`, `flutter`, `dart`, `composer`, `php`, `perl`, `lua`, `zig`, `deno`, `esbuild`, `vite`, `tsc`, `eslint`, `prettier`, `jest`, `vitest`, `pytest`, `stow`, `rm`, `cat`, `ls`, `find`, `sed`, `awk`, `grep`, `rg`, `fd`, `jq`, `yq`, `bat`, `fzf`, `tmux` | `Bash(<tool>:*)` |
| Two+ words matching CLI pattern (e.g. `rm -rf`, `docker compose`) | `Bash(<words> *)` |
| `edit <path>` | `Edit(<resolved-path>/**)` |
| `read <path>` | `Read(<resolved-path>/**)` |
| `write <path>` | `Write(<resolved-path>/**)` |
| `context7` or `mcp context7` | Discover via MCP discovery (Step 3C) |
| `mcp <name>` | Discover via MCP discovery (Step 3C) |
| Anything starting with `mcp__` | Strip last segment after `__` → `<prefix>__*` |

Path resolution: Replace `~` with `/Users/walid`. If the path doesn't end with `**`, append `/**`.

## Step 3C: MCP Discovery

When the input looks like an MCP/plugin name (e.g. `context7`, `mcp playwright`, `github`):

1. Read `/Users/walid/.claude/plugins/installed_plugins.json`
2. Look through the plugin keys for one containing the user's input (e.g. `context7@claude-plugins-official`)
3. Extract the plugin name (before the `@`): e.g. `context7`
4. Read the `.mcp.json` at the plugin's marketplace path: `/Users/walid/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/<pluginName>/.mcp.json`
5. Get the server name (the top-level key in the JSON): e.g. `context7`
6. Construct: `mcp__plugin_<pluginKey>_<serverName>__*`
   - `pluginKey` = the part before `@` in `installed_plugins.json` (e.g. `context7`)
   - `serverName` = the key from `.mcp.json` (e.g. `context7`)

If the plugin is not found in installed plugins, check if it exists as a directory under `/Users/walid/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/`. If found, read its `.mcp.json` and construct the pattern using the directory name as `pluginKey`.

If still not found, inform the user the plugin wasn't found and list available plugins.

## Step 4: Read and update settings.json

1. Read `~/.claude/settings.json`
2. If the `permissions` key doesn't exist, create it: `{"allow": [], "deny": []}`
3. If the target list key doesn't exist, create it as `[]`
4. **Duplicate check**: If the resolved pattern already exists in the target list, inform the user and STOP:
   ```
   ✓ Pattern "<pattern>" already exists in permissions.<list>. No changes needed.
   ```
5. **Conflict check**: If the resolved pattern exists in the OPPOSITE list, warn the user:
   ```
   ⚠ Pattern "<pattern>" currently exists in permissions.<opposite>. Moving it to permissions.<target>.
   ```
   Remove it from the opposite list before adding.
6. Add the pattern to the target list.
7. Write the updated JSON back to `~/.claude/settings.json` with 2-space indentation.

## Step 5: Confirm

Print a confirmation message:

```
✓ Added "<pattern>" to permissions.<list> in ~/.claude/settings.json
```

## IMPORTANT Rules

- Do NOT ask the user for confirmation before writing. Just do it.
- Do NOT explain what you're doing step by step. Just parse, resolve, write, and confirm.
- Do NOT modify any other keys in settings.json — only touch `permissions`.
- If you can't resolve the input, print a clear error with suggestions.
- Output ONLY the final confirmation line (or error/usage help). No other text.
