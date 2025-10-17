return {
    "ray-x/lsp_signature.nvim",
    event = "VeryLazy",
    opts = {
        bind = true,
        handler_opts = {
            border = "rounded"
        },
        floating_window = true,
        hint_enable = true,
        hint_prefix = " ",
        hi_parameter = "LspSignatureActiveParameter",
        max_height = 12,
        max_width = 80,
        transparency = 10,
        timer_interval = 200,
        toggle_key = nil, -- Disabled to avoid conflict with Ctrl+k navigation
    },
    config = function(_, opts)
        require("lsp_signature").setup(opts)
    end
}
