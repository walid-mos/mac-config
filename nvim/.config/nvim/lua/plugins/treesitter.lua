-- Treesitter: Better syntax highlighting and code understanding
-- Provides semantic highlighting, better folding, and text objects

return {
	"nvim-treesitter/nvim-treesitter",
	build = ":TSUpdate",
	event = { "BufReadPost", "BufNewFile" },

	config = function()
		require("nvim-treesitter.configs").setup({
			-- Auto-install parsers for these languages
			ensure_installed = {
				"lua",
				"vim",
				"vimdoc",
				"query",
				"typescript",
				"javascript",
				"tsx",
				"json",
				"html",
				"css",
				"go",
				"rust",
				"markdown",
				"markdown_inline",
				"bash",
			},

			-- Install parsers synchronously (only applied to `ensure_installed`)
			sync_install = false,

			-- Automatically install missing parsers when entering buffer
			auto_install = true,

			-- Highlight configuration
			highlight = {
				enable = true,

				-- Disable for large files (performance)
				disable = function(lang, buf)
					local max_filesize = 100 * 1024 -- 100 KB
					local ok, stats = pcall(vim.loop.fs_stat, vim.api.nvim_buf_get_name(buf))
					if ok and stats and stats.size > max_filesize then
						return true
					end
				end,

				-- Setting this to true will run `:h syntax` and tree-sitter at the same time.
				-- Set this to `true` if you depend on 'syntax' being enabled (like for indentation).
				-- Using this option may slow down your editor, and you may see some duplicate highlights.
				-- Instead of true it can also be a list of languages
				additional_vim_regex_highlighting = false,
			},

			-- Indentation based on treesitter
			indent = {
				enable = true,
				-- Disable for specific languages if they have issues
				disable = { "python" },
			},

			-- Incremental selection
			incremental_selection = {
				enable = true,
				keymaps = {
					init_selection = "<C-space>",
					node_incremental = "<C-space>",
					scope_incremental = false,
					node_decremental = "<bs>",
				},
			},
		})
	end,
}
