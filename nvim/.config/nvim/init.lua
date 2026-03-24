-- Bootstrap lazy.nvim
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"
if not vim.uv.fs_stat(lazypath) then
	vim.fn.system({
		"git",
		"clone",
		"--filter=blob:none",
		"https://github.com/folke/lazy.nvim.git",
		"--branch=stable",
		lazypath,
	})
end
vim.opt.rtp:prepend(lazypath)

-- Load core settings before plugins
require("core.options")
require("core.autocmd")

-- Setup lazy.nvim — auto-imports from lua/plugins/ and lua/themes/
require("lazy").setup({
	spec = {
		{ import = "plugins" },
		{ import = "themes" },
	},
	install = { colorscheme = { "catppuccin" } },
	checker = { enabled = false },
})

-- Load keymaps after plugins
require("core.keymaps")
