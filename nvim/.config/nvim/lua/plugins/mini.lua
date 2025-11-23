-- Mini.nvim: Collection of lightweight, independent modules
-- Only using essential modules for productivity

return {
	"echasnovski/mini.nvim",
	version = false,
	config = function()
		-- mini.pairs: Auto-close brackets, quotes, etc.
		require("mini.pairs").setup({
			modes = { insert = true, command = false, terminal = false },
			mappings = {
				["("] = { action = "open", pair = "()", neigh_pattern = "[^\\]." },
				["["] = { action = "open", pair = "[]", neigh_pattern = "[^\\]." },
				["{"] = { action = "open", pair = "{}", neigh_pattern = "[^\\]." },

				[")"] = { action = "close", pair = "()", neigh_pattern = "[^\\]." },
				["]"] = { action = "close", pair = "[]", neigh_pattern = "[^\\]." },
				["}"] = { action = "close", pair = "{}", neigh_pattern = "[^\\]." },

				['"'] = { action = "closeopen", pair = '""', neigh_pattern = "[^\\].", register = { cr = false } },
				["'"] = { action = "closeopen", pair = "''", neigh_pattern = "[^%a\\].", register = { cr = false } },
				["`"] = { action = "closeopen", pair = "``", neigh_pattern = "[^\\].", register = { cr = false } },
			},
		})

		-- mini.comment: Smart commenting
		require("mini.comment").setup({
			options = {
				custom_commentstring = function()
					return require("ts_context_commentstring.internal").calculate_commentstring()
						or vim.bo.commentstring
				end,
				ignore_blank_line = true,
			},
			mappings = {
				comment = "gc",
				comment_line = "gcc",
				comment_visual = "gc",
				textobject = "gc",
			},
		})

		-- mini.surround: Surround text objects
		require("mini.surround").setup({
			mappings = {
				add = "sa", -- Add surrounding in Normal and Visual modes
				delete = "sd", -- Delete surrounding
				find = "sf", -- Find surrounding (to the right)
				find_left = "sF", -- Find surrounding (to the left)
				highlight = "sh", -- Highlight surrounding
				replace = "sr", -- Replace surrounding
				update_n_lines = "sn", -- Update `n_lines`
			},
		})

		-- mini.ai: Better text objects
		require("mini.ai").setup({
			n_lines = 500,
			custom_textobjects = {
				o = require("mini.ai").gen_spec.treesitter({
					a = { "@block.outer", "@conditional.outer", "@loop.outer" },
					i = { "@block.inner", "@conditional.inner", "@loop.inner" },
				}, {}),
				f = require("mini.ai").gen_spec.treesitter({ a = "@function.outer", i = "@function.inner" }, {}),
				c = require("mini.ai").gen_spec.treesitter({ a = "@class.outer", i = "@class.inner" }, {}),
			},
		})

		-- mini.indentscope: Show indent scope
		require("mini.indentscope").setup({
			symbol = "│",
			options = { try_as_border = true },
			draw = {
				delay = 0,
				animation = function()
					return 0
				end,
			},
		})

		-- Disable for certain filetypes
		vim.api.nvim_create_autocmd("FileType", {
			pattern = {
				"help",
				"lazy",
				"mason",
				"notify",
				"fzf",
			},
			callback = function()
				vim.b.miniindentscope_disable = true
			end,
		})
	end,
}
