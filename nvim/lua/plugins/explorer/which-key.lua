local cfg = {
    preset = "modern"
}

return {
    "folke/which-key.nvim",
    dependencies = {
        { 'echasnovski/mini.nvim', version = false },
        { 'nvim-tree/nvim-web-devicons' }
    },
    event = "VeryLazy",
    init = function()
        vim.o.timeout = true
        vim.o.timeoutlen = 300
    end,
    config = function(_, opts)
        require('mini.icons').setup()
        local wk = require("which-key")
        wk.add({
            {'<leader>c', desc = '[C]ode'},
            {'<leader>d', name = '[D]ocument' },
            {'<leader>l', name = '[L]SP' },
            {'<leader>r', name = '[R]ename' },
            {'<leader>s', name = '[S]earch' },
            {'<leader>w', name = '[W]orkspace' },
            {'<leader>m', name = '[M]ulticursor' },
            {'<leader>h', name = '[H]arpoon' },
        })

        wk.setup(cfg)
    end
}
