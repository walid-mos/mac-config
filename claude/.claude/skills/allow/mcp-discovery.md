# MCP Discovery (Step 3C)

When the input looks like an MCP/plugin name (e.g. `context7`, `mcp playwright`, `github`):

1. Read `~/.claude/plugins/installed_plugins.json`
2. Look through the plugin keys for one containing the user's input (e.g. `context7@claude-plugins-official`)
3. Extract the plugin name (before the `@`): e.g. `context7`
4. Read the `.mcp.json` at the plugin's marketplace path: `~/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/<pluginName>/.mcp.json`
5. Get the server name (the top-level key in the JSON): e.g. `context7`
6. Construct: `mcp__plugin_<pluginKey>_<serverName>__*`
   - `pluginKey` = the part before `@` in `installed_plugins.json` (e.g. `context7`)
   - `serverName` = the key from `.mcp.json` (e.g. `context7`)

If the plugin is not found in installed plugins, check if it exists as a directory under `~/.claude/plugins/marketplaces/claude-plugins-official/external_plugins/`. If found, read its `.mcp.json` and construct the pattern using the directory name as `pluginKey`.

If still not found, inform the user the plugin wasn't found and list available plugins.
