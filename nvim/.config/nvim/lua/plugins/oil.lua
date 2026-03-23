return {
	"stevearc/oil.nvim",
	dependencies = { "nvim-tree/nvim-web-devicons" },
	lazy = false,

	config = function()
		require("oil").setup({
			default_file_explorer = true,
			columns = { "icon" },

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

			keymaps = {
				["<C-v>"] = { "actions.select", opts = { vertical = true }, desc = "Open in vertical split" },
				["<C-s>"] = { "actions.select", opts = { horizontal = true }, desc = "Open in horizontal split" },
				["<C-t>"] = { "actions.select", opts = { tab = true }, desc = "Open in new tab" },
			},

			view_options = {
				show_hidden = true,
				is_always_hidden = function(name)
					return name == ".." or name == ".git"
				end,
				sort = { { "type", "asc" }, { "name", "asc" } },
			},

			preview_win = {
				update_on_cursor_moved = true,
				preview_method = "fast_scratch",
				disable_preview = function(filename)
					local ok, stats = pcall(vim.loop.fs_stat, filename)
					return ok and stats and stats.size > 1024 * 1024
				end,
			},
		})

		-- Auto-open preview when Oil starts
		vim.api.nvim_create_autocmd("User", {
			pattern = "OilEnter",
			callback = function(args)
				if vim.api.nvim_get_current_buf() ~= args.data.buf then return end
				vim.schedule(function()
					if require("oil").get_cursor_entry() then
						require("oil").open_preview()
					end
				end)
			end,
		})

		-- Auto-open Oil when launching nvim on a directory
		vim.api.nvim_create_autocmd("VimEnter", {
			callback = function()
				local arg = vim.fn.argv(0)
				if not arg or arg == "" then return end
				if vim.fn.isdirectory(arg) == 1 then
					require("oil").open(arg)
				end
			end,
		})
	end,
}
