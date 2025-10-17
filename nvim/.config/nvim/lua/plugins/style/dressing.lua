return {
    "stevearc/dressing.nvim",
    event = "VeryLazy",
    opts = {
        input = {
            enabled = true,
            default_prompt = "Input",
            prompt_align = "left",
            insert_only = false,
            start_in_insert = true,
            border = "rounded",
            relative = "cursor",
            prefer_width = 40,
            width = nil,
            max_width = { 140, 0.9 },
            min_width = { 20, 0.2 },
            win_options = {
                winblend = 10,
                wrap = false,
            },
        },
        select = {
            enabled = true,
            backend = { "telescope", "builtin" },
            trim_prompt = true,
            telescope = require("telescope.themes").get_cursor(),
        },
    },
}
