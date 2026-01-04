-- Telescope: Fuzzy finder over lists
-- Highly extendable fuzzy finder with dual-mode support (insert/normal)

return {
	"nvim-telescope/telescope.nvim",
	tag = "0.1.8",
	dependencies = {
		"nvim-lua/plenary.nvim",
		{
			"nvim-telescope/telescope-fzf-native.nvim",
			build = "make",
		},
	},

	config = function()
		local telescope = require("telescope")
		local actions = require("telescope.actions")

		telescope.setup({
			defaults = {
				-- Ripgrep arguments for live_grep and grep_string (best practice)
				vimgrep_arguments = {
					"rg",
					"--color=never",
					"--no-heading",
					"--with-filename",
					"--line-number",
					"--column",
					"--smart-case",
					"--hidden", -- Search hidden files
					"--glob=!**/.git/*", -- Exclude .git directory
					"--glob=!**/.cache/*", -- Exclude cache directories
					"--glob=!**/node_modules/*", -- Exclude node_modules
					"--glob=!**/build/*", -- Exclude build directories
					"--glob=!**/dist/*", -- Exclude dist directories
					"--glob=!**/target/*", -- Exclude target (Rust/Java)
					"--glob=!**/.venv/*", -- Exclude Python virtual env
					"--glob=!**/venv/*", -- Exclude Python virtual env
					"--glob=!**/__pycache__/*", -- Exclude Python cache
					"--glob=!**/.DS_Store", -- Exclude macOS metadata
					"--glob=!**/*.min.js", -- Exclude minified JS
					"--glob=!**/*.min.css", -- Exclude minified CSS
				},

				-- Path display: show filename first for better scanning
				path_display = { "filename_first" },

				-- Sorting strategy: prefer files closer to top
				sorting_strategy = "ascending",

				-- Window configuration
				layout_strategy = "horizontal",
				layout_config = {
					horizontal = {
						prompt_position = "top", -- Prompt at top when sorting ascending
						preview_width = 0.55,
					},
					width = 0.87,
					height = 0.80,
					preview_cutoff = 120,
				},

				-- Mappings for insert and normal mode
				mappings = {
					i = {
						-- Insert mode mappings (fuzzy search)
						["<C-n>"] = actions.move_selection_next,
						["<C-p>"] = actions.move_selection_previous,
						["<C-c>"] = actions.close,
						["<Down>"] = actions.move_selection_next,
						["<Up>"] = actions.move_selection_previous,
						["<CR>"] = actions.select_default,
						["<C-x>"] = actions.select_horizontal,
						["<C-v>"] = actions.select_vertical,
						["<C-t>"] = actions.select_tab,
						["<C-u>"] = actions.preview_scrolling_up,
						["<C-d>"] = actions.preview_scrolling_down,
						["<C-q>"] = actions.send_to_qflist + actions.open_qflist,
						["<M-q>"] = actions.send_selected_to_qflist + actions.open_qflist,
						["<C-h>"] = "which_key",
					},
					n = {
						-- Normal mode mappings (j/k navigation)
						["<esc>"] = actions.close,
						["<CR>"] = actions.select_default,
						["<C-x>"] = actions.select_horizontal,
						["<C-v>"] = actions.select_vertical,
						["<C-t>"] = actions.select_tab,
						["<Tab>"] = actions.toggle_selection + actions.move_selection_worse,
						["<S-Tab>"] = actions.toggle_selection + actions.move_selection_better,
						["<C-q>"] = actions.send_to_qflist + actions.open_qflist,
						["<M-q>"] = actions.send_selected_to_qflist + actions.open_qflist,
						-- j/k navigation
						["j"] = actions.move_selection_next,
						["k"] = actions.move_selection_previous,
						["H"] = actions.move_to_top,
						["M"] = actions.move_to_middle,
						["L"] = actions.move_to_bottom,
						["<Down>"] = actions.move_selection_next,
						["<Up>"] = actions.move_selection_previous,
						["gg"] = actions.move_to_top,
						["G"] = actions.move_to_bottom,
						["<C-u>"] = actions.preview_scrolling_up,
						["<C-d>"] = actions.preview_scrolling_down,
						["?"] = actions.which_key,
					},
				},
			},

			pickers = {
				-- Find files picker
				find_files = {
					hidden = true, -- show hidden files
					find_command = {
						"rg",
						"--files",
						"--hidden",
						"--glob=!**/.git/*",
						"--glob=!**/node_modules/*",
						"--glob=!**/.cache/*",
					},
				},
				-- Live grep: no additional config needed (uses vimgrep_arguments)
				live_grep = {},
				-- Grep string: no additional config needed (uses vimgrep_arguments)
				grep_string = {},
				-- Buffers picker
				buffers = {
					show_all_buffers = true,
					sort_lastused = true,
					mappings = {
						i = {
							["<c-d>"] = actions.delete_buffer,
						},
						n = {
							["dd"] = actions.delete_buffer,
						},
					},
				},
				-- LSP pickers
				lsp_references = {
					initial_mode = "normal",
					show_line = false, -- Don't show full line for cleaner view
				},
				lsp_document_symbols = {
					initial_mode = "normal",
				},
			},

			extensions = {
				fzf = {
					fuzzy = true,
					override_generic_sorter = true,
					override_file_sorter = true,
					case_mode = "smart_case",
				},
			},
		})

		-- Load fzf extension for better performance
		telescope.load_extension("fzf")

		-- Keybindings
		local builtin = require("telescope.builtin")

		-- Find files
		vim.keymap.set("n", "<leader>ff", builtin.find_files, { desc = "Find files" })

		-- Grep/search content
		vim.keymap.set("n", "<leader>fg", builtin.live_grep, { desc = "Live grep" })
		vim.keymap.set("n", "<leader>fw", builtin.grep_string, { desc = "Grep word under cursor" })

		-- Buffers
		vim.keymap.set("n", "<leader>fb", builtin.buffers, { desc = "Find buffers" })
		vim.keymap.set("n", "<leader><leader>", builtin.buffers, { desc = "Buffer list" })

		-- LSP symbols and references
		vim.keymap.set("n", "<leader>fs", builtin.lsp_document_symbols, { desc = "LSP document symbols" })
		vim.keymap.set("n", "<leader>fr", builtin.lsp_references, { desc = "LSP references" })

		-- Additional useful pickers
		vim.keymap.set("n", "<leader>fh", builtin.help_tags, { desc = "Help tags" })
	end,
}
