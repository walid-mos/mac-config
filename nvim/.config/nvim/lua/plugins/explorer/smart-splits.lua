-- Smart splits pour navigation seamless Neovim ↔ Ghostty
return {
    "mrjones2014/smart-splits.nvim",
    config = function()
        require("smart-splits").setup({
            -- Ignored filetypes (only while resizing)
            ignored_filetypes = { "nofile", "quickfix", "prompt" },
            -- Ignored buffer types (only while resizing)  
            ignored_buftypes = { "NvimTree" },
            -- Default amount to resize by
            default_amount = 3,
            -- Whether to automatically resize the terminal multiplexer when resizing splits
            resize_mode = {
                -- Can be 'disabled', 'hooks', or 'silent'
                quit_key = "<ESC>",
                resize_keys = { "h", "j", "k", "l" },
                silent = false,
                hooks = {
                    on_enter = nil,
                    on_leave = nil,
                },
            },
            -- log level, one of: 'trace'|'debug'|'info'|'warn'|'error'|'fatal'
            log_level = "info",
        })

        -- Keymaps pour navigation entre splits
        local keymap = vim.keymap.set

        -- Navigation entre splits (avec fallback vers Ghostty)
        keymap("n", "<A-h>", require("smart-splits").move_cursor_left, { desc = "Move to left split" })
        keymap("n", "<A-j>", require("smart-splits").move_cursor_down, { desc = "Move to down split" })
        keymap("n", "<A-k>", require("smart-splits").move_cursor_up, { desc = "Move to up split" })
        keymap("n", "<A-l>", require("smart-splits").move_cursor_right, { desc = "Move to right split" })

        -- Redimensionnement des splits
        keymap("n", "<A-S-h>", require("smart-splits").resize_left, { desc = "Resize split left" })
        keymap("n", "<A-S-j>", require("smart-splits").resize_down, { desc = "Resize split down" })
        keymap("n", "<A-S-k>", require("smart-splits").resize_up, { desc = "Resize split up" })
        keymap("n", "<A-S-l>", require("smart-splits").resize_right, { desc = "Resize split right" })
    end,
}