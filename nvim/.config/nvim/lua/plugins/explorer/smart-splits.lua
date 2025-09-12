-- Smart splits pour navigation seamless Neovim ↔ Ghostty
return {
    "mrjones2014/smart-splits.nvim",
    lazy = false, -- Important: Don't lazy load for proper multiplexer integration
    config = function()
        -- Set up Ghostty multiplexer integration
        -- Smart-splits.nvim automatically detects multiplexer via TERM_PROGRAM
        -- For Ghostty, TERM_PROGRAM=ghostty
        
        require("smart-splits").setup({
            -- Ignored filetypes (only while resizing)
            ignored_filetypes = { "nofile", "quickfix", "prompt" },
            -- Ignored buffer types (only while resizing)  
            ignored_buftypes = { "NvimTree" },
            -- Default amount to resize by
            default_amount = 3,
            -- Behavior at the edge of splits - this is key for Ghostty integration
            at_edge = "stop", -- Stop at edges and let Ghostty handle the navigation
            -- Whether to automatically resize the terminal multiplexer when resizing splits
            resize_mode = {
                quit_key = "<ESC>",
                resize_keys = { "h", "j", "k", "l" },
                silent = false,
                hooks = {
                    on_enter = nil,
                    on_leave = nil,
                },
            },
            -- Multiplexer integration configuration
            -- Ghostty is not officially supported yet, so we use custom at_edge function
            multiplexer_integration = nil, -- Let it auto-detect, fallback to our custom handling
            -- Enable cursor follows focus for better UX
            cursor_follows_focus = true,
            -- log level, one of: 'trace'|'debug'|'info'|'warn'|'error'|'fatal'
            log_level = "info",
        })

        -- Set environment variable to help Ghostty detect Neovim
        -- This allows Ghostty to conditionally handle Alt+hjkl navigation
        vim.env.IS_NVIM = "true"

        -- Keymaps pour navigation entre splits
        local keymap = vim.keymap.set

        -- Custom navigation functions with Ghostty integration
        local function smart_navigate_with_fallback(direction)
            local win_before = vim.api.nvim_get_current_win()
            
            -- Try smart-splits navigation within Neovim first  
            local move_func = {
                left = require("smart-splits").move_cursor_left,
                down = require("smart-splits").move_cursor_down,
                up = require("smart-splits").move_cursor_up, 
                right = require("smart-splits").move_cursor_right
            }
            
            move_func[direction]()
            
            -- If we didn't move (at edge of Neovim), fallback to Ghostty
            if win_before == vim.api.nvim_get_current_win() and vim.env.TERM_PROGRAM == "ghostty" then
                -- Call Ghostty's split navigation using the alternative keybindings
                local ghostty_key_map = {
                    left = "<A-S-h>",
                    down = "<A-S-j>", 
                    up = "<A-S-k>",
                    right = "<A-S-l>"
                }
                -- Send the Ghostty navigation key combination
                vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes(ghostty_key_map[direction], true, false, true), "n", false)
            end
        end

        -- Navigation entre splits avec fallback intelligent vers Ghostty
        keymap("n", "<A-h>", function() smart_navigate_with_fallback("left") end, { desc = "Move to left split" })
        keymap("n", "<A-j>", function() smart_navigate_with_fallback("down") end, { desc = "Move to down split" }) 
        keymap("n", "<A-k>", function() smart_navigate_with_fallback("up") end, { desc = "Move to up split" })
        keymap("n", "<A-l>", function() smart_navigate_with_fallback("right") end, { desc = "Move to right split" })

        -- Also handle the escape sequences that Ghostty sends
        keymap("n", "<Esc>[1;3D", function() smart_navigate_with_fallback("left") end, { desc = "Move to left split (escape seq)" })
        keymap("n", "<Esc>[1;3B", function() smart_navigate_with_fallback("down") end, { desc = "Move to down split (escape seq)" })
        keymap("n", "<Esc>[1;3A", function() smart_navigate_with_fallback("up") end, { desc = "Move to up split (escape seq)" })
        keymap("n", "<Esc>[1;3C", function() smart_navigate_with_fallback("right") end, { desc = "Move to right split (escape seq)" })

        -- Redimensionnement des splits (changed to avoid conflict with Ghostty fallback)
        -- Using Ctrl+Alt instead of Alt+Shift to avoid conflict with Ghostty navigation fallback
        keymap("n", "<C-A-h>", require("smart-splits").resize_left, { desc = "Resize split left" })
        keymap("n", "<C-A-j>", require("smart-splits").resize_down, { desc = "Resize split down" })
        keymap("n", "<C-A-k>", require("smart-splits").resize_up, { desc = "Resize split up" })
        keymap("n", "<C-A-l>", require("smart-splits").resize_right, { desc = "Resize split right" })
    end,
}