-- Telescope state management
local telescope_state = {
    last_command = nil,
    last_opts = nil,
    last_prompt = "",
    reopen = false
}

-- Helper function for telescope navigation with reopen
local function telescope_nav_with_reopen(direction)
    return function()
        local actions = require('telescope.actions')
        local actions_state = require('telescope.actions.state')
        local picker = actions_state.get_current_picker(vim.api.nvim_get_current_buf())
        
        -- Save state before closing
        telescope_state.last_prompt = picker:_get_prompt()
        telescope_state.reopen = true
        
        -- Close telescope
        actions.close(vim.api.nvim_get_current_buf())
        
        -- Navigate immediately
        require('zellij-nav')[direction]()
        
        -- Reopen telescope immediately
        vim.schedule(function()
            if telescope_state.reopen then
                telescope_state.reopen = false
                if telescope_state.last_command then
                    -- Use our saved command
                    local opts = vim.tbl_extend('force', telescope_state.last_opts or {}, {
                        default_text = telescope_state.last_prompt
                    })
                    telescope_state.last_command(opts)
                else
                    -- Fallback to telescope resume for pickers we didn't wrap
                    require('telescope.builtin').resume()
                end
            end
        end)
    end
end

local cfg = {
    pickers = {
        find_files = { hidden = true },
        buffers = {
            initial_mode = "normal",
            sort_lastused = true
        },
        lsp_type_definitions = {
            file_ignore_patterns = {
                -- TypeScript lib files (types génériques du langage)
                "lib%.es.*%.d%.ts$",           -- lib.es2015.d.ts, lib.dom.d.ts, etc.
                "lib%.dom.*%.d%.ts$",          -- lib.dom.d.ts
                "lib%..*%.d%.ts$",             -- Autres lib.*.d.ts génériques
                
                -- Types génériques spécifiques (pas tout @types/)
                "node_modules/@types/node/globals%.d%.ts",  -- Globals Node (trop générique)
                "/typescript/lib/",            -- Dossier lib TypeScript core
                
                -- Noms de fichiers génériques
                "/Array%.d%.ts$",              -- Définitions Array pures
                "/Promise%.d%.ts$",            -- Définitions Promise pures
                "/Object%.d%.ts$",             -- Définitions Object pures
            }
        }
    },
    defaults = {
        file_ignore_patterns = {
            '.git/',
            'pnpm%-lock.yaml',
            'yarn.lock',
            'package%-lock.json',
        },
        mappings = {
            i = {
                ['<C-u>'] = false,
                ['<C-d>'] = false,
                -- Allow Alt+hjkl to pass through to zellij navigation
                ['<A-h>'] = telescope_nav_with_reopen('left'),
                ['<A-j>'] = telescope_nav_with_reopen('down'),
                ['<A-k>'] = telescope_nav_with_reopen('up'),
                ['<A-l>'] = telescope_nav_with_reopen('right'),
            },
            n = {
                ["ss"] = "select_vertical",
                ["sh"] = "select_horizontal",
                -- Allow Alt+hjkl to pass through to zellij navigation
                ['<A-h>'] = telescope_nav_with_reopen('left'),
                ['<A-j>'] = telescope_nav_with_reopen('down'),
                ['<A-k>'] = telescope_nav_with_reopen('up'),
                ['<A-l>'] = telescope_nav_with_reopen('right'),
            }
        },
        theme = "center",
        sorting_strategy = "ascending",
        layout_config = {
            horizontal = {
                prompt_position = "top",
                preview_width = 0.6,
            },
        }
    },
    extensions = {
        file_browser = {
            hijack_netrw = true,
            initial_mode = "normal",
            no_ignore = true,
            hidden = {
                file_browser = true,
                folder_browser = true,
            },
            grouped = true,
            select_buffer = false,
        },
        ["ui-select"] = {
            require("telescope.themes").get_dropdown {}
        }
    },
}

-- Fonctions utilitaires et mappings
local function find_git_root()
    local current_file = vim.api.nvim_buf_get_name(0)
    local cwd = vim.fn.getcwd()
    local current_dir = (current_file == "" and cwd) or vim.fn.fnamemodify(current_file, ":h")
    local git_root = vim.fn.systemlist("git -C " .. vim.fn.escape(current_dir, " ") .. " rev-parse --show-toplevel")[1]
    if vim.v.shell_error ~= 0 then
        print("Not a git repository. Searching on current working directory")
        return cwd
    end
    return git_root
end

local function live_grep_git_root()
    local git_root = find_git_root()
    if git_root then
        require('telescope.builtin').live_grep({ search_dirs = { git_root } })
    end
end


local function reopen_telescope()
    if telescope_state.last_command then
        telescope_state.last_command(telescope_state.last_opts or {})
    else
        require('telescope.builtin').resume()
    end
end

local function setup_mappings()
    local builtin = require('telescope.builtin')
    
    -- Wrapper to store the last command
    local function telescope_wrapper(func, opts)
        return function()
            telescope_state.last_command = function(override_opts)
                func(override_opts or opts)
            end
            telescope_state.last_opts = opts
            if opts then
                func(opts)
            else
                func()
            end
        end
    end
    
    vim.keymap.set('n', '<leader>?', telescope_wrapper(builtin.oldfiles), { desc = '[?] Find recently opened files' })
    vim.keymap.set('n', '<leader><space>', telescope_wrapper(builtin.buffers), { desc = '[ ] Find existing buffers' })
    vim.keymap.set('n', '<leader>ss', telescope_wrapper(function()
        builtin.current_buffer_fuzzy_find(require('telescope.themes').get_dropdown { winblend = 10, previewer = false })
    end), { desc = '[/] Fuzzily search in current buffer' })
    vim.keymap.set('n', '<leader>sf', telescope_wrapper(builtin.find_files), { desc = '[S]earch [F]iles' })
    vim.keymap.set('n', '<leader>sg', telescope_wrapper(builtin.live_grep), { desc = '[S]earch by [G]rep' })
    vim.keymap.set('n', '<leader>sw', telescope_wrapper(builtin.grep_string), { desc = '[S]earch current [W]ord' })
    vim.keymap.set('n', '<leader>sh', telescope_wrapper(builtin.help_tags), { desc = '[S]earch [H]elp' })
    vim.keymap.set('n', '<leader>sG', ':LiveGrepGitRoot<cr>', { desc = '[S]earch by [G]rep on Git Root' })
    vim.keymap.set('n', '<leader>sr', builtin.resume, { desc = '[S]earch [R]esume' })
    vim.keymap.set('n', '<leader>st', reopen_telescope, { desc = '[S]earch [T]elescope reopen' })
    
    -- File browser with state tracking
    vim.keymap.set('n', '<leader>-', telescope_wrapper(function()
        require('telescope').extensions.file_browser.file_browser({
            path = vim.fn.expand('%:p:h'),
            select_buffer = true
        })
    end), { desc = 'Open file explorer' })
    
end

-- Export telescope state for other modules
local M = {}
M.get_telescope_state = function()
    return telescope_state
end

return {
    get_telescope_state = M.get_telescope_state,
    {
        'nvim-telescope/telescope.nvim',
        branch = '0.1.x',
        dependencies = {
            'nvim-lua/plenary.nvim',
            {
                'nvim-telescope/telescope-fzf-native.nvim',
                build = 'make',
                cond = function()
                    return vim.fn.executable 'make' == 1
                end,
            },
        },
        config = function()
            require('telescope').setup(cfg)
            pcall(require('telescope').load_extension, 'fzf')
            setup_mappings()
            vim.api.nvim_create_user_command('LiveGrepGitRoot', live_grep_git_root, {})
        end
    },
    {
        'nvim-telescope/telescope-ui-select.nvim',
        dependencies = { "nvim-telescope/telescope.nvim" },
        config = function()
            require("telescope").load_extension("ui-select")
        end

    },
    {
        "nvim-telescope/telescope-file-browser.nvim",
        dependencies = { "nvim-telescope/telescope.nvim", "nvim-lua/plenary.nvim" },
        config = function()
            require("telescope").load_extension "file_browser"
        end
    }
}
