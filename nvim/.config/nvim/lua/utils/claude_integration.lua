-- Claude Code integration utilities
local M = {}

-- Find Claude pane in current tab
function M.find_claude_pane()
    vim.notify("DEBUG: Starting pane detection...")
    
    -- Get current tab info
    local tab_names = vim.fn.system("zellij action query-tab-names")
    vim.notify("DEBUG: Available tabs: " .. tab_names:gsub("\n", " | "))
    
    -- Try a different approach: check screen content for Claude
    local max_panes = 10  -- Reasonable limit
    local initial_pane_id = nil
    
    -- First, get current pane info
    local current_clients = vim.fn.system("zellij action list-clients")
    if current_clients and current_clients ~= "" then
        initial_pane_id = current_clients:match("(%w+_%d+)%s+nvim")
        vim.notify("DEBUG: Starting from pane: " .. (initial_pane_id or "unknown"))
    end
    
    -- Cycle through panes and check screen content
    for i = 1, max_panes do
        vim.fn.system("zellij action focus-next-pane")
        
        -- Small delay to let pane focus settle
        vim.fn.system('sleep 0.05')
        
        -- Check screen content for Claude indicators
        vim.fn.system('zellij action dump-screen /tmp/zellij_pane_check.txt')
        local screen_content = vim.fn.system('cat /tmp/zellij_pane_check.txt 2>/dev/null || echo ""')
        
        vim.notify("DEBUG: Pane " .. i .. " screen preview: " .. screen_content:sub(1, 50):gsub("\n", "\\n"))
        
        -- Look for Claude Code indicators in screen content
        if screen_content:find("Claude Code") or screen_content:find("Welcome to Claude") or 
           screen_content:find("claude>") or screen_content:find("/Users/.*claude") then
            vim.notify("Found Claude in pane " .. i .. " via screen content!")
            os.remove('/tmp/zellij_pane_check.txt')
            return true
        end
        
        -- Also check if we can see the running command contains claude
        local new_clients = vim.fn.system("zellij action list-clients")
        if new_clients and new_clients ~= "" and new_clients:find("claude") then
            vim.notify("Found Claude in pane " .. i .. " via client list!")
            os.remove('/tmp/zellij_pane_check.txt')
            return true
        end
        
        -- Check if we've cycled back to initial pane
        if new_clients and new_clients ~= "" then
            local current_pane_id = new_clients:match("(%w+_%d+)%s+nvim")
            if current_pane_id == initial_pane_id and i > 1 then
                vim.notify("DEBUG: Back to initial pane, stopping search")
                break
            end
        end
    end
    
    os.remove('/tmp/zellij_pane_check.txt')
    vim.notify("Claude not found in current tab after checking " .. max_panes .. " panes")
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
    vim.notify("DEBUG: Starting send_selection()")
    
    -- Get selected text
    vim.cmd('normal! "zy')
    local selected_text = vim.fn.getreg('z')
    
    vim.notify("DEBUG: Selected text length: " .. #selected_text)
    
    -- Exit visual mode properly and ensure we're in normal mode
    vim.api.nvim_feedkeys(vim.api.nvim_replace_termcodes('<Esc>', true, false, true), 'n', false)
    
    -- Wait a moment for mode change to complete
    vim.fn.system('sleep 0.1')
    
    -- Ensure we're in normal mode and cursor is stable
    vim.cmd('stopinsert')
    local mode = vim.api.nvim_get_mode().mode
    vim.notify("DEBUG: Current mode after escape: " .. mode)
    
    if selected_text == '' then
        print('No text selected')
        return
    end
    
    -- Additional stabilization before calling zellij
    vim.fn.system('sleep 0.05')
    
    -- Send with code block wrapper
    local wrapper = { open = "```", close = "```" }
    local callback = function()
        print('Sent selected text to Claude Code')
    end
    
    vim.notify("DEBUG: About to call send_to_claude()")
    M.send_to_claude(selected_text, wrapper, callback)
end

return M