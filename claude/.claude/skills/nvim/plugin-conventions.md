# Plugin default conventions

Quick reference for the exact case and format used by common Neovim plugins in their default keymap tables. Verified against each plugin's source in `~/.local/share/nvim/lazy/<plugin>/`. Always re-verify after a plugin update — conventions can change.

## By plugin

### neogit (`NeogitOrg/neogit`)

- **Format**: table keyed by string, merged with defaults via `vim.tbl_deep_extend`.
- **Case**: **LOWERCASE** for special keys. Defaults include `["<cr>"] = "GoToFile"`, `["<tab>"] = "Toggle"`, `["<s-cr>"] = "PeekFile"`.
- **Bind order gotcha**: `user_mappings` (functions) are bound BEFORE `config.mappings` (command strings) in `neogit/lib/buffer.lua`. A user function at `<CR>` gets clobbered by the default `<cr>` string binding unless the default is replaced or cleared.
- **Correct override**:
  ```lua
  opts = {
    mappings = {
      status = {
        ["<cr>"] = my_function,   -- lowercase, replaces default
        ["<tab>"] = "Toggle",     -- lowercase
      },
    },
  }
  ```
- **Accepts**: `string` (command name), `boolean` (`false` disables), `function` (custom Lua) per `neogit/config.lua:1027`.

### oil.nvim (`stevearc/oil.nvim`)

- **Format**: table keyed by string, merged with defaults.
- **Case**: **UPPERCASE** for special keys. Defaults: `["<CR>"] = "actions.select"`, `["<C-t>"]`, `["<C-s>"]`, `["<C-h>"]`, `["<C-p>"]`.
- **Correct override**: use `<CR>`, `<C-t>` etc. Uppercase matches the defaults.

### telescope.nvim (`nvim-telescope/telescope.nvim`)

- **Format**: `mappings.i = {...}`, `mappings.n = {...}` — table keyed by string.
- **Case**: **UPPERCASE**. Defaults: `["<CR>"] = actions.select_default`, `["<C-n>"]`, `["<C-p>"]`, `["<C-q>"]`.
- **Correct override**: uppercase.

### blink.cmp (`Saghen/blink.cmp`)

- **Format**: `keymap = { preset = "...", [...] = ... }`.
- **Case**: MOSTLY UPPERCASE but inconsistent — e.g. `["<C-space>"]` is lowercase `space`, while `["<Up>"]`, `["<Tab>"]`, `["<CR>"]` are uppercase.
- **Mitigation**: `preset = "none"` disables all defaults, so user keys are the only source. No merge collision.
- **If using a preset**: grep `~/.local/share/nvim/lazy/blink.cmp/lua/blink/cmp/keymap/presets.lua` for the preset you're using and match its case exactly.

### diffview.nvim (`sindrets/diffview.nvim`)

- **Format**: **array of tuples** — `{ { mode, key, rhs, opts }, ... }`. NOT table-keyed by string.
- **Case sensitivity**: doesn't apply — entries are appended, not merged by key. `vim.keymap.set` normalizes at bind time.
- **Caveat**: duplicate entries for the same key are both registered; last-wins at Vim's keycode layer. Safe, but don't bloat the list.

### which-key.nvim (`folke/which-key.nvim`)

- **Format**: `spec` is an array of tables. Additive, no merge-by-key trap.

## Verification workflow

If a plugin isn't listed above, do this before overriding any keymap:

```bash
# 1. Locate the plugin's default config
ls ~/.local/share/nvim/lazy/<plugin>/lua/<plugin>/

# 2. Grep for the default keymap table
grep -rn '\["<' ~/.local/share/nvim/lazy/<plugin>/lua/ | head -20

# 3. Note the exact case — match it byte-for-byte in your override
```

If the plugin uses `vim.tbl_deep_extend` to merge user config with defaults (most Lua plugins do), case MUST match. If it uses an additive array format, order of entries is the only thing that matters.

## Red flags to look for in a plugin's source

When reviewing an unfamiliar plugin, grep for these patterns to spot the merge trap:

```bash
grep -n "tbl_deep_extend\|tbl_extend" lua/<plugin>/**/*.lua
grep -n "user_mappings\|user_keys" lua/<plugin>/**/*.lua
```

If you see `tbl_deep_extend("force", defaults, opts)` combined with a string-keyed mappings table, assume case matters and verify.
