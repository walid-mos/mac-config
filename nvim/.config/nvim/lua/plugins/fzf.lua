-- fzf-lua: Fast fuzzy finder (better than Telescope)
-- Key advantage: :q actually works to close windows!

return {
	"ibhagwan/fzf-lua",
	dependencies = { "nvim-tree/nvim-web-devicons" },

	-- Load when using fuzzy finder keymaps
	keys = {
		{ "<leader>ff", "<cmd>FzfLua files<cr>", desc = "Find files" },
		{ "<leader>fg", "<cmd>FzfLua live_grep<cr>", desc = "Live grep" },
		{ "<leader>fb", "<cmd>FzfLua buffers<cr>", desc = "Find buffers" },
		{ "<leader>fh", "<cmd>FzfLua help_tags<cr>", desc = "Help tags" },
		{ "<leader>fw", "<cmd>FzfLua grep_cword<cr>", desc = "Grep word under cursor" },
		{ "<leader>fr", "<cmd>FzfLua resume<cr>", desc = "Resume last search" },
		{ "<leader>fo", "<cmd>FzfLua oldfiles<cr>", desc = "Recent files" },
		{ "<leader>fc", "<cmd>FzfLua commands<cr>", desc = "Commands" },
		{ "<leader>fk", "<cmd>FzfLua keymaps<cr>", desc = "Keymaps" },
	},

	config = function()
		require("fzf-lua").setup({
			-- Use 'default' profile for good defaults
			-- Other options: 'fzf-native', 'fzf-tmux', 'skim', 'max-perf'
			"default",

			winopts = {
				height = 0.85,
				width = 0.80,
				row = 0.35,
				col = 0.50,
				border = "rounded",
				preview = {
					default = "bat",
					border = "border",
					wrap = "nowrap",
					hidden = "nohidden",
					vertical = "down:45%",
					horizontal = "right:50%",
					layout = "flex",
					flip_columns = 120,
				},
			},

			-- File and grep options
			files = {
				prompt = "Files❯ ",
				multiprocess = true,
				git_icons = true,
				file_icons = true,
				color_icons = true,
				-- Use fd if available (faster), fallback to find
				cmd = "fd --type f --hidden --follow --exclude .git",
			},

			grep = {
				prompt = "Rg❯ ",
				input_prompt = "Grep For❯ ",
				multiprocess = true,
				git_icons = false,
				file_icons = true,
				color_icons = true,
				-- Use ripgrep for fast searching
				cmd = "rg --column --line-number --no-heading --color=always --smart-case --max-columns=4096",
				grep_opts = "--binary-files=without-match --line-number --recursive --color=auto --perl-regexp -e",
				rg_opts = "--column --line-number --no-heading --color=always --smart-case --max-columns=4096 -e",
			},

			-- LSP integration
			lsp = {
				prompt_postfix = "❯ ",
				cwd_only = false,
				async_or_timeout = 5000,
			},

			-- Keymaps inside fzf window
			keymap = {
				builtin = {
					["<F1>"] = "toggle-help",
					["<F2>"] = "toggle-fullscreen",
					["<F3>"] = "toggle-preview-wrap",
					["<F4>"] = "toggle-preview",
					["<C-d>"] = "preview-page-down",
					["<C-u>"] = "preview-page-up",
				},
				fzf = {
					["ctrl-q"] = "select-all+accept",
					["ctrl-u"] = "unix-line-discard",
					["ctrl-a"] = "beginning-of-line",
					["ctrl-e"] = "end-of-line",
					["alt-a"] = "toggle-all",
				},
			},
		})
	end,
}
