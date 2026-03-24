-- Keybindings
-- TODO: configure keymaps

-- Toggle dark/light mode (catppuccin reacts to vim.o.background)
vim.keymap.set("n", "<leader>tb", function()
	vim.o.background = vim.o.background == "dark" and "light" or "dark"
end, { desc = "Toggle dark/light" })
