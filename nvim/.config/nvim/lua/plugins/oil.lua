-- oil.nvim: Edit your filesystem like a buffer
-- Inspired by vim-vinegar, replaces netrw with a better experience
-- Press `-` to open oil in the current directory

return {
	"stevearc/oil.nvim",
	dependencies = { "nvim-tree/nvim-web-devicons" },

	-- Lazy-load when pressing `<leader>-` key
	keys = {
		{
			"<leader>-",
			function()
				require("oil").open(vim.fn.expand("%:p:h"))
			end,
			desc = "Open file explorer in current directory",
		},
	},

	opts = {
		-- Oil will take over directory buffers (disables netrw)
		default_file_explorer = true,

		-- Columns to display
		-- Options: "icon", "permissions", "size", "mtime"
		columns = {
			"icon",
		},

		-- Buffer-local options for oil buffers
		buf_options = {
			buflisted = false,
			bufhidden = "hide",
		},

		-- Window-local options for oil buffers
		win_options = {
			wrap = false,
			signcolumn = "no",
			cursorcolumn = false,
			foldcolumn = "0",
			spell = false,
			list = false,
			conceallevel = 3,
			concealcursor = "nvic",
		},

		-- Send deleted files to trash instead of permanently deleting them
		delete_to_trash = false,

		-- Skip confirmation popup for simple operations
		skip_confirm_for_simple_edits = false,

		-- Prompt to save changes when selecting new file/directory
		prompt_save_on_select_new_entry = true,

		-- Keymaps in oil buffer
		keymaps = {
			["g?"] = "actions.show_help",
			["<CR>"] = "actions.select",
			["<C-v>"] = { "actions.select", opts = { vertical = true }, desc = "Open in vertical split" },
			["<C-s>"] = { "actions.select", opts = { horizontal = true }, desc = "Open in horizontal split" },
			["<C-t>"] = { "actions.select", opts = { tab = true }, desc = "Open in new tab" },
			["<C-p>"] = "actions.preview",
			["<C-c>"] = { "actions.close", mode = "n" },
			["<C-l>"] = "actions.refresh",
			["-"] = { "actions.parent", mode = "n", desc = "Go to parent directory" },
			["_"] = { "actions.open_cwd", mode = "n", desc = "Open current working directory" },
			["`"] = { "actions.cd", mode = "n", desc = "Change directory" },
			["g."] = { "actions.toggle_hidden", mode = "n", desc = "Toggle hidden files" },
		},

		-- Use default keymaps
		use_default_keymaps = true,

		-- View options
		view_options = {
			-- Show files and directories that start with "."
			show_hidden = false,

			-- This function defines what is considered a "hidden" file
			is_hidden_file = function(name, bufnr)
				return vim.startswith(name, ".")
			end,

			-- Files and directories to never show
			is_always_hidden = function(name, bufnr)
				return name == ".." or name == ".git"
			end,

			-- Sort order: [ "asc", "desc" ]
			sort = {
				{ "type", "asc" }, -- Directories first
				{ "name", "asc" },
			},
		},

		-- Window configuration
		float = {
			padding = 2,
			max_width = 0,
			max_height = 0,
			border = "rounded",
			win_options = {
				winblend = 0,
			},
		},
	},
}
