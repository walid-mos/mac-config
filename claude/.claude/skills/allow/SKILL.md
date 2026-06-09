---
name: allow
user-invocable: true
description: >-
  Add or remove tool permissions in Claude Code settings.json (allow/deny
  lists). Use when the user runs `/allow`, says "allow npm", "allow this
  command", "deny rm -rf", or pastes a Claude permission prompt to
  approve/deny it.
---

# Allow - Permission Management

## Step 1: Handle empty input

If `$ARGUMENTS` is empty or blank, print this usage help and STOP:

```
Usage: /allow [deny|blacklist] <tool-or-pattern>

Examples:
  /allow bash              -> allow "Bash"
  /allow git               -> allow "Bash(git:*)"
  /allow deny rm -rf       -> deny "Bash(rm -rf *)"
  /allow context7          -> allow "mcp__plugin_context7_context7__*"
  /allow edit /tmp         -> allow "Edit(/tmp/**)"
  /allow web fetch         -> allow "WebFetch(*)"
  /allow domain github.com -> allow "WebFetch(domain:github.com)"

Bypass mode (manage security heuristic auto-approvals):
  /allow bypass                     -> list current heuristic bypass patterns
  /allow bypass <name>              -> add a known pattern by name
  /allow bypass custom "<regex>"    -> add a custom PCRE regex
  /allow deny bypass <name>         -> remove a bypass pattern

  Known names: command_substitution, brace_obfuscation, dot_source,
               heredoc, quoted_flags, cd_git_compound, consecutive_quotes

Paste mode: Copy a Claude permission prompt and paste it as the argument.
  Supports standard tool prompts AND "Network request outside of sandbox" prompts.
  If the prompt contains a security heuristic warning, the bypass pattern is also added.
```

## Step 2: Detect mode

Evaluate in strict priority order — stop at the first match:

1. **Bypass Mode** (highest priority): The first word (after optional deny/blacklist) is `bypass`. See [bypass-mode.md](bypass-mode.md).
2. **Paste Mode**: The input contains newlines AND at least one line starting with 3+ spaces (indented content from a Claude permission prompt). See [paste-mode.md](paste-mode.md).
3. **Manual Mode** (default): Single-line or no indented lines. See [manual-mode.md](manual-mode.md). If manual mode dispatches to MCP discovery, see [mcp-discovery.md](mcp-discovery.md).

**MANDATORY**: Never re-evaluate mode once matched. Bypass always wins over paste; paste always wins over manual.

## Domain extraction

When resolving a domain (from a pasted `Host:` line, a `domain`/`host` input, or a `webfetch <domain>` input), always extract the **root domain** - strip subdomains.

| Input | Extracted domain |
|---|---|
| `api.github.com` | `github.com` |
| `eu-central-1-1.aws.cloud2.influxdata.com` | `influxdata.com` |
| `release-assets.githubusercontent.com` | `githubusercontent.com` |
| `registry.npmjs.org` | `npmjs.org` |
| `my.app.co.uk` | `app.co.uk` |
| `github.com` | `github.com` |
| `localhost` | `localhost` |

Apply this extraction to `WebFetch(domain:...)` patterns. For `sandbox.network.allowedDomains` entries, use the **wildcard format**: `*.<rootDomain>` (e.g. `*.github.com`, `*.npmjs.org`). This covers the root domain and all its subdomains in a single entry.

## Step 3: Read and update settings.json

After resolving a pattern from paste or manual mode, apply it:

1. Read `~/.claude/settings.json`. **If it is malformed JSON** (parse fails), do NOT overwrite or recreate it — STOP and surface a clear error naming the file and the parse problem (the offending line if you can locate it) so the user fixes it by hand. Never back-up-and-recreate: that silently drops their config.
2. If the `permissions` key doesn't exist, create it: `{"allow": [], "deny": []}`
3. If the target list key doesn't exist, create it as `[]`
4. **Duplicate check**: If the resolved pattern already exists in the target list, inform the user and STOP:
   ```
   Pattern "<pattern>" already exists in permissions.<list>. No changes needed.
   ```
5. **Conflict check**: If the resolved pattern exists in the OPPOSITE list, warn the user:
   ```
   Pattern "<pattern>" currently exists in permissions.<opposite>. Moving it to permissions.<target>.
   ```
   Remove it from the opposite list before adding.
6. Add the pattern to the target list.
7. Write the updated JSON back to `~/.claude/settings.json` with 2-space indentation.

## Step 4: Confirm

Print a confirmation message:

```
Added "<pattern>" to permissions.<list> in ~/.claude/settings.json
```

## IMPORTANT Rules

- Do NOT ask the user for confirmation before writing. Just do it.
- Do NOT explain what you're doing step by step. Just parse, resolve, write, and confirm.
- Do NOT modify any other keys in settings.json - only touch `permissions`.
- If you can't resolve the input, print a clear error with suggestions.
- Output ONLY the final confirmation line (or error/usage help). No other text.
