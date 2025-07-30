-- Set <space> as the leader key
-- See `:help mapleader`
-- NOTE: Must happen before plugins are required (otherwise wrong leader will be used)
vim.g.mapleader = ' '
vim.g.maplocalleader = '//'

local keymap = vim.keymap.set
local opts = { noremap = true, silent = true }

-- Open explorer menu Netrw's with only <leader>- key
keymap('n', '<leader>-', ":Telescope file_browser path=%:p:h select_buffer=true<CR>", { desc = 'Open file explorer' })

-- Buffer
keymap("n", "<leader>bn", ":bn<CR>", { desc = 'Next buffer' })
keymap("n", "<leader>bp", ":bp<CR>", { desc = 'Prev buffer' })
keymap("n", "<leader>C", ":bd<CR>", { desc = 'Close current buffer' })
keymap("n", "<leader><tab>", "<C-^>", { desc = 'Switch to last buffer' })

-- Quickfix
keymap("n", "]q", ":cnext<CR>", opts)
keymap("n", "[q", ":cprev<CR>", opts)
keymap("n", "]l", ":lnext<CR>", opts)
keymap("n", "[l", ":lprev<CR>", opts)

-- Normal
-- Better window navigation
keymap("n", "<A-h>", "<C-w>h", opts)
keymap("n", "<A-j>", "<C-w>j", opts)
keymap("n", "<A-k>", "<C-w>k", opts)
keymap("n", "<A-l>", "<C-w>l", opts)
keymap("n", "ss", ":vsplit<CR>", opts)
keymap("n", "sv", ":split<CR>", opts)

-- Move lines
keymap({ 'n', 'v' }, 'J', ':m .+1<CR>==', opts)
keymap({ 'n', 'v' }, 'K', ':m .-2<CR>==', opts)

-- Add lines
keymap('n', 'go', 'o<Esc>k', { desc = 'Add one line after' })
keymap('n', 'gO', 'O<Esc>j', { desc = 'Add one line before' })

-- Do not copy when pasted on
keymap("x", "p", [["_dP]])

keymap("n", "<leader>ch", ":noh<CR>", { desc = 'Clear highlight' })

-- Normal
-- Indent fast
keymap("n", "<", "<<", opts)
keymap("n", ">", ">>", opts)

-- Visual
-- Stay in indent mode
keymap("v", "<", "<gv", opts)
keymap("v", ">", ">gv", opts)


-- Insert
-- Move in line
keymap("i", "<A-k>", "<Esc>2wi", opts)
keymap("i", "<A-j>", "<Esc>bi", opts)
keymap("i", "<A-h>", "<Esc>0i", opts)
keymap("i", "<A-l>", "<Esc>$i", opts)
-- Delete a word
keymap("i", "<A-BS>", "<Esc>wdbi", opts)


-- Utils
-- Diagnostic keymaps
keymap('n', '[d', vim.diagnostic.goto_prev, { desc = 'Go to previous diagnostic message' })
keymap('n', ']d', vim.diagnostic.goto_next, { desc = 'Go to next diagnostic message' })
keymap('n', '<leader>e', vim.diagnostic.open_float, { desc = 'Open floating diagnostic message' })
keymap('n', '<leader>q', vim.diagnostic.setloclist, { desc = 'Open diagnostics list' })

-- Utils for centering in search mode
keymap("n", "n", "nzz", opts)
keymap("n", "N", "Nzz", opts)
keymap("n", "*", "*zz", opts)
keymap("n", "#", "#zz", opts)

-- Easier start and endline
keymap({ "n", "o", "x" }, "<leader>h", "^", { desc = 'Line start' })
keymap({ "n", "o", "x" }, "<leader>l", "g_", { desc = 'Line end' })

-- Remove line ending
keymap({ "n", "i" }, "<S-A-j>", ":join<CR>", opts)

-- tailwind bearable to work with
keymap({ "n", "x" }, "j", "gj", opts)
keymap({ "n", "x" }, "k", "gk", opts)
-- keymap("n", "<leader>w", ":lua vim.wo.wrap = not vim.wo.wrap<CR>", opts)


-- Yank and paste from multiple files / buffers
--keymap({'n', 'v'}, '<leader>y', '"*y', { desc = '[Y]ank between files' })
--keymap({'n', 'v'}, '<leader>p', '"*p', { desc = '[P]aste between files' })

-- Claude Code integration
keymap('n', '<leader>cf', function()
    local filepath = vim.fn.expand('%:p')
    if filepath == '' then
        print('No file to send')
        return
    end
    
    -- Find Claude pane in current tab (optimized but working version)
    local function find_claude_pane()
        -- Get initial state ONCE
        local initial_clients = vim.fn.system("zellij action list-clients")
        local initial_nvim_pane = initial_clients:match("(%S+)%s+nvim")
        
        -- Cycle through panes until we find Claude or come back to nvim
        for i = 1, 20 do  -- Max 20 panes (garde-fou)
            vim.fn.system("zellij action focus-next-pane")
            
            -- Only check if we found Claude by testing list-clients ONCE per pane
            local clients = vim.fn.system("zellij action list-clients")
            
            -- If we found Claude, we're done!
            if clients:find("claude") then
                vim.notify("Found Claude in pane " .. i .. "!")
                return true
            end
            
            -- Quick check: if we're back to nvim pane, we've cycled through all panes
            local current_nvim_pane = clients:match("(%S+)%s+nvim")
            if current_nvim_pane == initial_nvim_pane and i > 1 then
                vim.notify("Cycled back to nvim, Claude not found in tab")
                return false
            end
        end
        
        vim.notify("Reached max panes (20), Claude not found")
        return false
    end
    
    if not find_claude_pane() then
        -- Fallback: just move right
        vim.fn.system("zellij action move-focus right")
    end
    
    -- Send the file path using temp file
    local temp_file = '/tmp/nvim_claude_file'
    local file = io.open(temp_file, 'w')
    if file then
        file:write(filepath)
        file:close()
        vim.fn.system('zellij action write-chars "$(cat ' .. temp_file .. ')"')
        vim.fn.system("zellij action write 10")
        vim.fn.system("zellij action write 10")
        os.remove(temp_file)
    else
        vim.notify("Failed to create temp file")
    end
    print('Sent file to Claude Code: ' .. vim.fn.fnamemodify(filepath, ':t'))
end, { desc = 'Send file to Claude Code' })

keymap('x', '<leader>cs', function()
    -- Get selected text
    vim.cmd('normal! "zy')
    local selected_text = vim.fn.getreg('z')
    
    -- Exit visual mode properly
    vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes('<Esc>', true, false, true), 'n', false)
    
    if selected_text == '' then
        print('No text selected')
        return
    end
    
    -- Write to temp file
    local temp_file = '/tmp/nvim_claude_selection'
    local file = io.open(temp_file, 'w')
    if file then
        file:write(selected_text)
        file:close()
        
        -- Find Claude pane in current tab (optimized but working version)
        local function find_claude_pane()
            -- Get initial state ONCE
            local initial_clients = vim.fn.system("zellij action list-clients")
            local initial_nvim_pane = initial_clients:match("(%S+)%s+nvim")
            
            -- Cycle through panes until we find Claude or come back to nvim
            for i = 1, 20 do  -- Max 20 panes (garde-fou)
                vim.fn.system("zellij action focus-next-pane")
                
                -- Only check if we found Claude by testing list-clients ONCE per pane
                local clients = vim.fn.system("zellij action list-clients")
                
                -- If we found Claude, we're done!
                if clients:find("claude") then
                    vim.notify("Found Claude in pane " .. i .. "!")
                    return true
                end
                
                -- Quick check: if we're back to nvim pane, we've cycled through all panes
                local current_nvim_pane = clients:match("(%S+)%s+nvim")
                if current_nvim_pane == initial_nvim_pane and i > 1 then
                    vim.notify("Cycled back to nvim, Claude not found in tab")
                    return false
                end
            end
            
            vim.notify("Reached max panes (20), Claude not found")
            return false
        end
        
        if not find_claude_pane() then
            -- Fallback: just move right
            vim.fn.system("zellij action move-focus right")
        end
        
        -- Send code block
        vim.fn.system('zellij action write-chars "```"')
        local cmd = string.format('zellij action write-chars "$(cat %s)"', temp_file)
        vim.fn.system(cmd)
        vim.fn.system('zellij action write-chars "```"')
        os.remove(temp_file)
        print('Sent selected text to Claude Code')
    else
        print('Failed to create temp file')
    end
end, { desc = 'Send selected text to Claude Code' })
