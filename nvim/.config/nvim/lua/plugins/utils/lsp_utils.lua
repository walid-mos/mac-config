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

    nmap("<leader>rn", vim.lsp.buf.rename, "[R]e[n]ame")
    nmap("<leader>ca", vim.lsp.buf.code_action, "[C]ode [A]ction")
    nmap("<leader>cd", telescope_lsp_wrapper(require("telescope.builtin").lsp_definitions), "[D]efinition")
    nmap("<leader>cD", telescope_lsp_wrapper(require("telescope.builtin").lsp_type_definitions), "Type [D]efinition")
    nmap("<leader>cr", telescope_lsp_wrapper(require("telescope.builtin").lsp_references), "[R]eferences")
    nmap("<leader>ci", telescope_lsp_wrapper(require("telescope.builtin").lsp_implementations), "[I]mplementation")
    nmap("<leader>ds", telescope_wrapper(require("telescope.builtin").lsp_document_symbols), "[D]ocument [S]ymbols")
    nmap("<leader>ws", telescope_wrapper(require("telescope.builtin").lsp_dynamic_workspace_symbols), "[W]orkspace [S]ymbols")
    nmap("K", vim.lsp.buf.hover, "Hover Documentation")
    nmap("<leader>cK", vim.lsp.buf.signature_help, "Signature [H]elp")
end

local on_attach = function(client, bufnr)
    lsp_keymaps(bufnr)
    if client:supports_method("textDocument/inlayHint") then
        vim.lsp.inlay_hint.enable(true, { bufnr })
    end
end

local common_capabilities = function ()
    return require('cmp_nvim_lsp').default_capabilities()
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
