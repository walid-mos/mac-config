return {
    "stevearc/conform.nvim",
    event = { "BufWritePre" },
    cmd = { "ConformInfo" },
    opts = {
        formatters_by_ft = {
            javascript = { "prettierd", "prettier", stop_after_first = true },
            typescript = { "prettierd", "prettier", stop_after_first = true },
            javascriptreact = { "prettierd", "prettier", stop_after_first = true },
            typescriptreact = { "prettierd", "prettier", stop_after_first = true },
            vue = { "prettierd", "prettier", stop_after_first = true },
            css = { "prettierd", "prettier", stop_after_first = true },
            scss = { "prettierd", "prettier", stop_after_first = true },
            html = { "prettierd", "prettier", stop_after_first = true },
            json = { "prettierd", "prettier", stop_after_first = true },
            jsonc = { "prettierd", "prettier", stop_after_first = true },
            yaml = { "prettierd", "prettier", stop_after_first = true },
            markdown = { "prettierd", "prettier", stop_after_first = true },
            graphql = { "prettierd", "prettier", stop_after_first = true },
            lua = { "stylua" },
            python = { "ruff_format" },
            go = { "gofumpt", "goimports" },
            rust = { "rustfmt" },
            sh = { "shfmt" },
        },
        format_on_save = function(bufnr)
            -- Disable with a global or buffer-local variable
            if vim.g.disable_autoformat or vim.b[bufnr].disable_autoformat then
                return
            end
            return { timeout_ms = 500, lsp_format = "fallback" }
        end,
        formatters = {
            shfmt = {
                prepend_args = { "-i", "2", "-ci" },
            },
        },
    },
    keys = {
        {
            "<leader>cf",
            function()
                require("conform").format({ async = true, lsp_format = "fallback" })
            end,
            mode = { "n", "v" },
            desc = "Format buffer",
        },
        {
            "<leader>cF",
            function()
                vim.g.disable_autoformat = not vim.g.disable_autoformat
                if vim.g.disable_autoformat then
                    vim.notify("Autoformat-on-save disabled", vim.log.levels.INFO)
                else
                    vim.notify("Autoformat-on-save enabled", vim.log.levels.INFO)
                end
            end,
            desc = "Toggle autoformat-on-save",
        },
    },
    init = function()
        -- Use conform for gq formatting
        vim.o.formatexpr = "v:lua.require'conform'.formatexpr()"
    end,
}
