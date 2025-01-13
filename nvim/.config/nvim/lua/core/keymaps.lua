-- Set <space> as the leader key
-- See `:help mapleader`
-- NOTE: Must happen before plugins are required (otherwise wrong leader will be used)
vim.g.mapleader = ' '
vim.g.maplocalleader = ' '

local keymap = vim.keymap.set
local opts = { noremap = true, silent = true }

-- Open explorer menu Netrw's with only <leader>- key
keymap('n', '<leader>-', ":Telescope file_browser path=%:p:h select_buffer=true<CR>", { desc = 'Open file explorer' })

-- Buffer
keymap("n", "<C-n>", ":bn<CR>")
keymap("n", "<C-b>", ":bp<CR>")
keymap("n", "<leader>C", ":bp|bd! # <CR>", { desc = 'Close actual buffer' })

-- Normal
-- Better window navigation
keymap("n", "<C-h>", "<C-w>h", opts)
keymap("n", "<C-j>", "<C-w>j", opts)
keymap("n", "<C-l>", "<C-w>l", opts)
keymap("n", "<C-k>", "<C-w>k", opts)
keymap("n", "ss", ":vsplit<CR>", opts)
keymap("n", "sv", ":split<CR>", opts)

-- Move lines
keymap({ 'n', 'v' }, 'J', ':m .+1<CR>==', opts)
keymap({ 'n', 'v' }, 'K', ':m .-2<CR>==', opts)

-- Add lines
keymap('n', 'go', 'o<Esc>k', { desc = 'Add one line after' })
keymap('n', 'gO', 'O<Esc>j', { desc = 'Add one line before' })

-- Do not copy when pasted on
keymap("x", "p", [["_dP]])

keymap("n", "<leader>ch", ":noh<CR>", { desc = 'Clear highlight' })

-- Visual
-- Stay in indent mode
keymap("v", "<", "<gv", opts)
keymap("v", ">", ">gv", opts)


-- Insert
-- Move in line
keymap("i", "<A-k>", "<Esc>2wi", opts)
keymap("i", "<A-j>", "<Esc>bi", opts)
keymap("i", "<A-h>", "<Esc>0i", opts)
keymap("i", "<A-l>", "<Esc>$i", opts)
-- Delete a word
keymap("i", "<A-BS>", "<Esc>wdbi", opts)


-- Utils
-- Diagnostic keymaps
keymap('n', '[d', vim.diagnostic.goto_prev, { desc = 'Go to previous diagnostic message' })
keymap('n', ']d', vim.diagnostic.goto_next, { desc = 'Go to next diagnostic message' })
keymap('n', '<leader>e', vim.diagnostic.open_float, { desc = 'Open floating diagnostic message' })
keymap('n', '<leader>q', vim.diagnostic.setloclist, { desc = 'Open diagnostics list' })

-- Utils for centering in search mode
keymap("n", "n", "nzz", opts)
keymap("n", "N", "Nzz", opts)
keymap("n", "*", "*zz", opts)
keymap("n", "#", "#zz", opts)

-- Easier start and endline
keymap({ "n", "o", "x" }, "<A-h>", "^", opts)
keymap({ "n", "o", "x" }, "<A-l>", "g_", opts)

-- Remove line ending
keymap({ "n", "i" }, "<S-A-j>", ":join<CR>", opts)

-- tailwind bearable to work with
keymap({ "n", "x" }, "j", "gj", opts)
keymap({ "n", "x" }, "k", "gk", opts)
keymap("n", "<leader>w", ":lua vim.wo.wrap = not vim.wo.wrap<CR>", opts)


-- Yank and paste from multiple files / buffers
--keymap({'n', 'v'}, '<leader>y', '"*y', { desc = '[Y]ank between files' })
--keymap({'n', 'v'}, '<leader>p', '"*p', { desc = '[P]aste between files' })
