---
name: nvim
description: >-
  Neovim plugin config in Lua (lazy.nvim, plugin opts). Load when editing files
  under nvim/lua/plugins/ or when overriding a Neovim plugin's keymap/mapping
  table.
user-invocable: true
---

# Neovim plugin configuration

Niche pitfalls when configuring third-party Neovim plugins in Lua. Each rule here was paid for by a real debugging session - respect them.

## MANDATORY checklist — before overriding any plugin mapping

1. **Find the plugin's default config** - `ls ~/.local/share/nvim/lazy/<plugin>/lua/<plugin>/` then open the config file.
2. **grep for exact key case** - `grep -n '["<' <file>` and note whether the key is `<cr>` or `<CR>`, `<tab>` or `<Tab>`, etc.
3. **Match byte-for-byte** - copy the exact case from the default into your override. Do not guess.

Skipping this checklist is the most common source of silent keymap failures.

## Core concepts

### Keymap table merges are case-sensitive

When a plugin merges your user config with its defaults using `vim.tbl_deep_extend("force", defaults, opts)`, the merge operates on **raw Lua string keys**. Lua tables are case-sensitive, so `["<CR>"]` and `["<cr>"]` are treated as **two different keys**, even though Neovim resolves them to the same keycode at runtime.

**The trap:**

```lua
-- Plugin defaults (somewhere in its source)
mappings.status["<cr>"] = "GoToFile"  -- lowercase

-- Your override
opts.mappings.status["<CR>"] = my_function  -- uppercase
```

After merge:

```lua
-- Both keys exist!
mappings.status["<cr>"] = "GoToFile"
mappings.status["<CR>"] = my_function
```

The plugin then iterates the merged table and binds BOTH via `vim.keymap.set`. Since `vim.keymap.set` normalizes keycodes case-insensitively, whichever is bound LAST wins. In Neogit's case, `user_mappings` (functions) are bound first and `config.mappings` (command strings) bound after - so the default silently overrides your function.

**Rule:** When overriding a table-keyed plugin mapping, find the plugin's exact case in its default config and match it **byte-for-byte**.

See [plugin-conventions.md](plugin-conventions.md) for known default conventions by plugin.

### Where the trap does NOT apply

- **Direct `vim.keymap.set` calls** - Vim normalizes keycodes, so `<CR>` and `<cr>` are equivalent at this layer.
- **Array-of-tuples keymap format** - e.g. `{ { "n", "<Tab>", "<Cmd>...<CR>" }, ... }` (diffview, which-key). These are additive lists, not merged by key.
- **Disabled-defaults presets** - e.g. `blink.cmp` with `preset = "none"`. No defaults = no merge collision.

### Verify exact case before overriding

1. Locate the plugin's default config file: usually `~/.local/share/nvim/lazy/<plugin>/lua/<plugin>/config.lua` or similar.
2. `grep -n '["'\''<' <file>` for bracketed key literals.
3. Note the exact case and match it in your override.

A 10-second check that saves an hour of "why doesn't my keymap work."

### Bind order of `user_mappings` vs `config.mappings`

Some plugins bind `user_mappings` (functions) **before** `config.mappings` (command strings). If the same key appears in both - even via case difference - the default binds after yours and wins silently. Neogit is a known example; locate the current bind site with:

```bash
grep -n "user_mappings\|config.mappings" ~/.local/share/nvim/lazy/neogit/lua/neogit/lib/buffer.lua
```

**Fix**: put your override under the exact key the plugin uses in its defaults so the merge collapses to a single entry (yours). This removes the default from the map entirely and there's nothing to re-bind.

See [plugin-conventions.md](plugin-conventions.md) for the Neogit-specific details.

### Reloading plugin config

Editing `opts = { ... }` in a `lazy.nvim` plugin spec does NOT hot-reload. The plugin's `setup()` runs once at init. After changing config:

- **Full nvim restart** (cleanest, safest), or
- **`:Lazy reload <plugin>`** to re-run `setup()` — but note this does NOT re-fire autocmds or re-register sources (e.g. nvim-cmp sources, LSP on-attach handlers) that ran at startup. If your change touches those, only a full restart works.

Don't debug a "my change doesn't work" issue without reloading.

## Rules

1. **Match plugin default case byte-for-byte** when overriding any table-keyed mapping. `<CR>` ≠ `<cr>` at the Lua table level, even though Neovim treats them identically at runtime.

2. **Verify case before overriding** - grep the plugin's default config for the key; copy the exact case.

3. **Reload after config edits** - `:Lazy reload <plugin>` or restart nvim. `opts` is only read at plugin init.

4. **Use `vim.keymap.set` for global mappings** - not plugin config tables - when the mapping isn't scoped to a specific plugin buffer. Avoids the merge-trap entirely.

5. **Prefer array-of-tuples format** if writing your own plugin or config layer. `{ { mode, key, rhs, opts }, ... }` is additive and has no merge-by-key pitfalls.

6. **Read the bind order** of user vs default mappings in any plugin where you pass functions alongside overridden defaults. If user is bound first, default-bound-after will clobber yours unless you replace the default entry directly.

7. **Don't guess keycode equivalence** at config-table level. `<Tab>` / `<tab>`, `<CR>` / `<cr>`, `<Esc>` / `<esc>`, `<C-Space>` / `<C-space>` - any of these can be the difference between "works" and "silently ignored."

## FORBIDDEN / MANDATORY

| | Rule |
|---|---|
| FORBIDDEN | Guessing keycode case in a table-keyed mapping. Always grep the plugin source first. |
| FORBIDDEN | Writing `["<CR>"]` to override a plugin default without confirming the default uses `<CR>` not `<cr>`. |
| FORBIDDEN | Assuming `:Lazy reload` fully resets plugin state. Full restart is required for autocmds/sources. |
| MANDATORY | Follow the 3-step checklist above before every mapping override. |
| MANDATORY | Match plugin default key case byte-for-byte in all table-keyed overrides. |
| MANDATORY | Verify the bind order (user vs default) in any plugin where you pass functions alongside string defaults. |

## lazy.nvim spec patterns

When writing or modifying a plugin spec, use the right field:

| Need | Use | Notes |
|---|---|---|
| Pass config to `setup()` | `opts = { ... }` | Merged with any parent spec `opts`; lazy.nvim calls `setup(opts)` automatically. |
| Custom setup logic | `config = function(_, opts) ... end` | Receives the merged `opts`; use when you need to call multiple setup fns or do pre/post work. |
| Declare plugin deps | `dependencies = { ... }` | Loaded before this plugin. Order within the array is respected. |
| Load on filetype | `ft = { "lua", "python" }` | Defers load until that filetype is opened. |
| Load on command | `cmd = { "Neogit" }` | Defers load until command is invoked. |
| Load on event | `event = "BufReadPost"` | Common events: `VeryLazy`, `BufReadPost`, `InsertEnter`. |
| Pin a version | `tag = "v1.2.3"` or `commit = "<sha>"` | Prefer `tag` when the plugin uses semver releases. |

**`opts` vs `config` decision rule**: if `setup(opts)` is the only call needed, use `opts`. Reach for `config` only when you need imperative logic around setup.

## Quick reference

| Pattern | Case-sensitive merge trap? |
|---|---|
| `opts.mappings = { ["<cr>"] = ... }` (table keyed by string) | **Yes** - match plugin default case exactly |
| `opts.keymap = { preset = "none", ["<CR>"] = ... }` | No - defaults disabled |
| `opts.keymaps = { { "n", "<CR>", ... } }` (tuple array) | No - additive format |
| `vim.keymap.set("n", "<CR>", ...)` | No - vim normalizes |
