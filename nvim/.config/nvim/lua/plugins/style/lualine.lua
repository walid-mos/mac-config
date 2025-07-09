local cfg = {
    options = {
        theme = "catppuccin",
        ignore_focus = { "NvimTree" },
        icons_enabled = true,
    },
    sections = {
        lualine_a = {'mode'},
        lualine_b = {'branch', { 
            'diagnostics',
                sources = { 'nvim_diagnostic' },
                symbols = { error = ' ', warn = ' ', info = ' ', hint = ' ' }
            }
        },
        lualine_c = {
            { 
                'filename', path = 1, symbols = { modified = ' ●', readonly = ' ', unnamed = ' [No Name]' } 
            }, 
            'diff'},
        lualine_x = {'encoding', 'fileformat', 'filetype'},
        lualine_y = {'progress'},
        lualine_z = {'location'}
    },
    extensions = { "quickfix", "man", "fugitive", "lazy" },
}

return {
    'nvim-lualine/lualine.nvim',
    config = function()
        require('lualine').setup(cfg)
    end
}
