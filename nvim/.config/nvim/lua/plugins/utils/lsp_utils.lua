local M = {}

function M.lsp_keymaps(bufnr)
    local nmap = function(keys, func, desc)
        if desc then desc = "LSP: " .. desc end
        vim.keymap.set("n", keys, func, { buffer = bufnr, desc = desc })
    end

    nmap("<leader>rn", vim.lsp.buf.rename, "[R]e[n]ame")
    nmap("<leader>ca", vim.lsp.buf.code_action, "[C]ode [A]ction")
    nmap("<leader>ld", require("telescope.builtin").lsp_definitions, "[D]efinition")
    nmap("<leader>lD", require("telescope.builtin").lsp_type_definitions, "Type [D]efinition")
    nmap("<leader>lr", require("telescope.builtin").lsp_references, "[R]eferences")
    nmap("<leader>li", require("telescope.builtin").lsp_implementations, "[I]mplementation")
    nmap("<leader>ds", require("telescope.builtin").lsp_document_symbols, "[D]ocument [S]ymbols")
    nmap("<leader>ws", require("telescope.builtin").lsp_dynamic_workspace_symbols, "[W]orkspace [S]ymbols")
    nmap("K", vim.lsp.buf.hover, "Hover Documentation")
end

function M.on_attach(client, bufnr)
    M.lsp_keymaps(bufnr)
    if client.supports_method("textDocument/inlayHint") then
        vim.lsp.inlay_hint.enable(true, { bufnr })
    end
end

function M.common_capabilities()
    return vim.lsp.protocol.make_client_capabilities()
end

function M.initialize_diagnostics()
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
        virtual_text = false,
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
        },
    }
    vim.diagnostic.config(config)
end

return M