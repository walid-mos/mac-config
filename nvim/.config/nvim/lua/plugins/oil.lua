-- oil.nvim: Edit your filesystem like a buffer
-- Inspired by vim-vinegar, replaces netrw with a better experience
-- Press `-` to open oil in the current directory

-- Global function to display relative path in winbar
function _G.get_oil_winbar()
	local oil = require("oil")
	local bufnr = vim.api.nvim_win_get_buf(vim.g.statusline_winid or 0)
	local dir = oil.get_current_dir(bufnr)

	if dir then
		-- Show relative to cwd: ./project/path
		return vim.fn.fnamemodify(dir, ":~:.")
	else
		-- Fallback for remote paths
		return vim.api.nvim_buf_get_name(bufnr)
	end
end

return {
	"stevearc/oil.nvim",
	dependencies = { "nvim-tree/nvim-web-devicons" },
	lazy = false, -- Load immediately to hijack directory buffers

	-- Auto-open preview when Oil starts
	config = function()
		require("oil").setup({
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
				-- Show relative path from Oil root in window bar
				winbar = "%!v:lua.get_oil_winbar()",
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
				["<leader>pv"] = { "actions.preview", opts = { vertical = true }, desc = "Preview in vertical split" },
				["<leader>ph"] = { "actions.preview", opts = { horizontal = true }, desc = "Preview in horizontal split" },
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
				preview_split = "right",
			},

			-- Preview window configuration
			preview_win = {
				-- Auto-update preview when cursor moves
				update_on_cursor_moved = true,

				-- Use fastest preview method
				preview_method = "fast_scratch",

				-- Disable preview for large files to prevent lag
				disable_preview = function(filename)
					local max_filesize = 1024 * 1024 -- 1MB
					local ok, stats = pcall(vim.loop.fs_stat, filename)
					if ok and stats and stats.size > max_filesize then
						return true
					end
					return false
				end,
			},
		})

		-- Autocommand to automatically open preview when Oil opens
		vim.api.nvim_create_autocmd("User", {
			pattern = "OilEnter",
			callback = function(args)
				if vim.api.nvim_get_current_buf() == args.data.buf then
					vim.schedule(function()
						local oil = require("oil")
						if oil.get_cursor_entry() then
							oil.open_preview()
						end
					end)
				end
			end,
		})

		-- Auto-open Oil when opening a directory (e.g., nvim .)
		vim.api.nvim_create_autocmd("VimEnter", {
			callback = function()
				local arg = vim.fn.argv(0)
				if arg and arg ~= "" and vim.fn.isdirectory(arg) == 1 then
					require("oil").open(arg)
				end
			end,
		})

		-- Keymap to open Oil with <leader>-
		vim.keymap.set("n", "<leader>-", function()
			require("oil").open(vim.fn.expand("%:p:h"))
		end, { desc = "Open file explorer in current directory" })
	end,
}
