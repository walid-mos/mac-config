local servers = {
    "lua_ls",
    "cssls",
    "html",
    "tsserver",
    "pyright",
    "bashls",
    "jsonls",
    "rust_analyzer"
}

local cfg = {
    ui = {
        border = "rounded"
    }
}

return {
    'williamboman/mason-lspconfig.nvim',
    dependencies = {
        'williamboman/mason.nvim',
    },
    config = function ()
        require('mason').setup(cfg)
        require('mason-lspconfig').setup {
            ensure_installed = servers,
        }
    end
}
