local cfg = {
    pickers = {
        find_files = {
            hidden = true
        },
        buffers = {
            initial_mode = "normal",
            sort_lastused = true
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
            },
            n = {
                ["ss"] = "select_vertical",
                ["sh"] = "select_horizontal"
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
    },
}


return {
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
        init = function()
            pcall(require('telescope').load_extension, 'fzf')

            local function find_git_root()
                local current_file = vim.api.nvim_buf_get_name(0)
                local current_dir
                local cwd = vim.fn.getcwd()

                if current_file == "" then
                    current_dir = cwd
                else
                    current_dir = vim.fn.fnamemodify(current_file, ":h")
                end

                local git_root = vim.fn.systemlist("git -C " ..
                    vim.fn.escape(current_dir, " ") .. " rev-parse --show-toplevel")[1]
                if vim.v.shell_error ~= 0 then
                    print("Not a git repository. Searching on current working directory")
                    return cwd
                end
                return git_root
            end

            local function live_grep_git_root()
                local git_root = find_git_root()
                if git_root then
                    require('telescope.builtin').live_grep({
                        search_dirs = { git_root },
                    })
                end
            end

            local conf = require("telescope.config").values
            local function toggle_telescope(harpoon_files)
                local file_paths = {}
                for _, item in ipairs(harpoon_files.items) do
                    table.insert(file_paths, item.value)
                end

                require("telescope.pickers").new({
                    initial_mode = 'normal' }, {
                    prompt_title = "Harpoon",
                    finder = require("telescope.finders").new_table({
                        results = file_paths,
                    }),
                    previewer = conf.file_previewer({}),
                    sorter = conf.generic_sorter({}),
                }):find()
            end


            vim.api.nvim_create_user_command('LiveGrepGitRoot', live_grep_git_root, {})

            vim.keymap.set('n', '<leader>?', require('telescope.builtin').oldfiles,
                { desc = '[?] Find recently opened files' })
            vim.keymap.set('n', '<leader><space>', require('telescope.builtin').buffers,
                { desc = '[ ] Find existing buffers' })
            vim.keymap.set('n', '<leader>/', function()
                require('telescope.builtin').current_buffer_fuzzy_find(require('telescope.themes').get_dropdown {
                    winblend = 10,
                    previewer = false,
                })
            end, { desc = '[/] Fuzzily search in current buffer' })

            vim.keymap.set('n', '<leader>sf', require('telescope.builtin').find_files, { desc = '[S]earch [F]iles' })
            vim.keymap.set('n', '<leader>sg', require('telescope.builtin').live_grep, { desc = '[S]earch by [G]rep' })
            vim.keymap.set('n', '<leader>sw', require('telescope.builtin').grep_string,
                { desc = '[S]earch current [W]ord' })
            vim.keymap.set('n', '<leader>sh', require('telescope.builtin').help_tags, { desc = '[S]earch [H]elp' })
            vim.keymap.set('n', '<leader>sG', ':LiveGrepGitRoot<cr>', { desc = '[S]earch by [G]rep on Git Root' })
            vim.keymap.set('n', '<leader>sr', require('telescope.builtin').resume, { desc = '[S]earch [R]esume' })
            vim.keymap.set('n', '<leader>hw', function() toggle_telescope(require('harpoon'):list()) end,
                { desc = 'Open [H]arpoon [W]indow' })
        end,
    },
    {
        "nvim-telescope/telescope-file-browser.nvim",
        dependencies = { "nvim-telescope/telescope.nvim", "nvim-lua/plenary.nvim" },
        config = function()
            require('telescope').setup(cfg)
            require("telescope").load_extension "file_browser"
        end
    }
}
