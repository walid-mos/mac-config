-- Autocommands

vim.api.nvim_create_autocmd("TextYankPost", {
	desc = "Highlight on yank",
	callback = function()
		vim.hl.on_yank({ higroup = "Visual", timeout = 200 })
	end,
})
