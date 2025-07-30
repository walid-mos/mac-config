-- Claude Code integration utilities
local M = {}

-- Find Claude pane in current tab
function M.find_claude_pane()
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

-- Create new Claude pane if not found
function M.create_claude_pane()
    vim.notify("Creating new Claude pane...")
    
    -- Create new pane to the right
    local result = vim.fn.system('zellij action new-pane -d right')
    if vim.v.shell_error ~= 0 then
        vim.notify("Failed to create pane: " .. result)
        return false
    end
    
    -- Get current working directory and cd to it
    local cwd = vim.fn.getcwd()
    vim.fn.system('zellij action write-chars "cd \\"' .. cwd .. '\\""')
    vim.fn.system('zellij action write 13')  -- Enter key
    
    -- Clear terminal before launching Claude
    vim.fn.system('zellij action write-chars "tput reset"')
    vim.fn.system('zellij action write 13')  -- Enter key
    
    -- Launch Claude synchronously
    vim.fn.system('zellij action write-chars "/Users/walid/Library/pnpm/claude"')
    vim.fn.system('zellij action write 13')  -- Enter key
    
    vim.notify("Claude pane created and launched!")
    return true
end

-- Send content to Claude with fallback
function M.send_to_claude(content, wrapper, callback)
    local claude_ready = true
    
    if not M.find_claude_pane() then
        -- Create new Claude pane if not found
        if not M.create_claude_pane() then
            vim.notify("Failed to create Claude pane")
            return false
        end
        
        -- Wait for Claude to be operational
        vim.notify("Claude is starting, waiting for it to be ready...")
        claude_ready = false
        
        -- Wait for Claude to be ready
        for i = 1, 100 do  -- Max 2 seconds (100 * 20ms)
            vim.fn.system('sleep 0.02')
            local pane_content = vim.fn.system('zellij action dump-screen /tmp/zellij_dump.txt; cat /tmp/zellij_dump.txt')
            -- Look for Claude Code welcome message
            if pane_content:find("Welcome to Claude Code") then
                vim.notify("Claude is ready!")
                claude_ready = true
                break
            end
            if i == 100 then
                vim.notify("Timeout reached, sending content anyway...")
                claude_ready = true
                break
            end
        end
    end
    
    -- Only send content if Claude is ready or if we gave up waiting
    if claude_ready then
        M.send_content_to_pane(content, wrapper)
        if callback then callback() end
    else
        vim.notify("Claude not ready, content not sent")
        return false
    end
    return true
end

-- Helper function to send content to current pane
function M.send_content_to_pane(content, wrapper)
    -- Write content to temp file
    local temp_file = '/tmp/nvim_claude_content'
    local file = io.open(temp_file, 'w')
    if not file then
        vim.notify("Failed to create temp file")
        return false
    end
    
    file:write(content)
    file:close()
    
    -- Send content with optional wrapper (for code blocks)
    if wrapper then
        vim.fn.system('zellij action write-chars "' .. wrapper.open .. '"')
    end
    
    vim.fn.system('zellij action write-chars "$(cat ' .. temp_file .. ')"')
    
    if wrapper then
        vim.fn.system('zellij action write-chars "' .. wrapper.close .. '"')
    end
    
    -- Add newlines
    vim.fn.system("zellij action write 10")
    vim.fn.system("zellij action write 10")
    
    os.remove(temp_file)
    return true
end

-- Send file to Claude
function M.send_file()
    local filepath = vim.fn.expand('%:p')
    if filepath == '' then
        print('No file to send')
        return
    end
    
    local callback = function()
        print('Sent file to Claude Code: ' .. vim.fn.fnamemodify(filepath, ':t'))
    end
    
    M.send_to_claude(filepath, nil, callback)
end

-- Send selected text to Claude
function M.send_selection()
    -- Get selected text
    vim.cmd('normal! "zy')
    local selected_text = vim.fn.getreg('z')
    
    -- Exit visual mode properly
    vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes('<Esc>', true, false, true), 'n', false)
    
    if selected_text == '' then
        print('No text selected')
        return
    end
    
    -- Send with code block wrapper
    local wrapper = { open = "```", close = "```" }
    local callback = function()
        print('Sent selected text to Claude Code')
    end
    
    M.send_to_claude(selected_text, wrapper, callback)
end

return M