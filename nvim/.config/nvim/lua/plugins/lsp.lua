-- LSP Configuration with Mason for easy server installation
-- Languages: TypeScript/JavaScript, Lua, Go, Rust
-- Using new vim.lsp.config API (Neovim 0.11+)

return {
	-- Mason: LSP server installer
	{
		"williamboman/mason.nvim",
		config = function()
			require("mason").setup({
				ui = {
					border = "rounded",
					icons = {
						package_installed = "✓",
						package_pending = "➜",
						package_uninstalled = "✗",
					},
				},
			})
		end,
	},

	-- Mason-LSPConfig bridge
	{
		"williamboman/mason-lspconfig.nvim",
		dependencies = { "williamboman/mason.nvim" },
		config = function()
			require("mason-lspconfig").setup({
				-- Auto-install these LSP servers
				ensure_installed = {
					"ts_ls", -- TypeScript/JavaScript
					"lua_ls", -- Lua
					-- "gopls", -- Go (commented out - install when you have Go)
					-- "rust_analyzer", -- Rust (commented out - install when you have Rust)
				},
				automatic_installation = true,
			})
		end,
	},

	-- LSPConfig: LSP configuration
	{
		"neovim/nvim-lspconfig",
		dependencies = {
			"williamboman/mason.nvim",
			"williamboman/mason-lspconfig.nvim",
		},
		config = function()
			-- LSP keymaps (set when LSP attaches to buffer)
			vim.api.nvim_create_autocmd("LspAttach", {
				group = vim.api.nvim_create_augroup("UserLspConfig", {}),
				callback = function(ev)
					local map = function(mode, lhs, rhs, desc)
						vim.keymap.set(mode, lhs, rhs, { buffer = ev.buf, desc = desc })
					end

					-- LSP navigation with <leader>c prefix
					map("n", "<leader>cd", vim.lsp.buf.definition, "Go to definition")
					map("n", "<leader>cD", vim.lsp.buf.declaration, "Go to declaration")
					map("n", "<leader>cr", vim.lsp.buf.references, "Find references")
					map("n", "<leader>ci", vim.lsp.buf.implementation, "Go to implementation")
					map("n", "<leader>ct", vim.lsp.buf.type_definition, "Go to type definition")

					-- LSP actions
					map("n", "K", vim.lsp.buf.hover, "Hover documentation")
					map("n", "<leader>ca", vim.lsp.buf.code_action, "Code actions")
					map("n", "<leader>cn", vim.lsp.buf.rename, "Rename symbol")
					map("n", "<leader>cf", function()
						vim.lsp.buf.format({ async = true })
					end, "Format buffer")

					-- Workspace management
					map("n", "<leader>wa", vim.lsp.buf.add_workspace_folder, "Add workspace folder")
					map("n", "<leader>wr", vim.lsp.buf.remove_workspace_folder, "Remove workspace folder")
					map("n", "<leader>wl", function()
						print(vim.inspect(vim.lsp.buf.list_workspace_folders()))
					end, "List workspace folders")

					-- Diagnostics (already mapped in keymaps.lua: [d / ]d)
					map("n", "<leader>q", vim.diagnostic.setloclist, "Open diagnostics list")
				end,
			})

			-- Diagnostic configuration
			vim.diagnostic.config({
				virtual_text = {
					prefix = "●",
					spacing = 4,
				},
				signs = true,
				underline = true,
				update_in_insert = false,
				severity_sort = true,
				float = {
					border = "rounded",
					source = "always",
					header = "",
					prefix = "",
				},
			})

			-- Diagnostic signs in gutter
			local signs = {
				Error = " ",
				Warn = " ",
				Hint = " ",
				Info = " ",
			}
			for type, icon in pairs(signs) do
				local hl = "DiagnosticSign" .. type
				vim.fn.sign_define(hl, { text = icon, texthl = hl, numhl = hl })
			end

			-- Get blink.cmp capabilities
			local capabilities = require("blink.cmp").get_lsp_capabilities()

			-- LSP server configurations using new vim.lsp.config API

			-- TypeScript/JavaScript
			vim.lsp.config("ts_ls", {
				cmd = { "typescript-language-server", "--stdio" },
				filetypes = { "javascript", "javascriptreact", "typescript", "typescriptreact" },
				root_markers = { "package.json", "tsconfig.json", "jsconfig.json", ".git" },
				capabilities = capabilities,
				settings = {
					typescript = {
						inlayHints = {
							includeInlayParameterNameHints = "all",
							includeInlayParameterNameHintsWhenArgumentMatchesName = false,
							includeInlayFunctionParameterTypeHints = true,
							includeInlayVariableTypeHints = true,
							includeInlayPropertyDeclarationTypeHints = true,
							includeInlayFunctionLikeReturnTypeHints = true,
							includeInlayEnumMemberValueHints = true,
						},
					},
					javascript = {
						inlayHints = {
							includeInlayParameterNameHints = "all",
							includeInlayParameterNameHintsWhenArgumentMatchesName = false,
							includeInlayFunctionParameterTypeHints = true,
							includeInlayVariableTypeHints = true,
							includeInlayPropertyDeclarationTypeHints = true,
							includeInlayFunctionLikeReturnTypeHints = true,
							includeInlayEnumMemberValueHints = true,
						},
					},
				},
			})

			-- Lua
			vim.lsp.config("lua_ls", {
				cmd = { "lua-language-server" },
				filetypes = { "lua" },
				root_markers = { ".luarc.json", ".luarc.jsonc", ".luacheckrc", ".stylua.toml", "stylua.toml", "selene.toml", "selene.yml", ".git" },
				capabilities = capabilities,
				settings = {
					Lua = {
						runtime = {
							version = "LuaJIT",
						},
						diagnostics = {
							globals = { "vim" },
						},
						workspace = {
							library = vim.api.nvim_get_runtime_file("", true),
							checkThirdParty = false,
						},
						telemetry = {
							enable = false,
						},
						hint = {
							enable = true,
						},
					},
				},
			})

			-- Go
			vim.lsp.config("gopls", {
				cmd = { "gopls" },
				filetypes = { "go", "gomod", "gowork", "gotmpl" },
				root_markers = { "go.work", "go.mod", ".git" },
				capabilities = capabilities,
				settings = {
					gopls = {
						analyses = {
							unusedparams = true,
						},
						staticcheck = true,
						gofumpt = true,
					},
				},
			})

			-- Rust
			vim.lsp.config("rust_analyzer", {
				cmd = { "rust-analyzer" },
				filetypes = { "rust" },
				root_markers = { "Cargo.toml", "rust-project.json", ".git" },
				capabilities = capabilities,
				settings = {
					["rust-analyzer"] = {
						cargo = {
							allFeatures = true,
						},
						checkOnSave = {
							command = "clippy",
						},
					},
				},
			})

			-- Enable configured LSP servers (only enable if language is installed)
			vim.lsp.enable({ "ts_ls", "lua_ls" })

			-- Uncomment when you install Go/Rust:
			-- vim.lsp.enable("gopls")
			-- vim.lsp.enable("rust_analyzer")
		end,
	},
}
