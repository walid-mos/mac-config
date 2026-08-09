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

-- Split creation
vim.keymap.set("n", "<leader>sh", "<cmd>vsplit<CR>", { desc = "Split right" })
vim.keymap.set("n", "<leader>sv", "<cmd>split<CR>", { desc = "Split below" })

-- Split navigation is owned by the herdr-nvim-nav plugin (lua/plugins/herdr-nav.lua).
-- herdr's alt+hjkl trigger forwards a hardcoded ctrl+hjkl into nvim, so the plugin
-- must bind ctrl+hjkl here — alt would never fire.

-- Toggle dark/light mode (catppuccin reacts to vim.o.background)
vim.keymap.set("n", "<leader>tb", function()
	vim.o.background = vim.o.background == "dark" and "light" or "dark"
end, { desc = "Toggle dark/light" })
