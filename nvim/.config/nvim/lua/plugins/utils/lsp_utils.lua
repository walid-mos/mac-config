local lsp_keymaps = function (bufnr)
    local nmap = function(keys, func, desc)
        if desc then desc = "LSP: " .. desc end
        vim.keymap.set("n", keys, func, { buffer = bufnr, desc = desc })
    end

    -- Wrapper to use telescope state management with proper LSP encoding
    local function telescope_lsp_wrapper(func, opts)
        return function()
            -- Clear any residual state to avoid "A" appearing
            local telescope_state = require('plugins.explorer.telescope').get_telescope_state()
            if telescope_state then
                telescope_state.last_prompt = ""
            end
            
            -- Get active LSP client for position encoding
            local client = vim.lsp.get_clients({ bufnr = bufnr })[1]
            local position_encoding = client and client.offset_encoding or "utf-16"
            
            -- Call the original function with proper encoding options
            local merged_opts = opts or {}
            merged_opts.encoding = position_encoding
            
            func(merged_opts)
        end
    end

    -- Simple telescope wrapper for non-LSP functions
    local function telescope_wrapper(func, opts)
        return function()
            local telescope_state = require('plugins.explorer.telescope').get_telescope_state()
            if telescope_state then
                telescope_state.last_prompt = ""
            end
            
            if opts then
                func(opts)
            else
                func()
            end
        end
    end

    -- Rename is handled by inc-rename.nvim plugin
    -- nmap("<leader>rn", vim.lsp.buf.rename, "[R]e[n]ame")

    -- LSP Navigation under <leader>l
    nmap("<leader>ld", telescope_lsp_wrapper(require("telescope.builtin").lsp_definitions), "Go to [D]efinition")
    nmap("<leader>lD", vim.lsp.buf.declaration, "Go to [D]eclaration")
    nmap("<leader>li", telescope_lsp_wrapper(require("telescope.builtin").lsp_implementations), "Go to [I]mplementation")
    nmap("<leader>lr", function()
        vim.cmd("Trouble lsp_references toggle focus=true")
    end, "Go to [R]eferences (Trouble)")
    nmap("<leader>lR", telescope_lsp_wrapper(require("telescope.builtin").lsp_references), "Go to [R]eferences (Telescope)")
    nmap("<leader>lt", telescope_lsp_wrapper(require("telescope.builtin").lsp_type_definitions), "Go to [T]ype Definition")

    -- Code actions and documentation
    nmap("<leader>ca", vim.lsp.buf.code_action, "[C]ode [A]ction")
    nmap("<leader>k", vim.lsp.buf.hover, "Hover Documentation")
    nmap("<leader>K", vim.lsp.buf.signature_help, "Signature Help")

    -- Symbols navigation
    nmap("<leader>ds", telescope_wrapper(require("telescope.builtin").lsp_document_symbols), "[D]ocument [S]ymbols")
    nmap("<leader>ws", telescope_wrapper(require("telescope.builtin").lsp_dynamic_workspace_symbols), "[W]orkspace [S]ymbols")

    -- Diagnostics
    nmap("<leader>cd", function()
        vim.cmd("Trouble diagnostics toggle filter.buf=0")
    end, "Buffer [D]iagnostics")
    nmap("<leader>cD", function()
        vim.cmd("Trouble diagnostics toggle")
    end, "Workspace [D]iagnostics")
end

local on_attach = function(client, bufnr)
    lsp_keymaps(bufnr)
    if client:supports_method("textDocument/inlayHint") then
        vim.lsp.inlay_hint.enable(true, { bufnr })
    end
end

local common_capabilities = function ()
    local capabilities = require('cmp_nvim_lsp').default_capabilities()

    -- Enhanced capabilities for modern LSP features
    capabilities.textDocument.completion.completionItem = {
        documentationFormat = { "markdown", "plaintext" },
        snippetSupport = true,
        preselectSupport = true,
        insertReplaceSupport = true,
        labelDetailsSupport = true,
        deprecatedSupport = true,
        commitCharactersSupport = true,
        tagSupport = { valueSet = { 1 } },
        resolveSupport = {
            properties = {
                "documentation",
                "detail",
                "additionalTextEdits",
            },
        },
    }

    -- File operations support (for auto-import on file moves, etc.)
    capabilities.workspace = capabilities.workspace or {}
    capabilities.workspace.fileOperations = {
        didRename = true,
        willRename = true,
    }

    -- Folding support
    capabilities.textDocument.foldingRange = {
        dynamicRegistration = false,
        lineFoldingOnly = true,
    }

    return capabilities
end

local initialize_diagnostics = function()
    local icons = require("ui.icons")
    local config = {
        signs = {
            active = true,
            values = {
                { name = "DiagnosticSignError", text = icons.diagnostics.Error },
                { name = "DiagnosticSignWarn", text = icons.diagnostics.Warning },
                { name = "DiagnosticSignHint", text = icons.diagnostics.Hint },
                { name = "DiagnosticSignInfo", text = icons.diagnostics.Information },
            },
        },
        -- Enhanced virtual_text with better formatting
        virtual_text = {
            spacing = 4,
            source = "if_many",
            prefix = "●",
            -- Only show errors and warnings inline, hints/info in float
            severity = {
                min = vim.diagnostic.severity.WARN,
            },
            format = function(diagnostic)
                -- Truncate long messages
                local max_width = 80
                if #diagnostic.message > max_width then
                    return diagnostic.message:sub(1, max_width) .. "..."
                end
                return diagnostic.message
            end,
        },
        update_in_insert = false,
        underline = true,
        severity_sort = true,
        float = {
            focusable = true,
            style = "minimal",
            border = "rounded",
            source = "always",
            header = "",
            prefix = "",
            format = function(diagnostic)
                return string.format("%s: %s", diagnostic.source or "", diagnostic.message)
            end,
        },
    }
    vim.diagnostic.config(config)

    -- Add keymap to toggle virtual_text
    vim.keymap.set("n", "<leader>ct", function()
        local current = vim.diagnostic.config().virtual_text
        if current then
            vim.diagnostic.config({ virtual_text = false })
            vim.notify("Virtual text disabled", vim.log.levels.INFO)
        else
            vim.diagnostic.config({
                virtual_text = {
                    spacing = 4,
                    source = "if_many",
                    prefix = "●",
                    severity = { min = vim.diagnostic.severity.WARN },
                }
            })
            vim.notify("Virtual text enabled", vim.log.levels.INFO)
        end
    end, { desc = "Toggle diagnostic virtual text" })
end

return {
    on_attach = on_attach,
    common_capabilities = common_capabilities,
    initialize_diagnostics = initialize_diagnostics
}
