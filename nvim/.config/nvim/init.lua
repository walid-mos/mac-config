-- Neovim Configuration V3
-- Clean, modular configuration with Lazy.nvim plugin manager

-- Step 1: Load core options (includes leader keys)
require("core.options")

-- Step 2: Bootstrap Lazy.nvim
local lazypath = vim.fn.stdpath("data") .. "/lazy/lazy.nvim"

if not vim.loop.fs_stat(lazypath) then
	local lazyrepo = "https://github.com/folke/lazy.nvim.git"
	vim.fn.system({
		"git",
		"clone",
		"--filter=blob:none",
		"--branch=stable",
		lazyrepo,
		lazypath,
	})
end

vim.opt.rtp:prepend(lazypath)

-- Step 3: Setup Lazy.nvim with auto-imports
require("lazy").setup({
	-- Auto-import all plugin specs from lua/plugins/ and lua/themes/
	spec = {
		{ import = "plugins" },
		{ import = "themes" },
	},

	-- Plugin installation settings
	install = {
		colorscheme = { "rose-pine" },
	},

	-- UI settings
	ui = {
		border = "rounded",
		icons = {
			cmd = "⌘",
			config = "🛠",
			event = "📅",
			ft = "📂",
			init = "⚙",
			keys = "🗝",
			plugin = "🔌",
			runtime = "💻",
			require = "🌙",
			source = "📄",
			start = "🚀",
			task = "📌",
			lazy = "💤 ",
		},
	},

	-- Performance optimizations
	performance = {
		rtp = {
			disabled_plugins = {
				"gzip",
				"tarPlugin",
				"tohtml",
				"tutor",
				"zipPlugin",
			},
		},
	},

	-- Version control
	lockfile = vim.fn.stdpath("config") .. "/lazy-lock.json",
})

-- Step 4: Load keymaps after plugins are loaded
require("core.keymaps")
