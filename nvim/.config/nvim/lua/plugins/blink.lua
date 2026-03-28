return {
	{
		"saghen/blink.cmp",
		dependencies = { "rafamadriz/friendly-snippets" },
		version = "1.*",

		---@module 'blink.cmp'
		---@type blink.cmp.Config
		opts = {
			keymap = {
				preset = "none",
				["<Tab>"] = { "select_and_accept", "fallback" },
				["<CR>"] = { "select_and_accept", "fallback" },
				["<Esc>"] = {
					function(cmp)
						cmp.cancel()
						vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes("<Esc>", true, false, true), "n", false)
					end,
					"fallback",
				},
				["<Up>"] = { "select_prev", "fallback" },
				["<Down>"] = { "select_next", "fallback" },
				["<C-b>"] = { "scroll_documentation_up", "fallback" },
				["<C-f>"] = { "scroll_documentation_down", "fallback" },
				["<C-Space>"] = { "show" },
			},
			appearance = { nerd_font_variant = "mono" },
			completion = {
				documentation = {
					auto_show = true,
					auto_show_delay_ms = 200,
				},
				list = {
					selection = { preselect = true, auto_insert = false },
				},
				accept = {
					auto_brackets = { enabled = false },
				},
			},
			sources = {
				default = { "lsp", "path", "snippets", "buffer" },
				providers = {
					buffer = { async = true },
				},
			},
			fuzzy = { implementation = "prefer_rust" },
		},
	},
}
