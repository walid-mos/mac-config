-- Catppuccin Colorscheme
-- https://github.com/catppuccin/nvim

return {
	"catppuccin/nvim",
	name = "catppuccin",
	priority = 1000,

	opts = {
		flavour = "auto",
		background = {
			light = "latte",
			dark = "macchiato",
		},
		transparent_background = false,
		dim_inactive = {
			enabled = false,
			shade = "dark",
			percentage = 0.15,
		},
		no_italic = false,
		no_bold = false,
		no_underline = false,

		styles = {
			comments = { "italic" },
			conditionals = { "italic" },
			loops = {},
			functions = {},
			keywords = {},
			strings = {},
			variables = {},
			numbers = {},
			booleans = {},
			properties = {},
			types = {},
			operators = {},
		},

		integrations = {
			blink_cmp = true,
			gitsigns = true,
			mason = true,
			mini = { enabled = true },
			telescope = { enabled = true },
			treesitter = true,
			which_key = true,
		},

		custom_highlights = function(colors)
			return {
				CursorLineNr = { fg = colors.yellow, style = { "bold" } },
				WinSeparator = { fg = colors.overlay0, bg = "NONE" },
			}
		end,
	},

	config = function(_, opts)
		require("catppuccin").setup(opts)
		vim.cmd.colorscheme("catppuccin")
	end,
}
