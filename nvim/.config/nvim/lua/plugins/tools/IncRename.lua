return {
    "smjonas/inc-rename.nvim",
    cmd = "IncRename",
    config = function()
        require("inc_rename").setup({
            input_buffer_type = "dressing",
        })
    end,
    keys = {
        {
            "<leader>rn",
            function()
                return ":IncRename " .. vim.fn.expand("<cword>")
            end,
            expr = true,
            desc = "Rename (inc-rename)",
        },
    },
}
