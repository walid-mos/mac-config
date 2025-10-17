-- Smart splits pour navigation dans Neovim
-- Ghostty utilise Alt+hjkl pour ses panes
-- Neovim utilise Ctrl+hjkl pour ses splits
return {
    "mrjones2014/smart-splits.nvim",
    lazy = false,
    config = function()
        require("smart-splits").setup({
            -- Ignored filetypes (only while resizing)
            ignored_filetypes = { "nofile", "quickfix", "prompt" },
            -- Ignored buffer types (only while resizing)
            ignored_buftypes = { "NvimTree" },
            -- Default amount to resize by
            default_amount = 3,
            -- Stop at edges (no multiplexer integration needed)
            at_edge = "stop",
            -- Resize mode configuration
            resize_mode = {
                quit_key = "<ESC>",
                resize_keys = { "h", "j", "k", "l" },
                silent = false,
            },
            -- Enable cursor follows focus for better UX
            cursor_follows_focus = true,
            -- log level
            log_level = "info",
        })

        local keymap = vim.keymap.set

        -- Navigation entre splits Neovim avec Ctrl+hjkl
        keymap("n", "<C-h>", require("smart-splits").move_cursor_left, { desc = "Move to left split" })
        keymap("n", "<C-j>", require("smart-splits").move_cursor_down, { desc = "Move to down split" })
        keymap("n", "<C-k>", require("smart-splits").move_cursor_up, { desc = "Move to up split" })
        keymap("n", "<C-l>", require("smart-splits").move_cursor_right, { desc = "Move to right split" })

        -- Redimensionnement des splits avec Ctrl+Shift+hjkl
        keymap("n", "<C-S-h>", require("smart-splits").resize_left, { desc = "Resize split left" })
        keymap("n", "<C-S-j>", require("smart-splits").resize_down, { desc = "Resize split down" })
        keymap("n", "<C-S-k>", require("smart-splits").resize_up, { desc = "Resize split up" })
        keymap("n", "<C-S-l>", require("smart-splits").resize_right, { desc = "Resize split right" })
    end,
}