-- === Table des serveurs et settings ===
local servers = {
    rust_analyzer = {},
    ts_ls = {
        init_options = {
            preferences = {
                importModuleSpecifierPreference = "non-relative",
                includeCompletionsForModuleExports = false,
            },
        },
    },
    eslint = {},
    cssls = {
        css = {
            validate = true,
            lint = { unknownAtRules = "ignore" },
        },
    },
    lua_ls = {
        Lua = {
            runtime = {
                version = 'LuaJIT',
            },
            workspace = {
                checkThirdParty = false,
                library = {
                    vim.env.VIMRUNTIME,
                    vim.fn.stdpath("config"),
                },
            },
            telemetry = { enable = false },
            diagnostics = {
                globals = { "vim" },
            },
        },
    },
}


-- === Import des fonctions utilitaires ===
local lsp_utils = require("plugins.utils.lsp_utils")


local mason_handlers = {
    handlers = {
        function(server_name)
            local nvim_lsp = require("lspconfig")
            local opts = {
                on_attach = lsp_utils.on_attach,
                capabilities = lsp_utils.common_capabilities(),
                settings = servers[server_name],
                filetypes = (servers[server_name] or {}).filetypes,
            }
            if server_name == "ts_ls" then
                opts.root_dir = nvim_lsp.util.root_pattern(".git", "tsconfig.json", "package.json", "jsconfig.json")
            end
            if server_name == "lua_ls" then
                require("neodev").setup({})
                opts.settings.Lua.diagnostics.globals = { "vim" }
                opts.settings.Lua.workspace.library = vim.api.nvim_get_runtime_file("", true)
            end
            if server_name == "eslint" then
                opts.on_attach = function(_, bufnr)
                    vim.api.nvim_create_autocmd("BufWritePre", {
                        buffer = bufnr,
                        command = "EslintFixAll",
                    })
                end
                opts.capabilities = nil
            end
            nvim_lsp[server_name].setup(opts)
        end,
    }
}


-- === Plugin spec ===
return {
    "neovim/nvim-lspconfig",
    event = { "BufReadPre", "BufNewFile" },
    dependencies = {
        "williamboman/mason-lspconfig.nvim",
        "folke/neodev.nvim",
    },
    config = function()
        local mason_lspconfig = require("mason-lspconfig")

        require("mason").setup()
        mason_lspconfig.setup(mason_handlers)

        lsp_utils.initialize_diagnostics()
    end,
}
