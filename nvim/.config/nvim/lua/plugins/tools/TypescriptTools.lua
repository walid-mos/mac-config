return {
    "pmizio/typescript-tools.nvim",
    dependencies = { "nvim-lua/plenary.nvim", "neovim/nvim-lspconfig" },
    ft = { "typescript", "typescriptreact", "javascript", "javascriptreact" },
    opts = {
        on_attach = function(client, bufnr)
            -- Use the common on_attach from lsp_utils
            require("plugins.utils.lsp_utils").on_attach(client, bufnr)

            -- Add organize imports keymap
            vim.keymap.set("n", "<leader>co", function()
                vim.cmd("TSToolsOrganizeImports")
            end, { buffer = bufnr, desc = "Organize Imports" })

            -- Add remove unused imports
            vim.keymap.set("n", "<leader>cu", function()
                vim.cmd("TSToolsRemoveUnusedImports")
            end, { buffer = bufnr, desc = "Remove Unused Imports" })

            -- Add add missing imports
            vim.keymap.set("n", "<leader>cM", function()
                vim.cmd("TSToolsAddMissingImports")
            end, { buffer = bufnr, desc = "Add Missing Imports" })

            -- Auto organize imports on save
            vim.api.nvim_create_autocmd("BufWritePre", {
                buffer = bufnr,
                callback = function()
                    vim.cmd("TSToolsOrganizeImports sync")
                end,
            })
        end,
        settings = {
            separate_diagnostic_server = true,
            publish_diagnostic_on = "insert_leave",
            expose_as_code_action = "all",
            tsserver_file_preferences = {
                includeInlayParameterNameHints = "all",
                includeInlayParameterNameHintsWhenArgumentMatchesName = false,
                includeInlayFunctionParameterTypeHints = true,
                includeInlayVariableTypeHints = true,
                includeInlayVariableTypeHintsWhenTypeMatchesName = false,
                includeInlayPropertyDeclarationTypeHints = true,
                includeInlayFunctionLikeReturnTypeHints = true,
                includeInlayEnumMemberValueHints = true,
                importModuleSpecifierPreference = "non-relative",
            },
            tsserver_format_options = {
                allowIncompleteCompletions = false,
                allowRenameOfImportPath = false,
            },
        },
    },
}
