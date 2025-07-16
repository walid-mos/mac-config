local lsp_keymaps = function (bufnr)
    local nmap = function(keys, func, desc)
        if desc then desc = "LSP: " .. desc end
        vim.keymap.set("n", keys, func, { buffer = bufnr, desc = desc })
    end

    nmap("<leader>rn", vim.lsp.buf.rename, "[R]e[n]ame")
    nmap("<leader>ca", vim.lsp.buf.code_action, "[C]ode [A]ction")
    nmap("<leader>cd", require("telescope.builtin").lsp_definitions, "[D]efinition")
    nmap("<leader>cD", require("telescope.builtin").lsp_type_definitions, "Type [D]efinition")
    nmap("<leader>cr", require("telescope.builtin").lsp_references, "[R]eferences")
    nmap("<leader>ci", require("telescope.builtin").lsp_implementations, "[I]mplementation")
    nmap("<leader>ds", require("telescope.builtin").lsp_document_symbols, "[D]ocument [S]ymbols")
    nmap("<leader>ws", require("telescope.builtin").lsp_dynamic_workspace_symbols, "[W]orkspace [S]ymbols")
    nmap("K", vim.lsp.buf.hover, "Hover Documentation")
end

local on_attach = function(client, bufnr)
    lsp_keymaps(bufnr)
    if client:supports_method("textDocument/inlayHint") then
        vim.lsp.inlay_hint.enable(true, { bufnr })
    end
end

local common_capabilities = function ()
    return vim.lsp.protocol.make_client_capabilities()
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

return {
    on_attach = on_attach,
    common_capabilities = common_capabilities,
    initialize_diagnostics = initialize_diagnostics
}
