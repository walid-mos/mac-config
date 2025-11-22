-- Keymaps Configuration
-- Leader keys are set in core/options.lua
-- All keymaps use vim.keymap.set with descriptions for discoverability

local keymap = vim.keymap.set

-- Buffer navigation
keymap("n", "<leader>bn", ":bn<CR>", { desc = 'Next buffer' })
keymap("n", "<leader>bp", ":bp<CR>", { desc = 'Prev buffer' })
keymap("n", "<leader>C", ":bd<CR>", { desc = 'Close current buffer' })
keymap("n", "<leader><tab>", "<C-^>", { desc = 'Switch to last buffer' })

-- Quickfix and location list navigation
keymap("n", "]q", ":cnext<CR>", { desc = 'Next quickfix item' })
keymap("n", "[q", ":cprev<CR>", { desc = 'Previous quickfix item' })
keymap("n", "]l", ":lnext<CR>", { desc = 'Next location list item' })
keymap("n", "[l", ":lprev<CR>", { desc = 'Previous location list item' })

-- Window/Split management
keymap("n", "sv", ":vsplit<CR>", { desc = 'Vertical split' })
keymap("n", "sn", ":split<CR>", { desc = 'Horizontal split' })

-- Move lines up and down (Alt+arrows)
keymap("n", "<A-Down>", ":m .+1<CR>==", { desc = 'Move line down' })
keymap("n", "<A-Up>", ":m .-2<CR>==", { desc = 'Move line up' })
keymap("v", "<A-Down>", ":m '>+1<CR>gv=gv", { desc = 'Move selection down' })
keymap("v", "<A-Up>", ":m '<-2<CR>gv=gv", { desc = 'Move selection up' })

-- Add lines
keymap('n', 'go', 'o<Esc>k', { desc = 'Add one line after' })
keymap('n', 'gO', 'O<Esc>j', { desc = 'Add one line before' })

-- Paste without yanking replaced text
keymap("x", "p", [["_dP]], { desc = 'Paste without yanking' })

-- Clear search highlight
keymap("n", "<leader>ch", ":noh<CR>", { desc = 'Clear highlight' })

-- Indentation
keymap("n", "<", "<<", { desc = 'Indent left' })
keymap("n", ">", ">>", { desc = 'Indent right' })
keymap("v", "<", "<gv", { desc = 'Indent left (stay in visual)' })
keymap("v", ">", ">gv", { desc = 'Indent right (stay in visual)' })


-- Insert mode navigation
keymap("i", "<A-k>", "<Esc>2wi", { desc = 'Move forward 2 words' })
keymap("i", "<A-j>", "<Esc>bi", { desc = 'Move backward 1 word' })
keymap("i", "<A-h>", "<Esc>0i", { desc = 'Move to line start' })
keymap("i", "<A-l>", "<Esc>$i", { desc = 'Move to line end' })
keymap("i", "<A-BS>", "<Esc>wdbi", { desc = 'Delete word backward' })


-- Diagnostics (LSP required)
keymap('n', '[d', vim.diagnostic.goto_prev, { desc = 'Go to previous diagnostic message' })
keymap('n', ']d', vim.diagnostic.goto_next, { desc = 'Go to next diagnostic message' })
keymap('n', '<leader>e', function()
  vim.diagnostic.open_float({ focusable = true })
end, { desc = 'Open floating diagnostic message (focusable)' })
keymap('n', '<leader>q', vim.diagnostic.setloclist, { desc = 'Open diagnostics list' })

-- Search with auto-centering
keymap("n", "n", "nzz", { desc = 'Next search result (centered)' })
keymap("n", "N", "Nzz", { desc = 'Previous search result (centered)' })
keymap("n", "*", "*zz", { desc = 'Search word under cursor (centered)' })
keymap("n", "#", "#zz", { desc = 'Search word under cursor backward (centered)' })

-- Easier start and endline navigation
keymap({ "n", "o", "x" }, "H", "^", { desc = 'Line start' })
keymap({ "n", "o", "x" }, "L", "g_", { desc = 'Line end' })

-- Treesitter utilities (plugin required)
keymap('n', '<leader>tr', function()
  vim.cmd('TSBufDisable highlight')
  vim.cmd('TSBufEnable highlight')
end, { desc = 'Reset Treesitter highlighting' })
