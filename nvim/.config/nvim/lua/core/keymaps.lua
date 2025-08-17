-- Set <space> as the leader key
-- See `:help mapleader`
-- NOTE: Must happen before plugins are required (otherwise wrong leader will be used)
vim.g.mapleader = ' '
vim.g.maplocalleader = '//'

local keymap = vim.keymap.set
local opts = { noremap = true, silent = true }

-- Open explorer menu Netrw's with only <leader>- key
-- Moved to telescope.lua for proper state tracking

-- Buffer
keymap("n", "<leader>bn", ":bn<CR>", { desc = 'Next buffer' })
keymap("n", "<leader>bp", ":bp<CR>", { desc = 'Prev buffer' })
keymap("n", "<leader>C", ":bd<CR>", { desc = 'Close current buffer' })
keymap("n", "<leader><tab>", "<C-^>", { desc = 'Switch to last buffer' })

-- Quickfix
keymap("n", "]q", ":cnext<CR>", opts)
keymap("n", "[q", ":cprev<CR>", opts)
keymap("n", "]l", ":lnext<CR>", opts)
keymap("n", "[l", ":lprev<CR>", opts)

-- Normal
-- Better window navigation (remplacé par vim-tmux-navigator)
-- keymap("n", "<A-h>", "<C-w>h", opts)
-- keymap("n", "<A-j>", "<C-w>j", opts)
-- keymap("n", "<A-k>", "<C-w>k", opts)
-- keymap("n", "<A-l>", "<C-w>l", opts)
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

-- Normal
-- Indent fast
keymap("n", "<", "<<", opts)
keymap("n", ">", ">>", opts)

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
keymap({ "n", "o", "x" }, "<leader>h", "^", { desc = 'Line start' })
keymap({ "n", "o", "x" }, "<leader>l", "g_", { desc = 'Line end' })

-- Remove line ending
keymap({ "n", "i" }, "<S-A-j>", ":join<CR>", opts)

-- tailwind bearable to work with
keymap({ "n", "x" }, "j", "gj", opts)
keymap({ "n", "x" }, "k", "gk", opts)
-- keymap("n", "<leader>w", ":lua vim.wo.wrap = not vim.wo.wrap<CR>", opts)


-- Yank and paste from multiple files / buffers
--keymap({'n', 'v'}, '<leader>y', '"*y', { desc = '[Y]ank between files' })
--keymap({'n', 'v'}, '<leader>p', '"*p', { desc = '[P]aste between files' })

-- Claude Code integration
local claude = require('utils.claude_integration')

keymap('n', '<leader>cf', claude.send_file, { desc = 'Send file to Claude Code' })
keymap('x', '<leader>cs', claude.send_selection, { desc = 'Send selected text to Claude Code' })
