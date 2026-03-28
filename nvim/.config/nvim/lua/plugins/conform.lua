local web_formatters = { "biome", "oxc_format", "prettier" }

return {
	"stevearc/conform.nvim",
	event = "BufWritePre",
	cmd = { "ConformInfo" },

	config = function()
		require("conform").setup({
			formatters = {
				odinfmt = {
					command = "odinfmt",
					args = { "-stdin" },
					stdin = true,
				},
			},

			formatters_by_ft = {
				javascript = web_formatters,
				typescript = web_formatters,
				javascriptreact = web_formatters,
				typescriptreact = web_formatters,
				css = web_formatters,
				html = web_formatters,
				json = web_formatters,
				jsonc = web_formatters,
				python = { "ruff_format", "black" },
				lua = { "stylua" },
				c = { "clang-format" },
				odin = { "odinfmt" },
			},

			-- Premier formatter trouvé gagne, aucun trouvé = rien ne se passe
			default_format_opts = {
				stop_after_first = true,
				lsp_format = "never",
			},

			format_on_save = false,
		})
	end,
}
