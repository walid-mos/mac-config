local function on_attach(ev)
	local map = function(mode, lhs, rhs, desc)
		vim.keymap.set(mode, lhs, rhs, { buffer = ev.buf, desc = desc })
	end

	map("n", "<leader>cd", vim.lsp.buf.definition, "Go to definition")
	map("n", "<leader>cD", vim.lsp.buf.declaration, "Go to declaration")
	map("n", "<leader>cr", vim.lsp.buf.references, "Find references")
	map("n", "<leader>ci", vim.lsp.buf.implementation, "Go to implementation")
	map("n", "<leader>ct", vim.lsp.buf.type_definition, "Go to type definition")
	map("n", "<leader>ca", vim.lsp.buf.code_action, "Code actions")
	map("n", "<leader>cn", vim.lsp.buf.rename, "Rename symbol")
	-- Format via conform.nvim, pas le LSP
	map("n", "<leader>cf", function() require("conform").format({ async = true, lsp_format = "never" }) end, "Format buffer")
	map("n", "K", vim.lsp.buf.hover, "Hover documentation")
end

local function setup_diagnostics()
	vim.diagnostic.config({
		virtual_text = { prefix = "●", spacing = 4 },
		virtual_lines = { current_line = true },
		severity_sort = true,
		underline = true,
		float = { border = "rounded", source = true },
	})

	local signs = { Error = " ", Warn = " ", Hint = " ", Info = " " }
	for type, icon in pairs(signs) do
		local hl = "DiagnosticSign" .. type
		vim.fn.sign_define(hl, { text = icon, texthl = hl, numhl = hl })
	end
end

return {
	{ "williamboman/mason.nvim", opts = { ui = { border = "rounded" } } },

	{
		"williamboman/mason-lspconfig.nvim",
		dependencies = { "williamboman/mason.nvim" },
		opts = {
			ensure_installed = { "lua_ls" },
		},
	},

	{
		"neovim/nvim-lspconfig",
		dependencies = { "williamboman/mason-lspconfig.nvim" },
		config = function()
			vim.api.nvim_create_autocmd("LspAttach", {
				group = vim.api.nvim_create_augroup("UserLspConfig", {}),
				callback = on_attach,
			})

			setup_diagnostics()

			vim.lsp.config("lua_ls", {
				settings = {
					Lua = {
						runtime = { version = "LuaJIT" },
						diagnostics = { globals = { "vim" } },
						workspace = { library = vim.api.nvim_get_runtime_file("", true), checkThirdParty = false },
						telemetry = { enable = false },
					},
				},
			})

			-- mason-lspconfig auto-enable les serveurs installés via vim.lsp.enable()

			-- ols n'est pas dans Mason, installé manuellement (brew install ols)
			vim.lsp.config("ols", {})
			vim.lsp.enable("ols")
		end,
	},
}
