-- Autocmds: General editor behavior autocmds
-- Plugin-specific autocmds remain in their respective plugin files

-- ============================================================================
-- File Change Handling
-- ============================================================================

-- Auto-reload files changed outside Neovim
vim.api.nvim_create_autocmd({ "FocusGained", "BufEnter" }, {
	callback = function()
		vim.cmd("silent! checktime")
	end,
})

-- Prompt user when file changed externally
vim.api.nvim_create_autocmd("FileChangedShell", {
	callback = function()
		local choice = vim.fn.confirm("File changed outside of Nvim. Reload?", "&Yes\n&No\n&Load Both (diff)", 1)
		if choice == 1 then
			vim.cmd("edit")
		elseif choice == 3 then
			vim.cmd("DiffOrig")
		end
	end,
})

-- ============================================================================
-- Visual Feedback
-- ============================================================================

-- Highlight yanked text
local highlight_group = vim.api.nvim_create_augroup("YankHighlight", { clear = true })
vim.api.nvim_create_autocmd("TextYankPost", {
	callback = function()
		vim.highlight.on_yank()
	end,
	group = highlight_group,
	pattern = "*",
})

-- ============================================================================
-- Treesitter
-- ============================================================================

-- Fix Treesitter highlighter errors after updates
vim.api.nvim_create_autocmd("User", {
	pattern = "TSUpdate",
	callback = function()
		vim.schedule(function()
			pcall(vim.cmd, "TSBufDisable highlight")
			pcall(vim.cmd, "TSBufEnable highlight")
		end)
	end,
})
