-- === Table des serveurs et settings ===
local mason_servers = {
    "lua_ls",
    "cssls",
    "html",
    -- "ts_ls", -- Replaced by typescript-tools.nvim
    "pyright",
    "bashls",
    "jsonls",
    "yamlls",
    "rust_analyzer",
    "eslint",
    "gopls",
    "volar",
    "tailwindcss",
    "dockerls",
}

local servers = {
    rust_analyzer = {},
    -- ts_ls handled by typescript-tools.nvim
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
    yamlls = {
        yaml = {
            schemas = {
                ["https://json.schemastore.org/github-workflow.json"] = "/.github/workflows/*",
                ["https://json.schemastore.org/github-action.json"] = "/.github/action.{yml,yaml}",
            },
        },
    },
    gopls = {
        gopls = {
            analyses = {
                unusedparams = true,
            },
            staticcheck = true,
            gofumpt = true,
        },
    },
    volar = {
        filetypes = { "vue" },
        init_options = {
            vue = {
                hybridMode = false,
            },
        },
    },
    tailwindcss = {
        tailwindCSS = {
            experimental = {
                classRegex = {
                    { "cva\\(([^)]*)\\)", "[\"'`]([^\"'`]*).*?[\"'`]" },
                    { "cx\\(([^)]*)\\)", "(?:'|\"|`)([^']*)(?:'|\"|`)" },
                },
            },
        },
    },
    dockerls = {},
}


-- === Import des fonctions utilitaires ===
local lsp_utils = require("plugins.utils.lsp_utils")


local mason_handlers = {
    function(server_name)
        local nvim_lsp = require("lspconfig")
        local opts = {
            on_attach = lsp_utils.on_attach,
            capabilities = lsp_utils.common_capabilities(),
            settings = servers[server_name],
            filetypes = (servers[server_name] or {}).filetypes,
        }
        if server_name == "lua_ls" then
            require("neodev").setup({})
            opts.settings.Lua.diagnostics.globals = { "vim" }
            opts.settings.Lua.workspace.library = vim.api.nvim_get_runtime_file("", true)
        end
        if server_name == "eslint" then
            opts.on_attach = function(client, bufnr)
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


-- === Plugin spec ===
return {
    "neovim/nvim-lspconfig",
    event = { "BufReadPre", "BufNewFile" },
    dependencies = {
        {
            "williamboman/mason-lspconfig.nvim",
            dependencies = { "williamboman/mason.nvim" },
        },
        "folke/neodev.nvim",
    },
    config = function()
        local mason_lspconfig = require("mason-lspconfig")

        mason_lspconfig.setup({
            ensure_installed = mason_servers,
            handlers = mason_handlers
        })

        -- Setup des serveurs déjà installés
        for _, server in ipairs(mason_lspconfig.get_installed_servers()) do
            mason_handlers[1](server)
        end

        lsp_utils.initialize_diagnostics()
    end,
}
