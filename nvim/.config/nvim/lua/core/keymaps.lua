-- Keybindings

-- Add blank line below/above without leaving normal mode
vim.keymap.set("n", "go", "o<Esc>k", { desc = "Add blank line below" })
vim.keymap.set("n", "gO", "O<Esc>j", { desc = "Add blank line above" })

-- Clear search highlight
vim.keymap.set("n", "<Esc>", "<cmd>nohlsearch<CR>", { desc = "Clear search highlight" })

-- Diagnostics
vim.keymap.set("n", "<leader>e", vim.diagnostic.open_float, { desc = "Show diagnostic" })
vim.keymap.set("n", "]e", function()
	vim.diagnostic.jump({ count = 1, severity = vim.diagnostic.severity.ERROR })
end, { desc = "Next error" })
vim.keymap.set("n", "[e", function()
	vim.diagnostic.jump({ count = -1, severity = vim.diagnostic.severity.ERROR })
end, { desc = "Previous error" })

-- Split navigation (Alt+hjkl) — shared with Ghostty's performable:goto_split
vim.keymap.set("n", "<A-h>", "<C-w>h", { desc = "Go to left split" })
vim.keymap.set("n", "<A-j>", "<C-w>j", { desc = "Go to lower split" })
vim.keymap.set("n", "<A-k>", "<C-w>k", { desc = "Go to upper split" })
vim.keymap.set("n", "<A-l>", "<C-w>l", { desc = "Go to right split" })

-- Toggle dark/light mode (catppuccin reacts to vim.o.background)
vim.keymap.set("n", "<leader>tb", function()
	vim.o.background = vim.o.background == "dark" and "light" or "dark"
end, { desc = "Toggle dark/light" })
