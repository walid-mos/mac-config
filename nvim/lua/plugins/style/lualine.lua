local cfg = {
    options = {
        ignore_focus = { "NvimTree" },
    },
    sections = {
        lualine_a = {'mode'},
        lualine_b = {'branch', 'diagnostics'},
        lualine_c = {'filename', 'diff'},
        lualine_x = {'encoding', 'fileformat', 'filetype'},
        lualine_y = {'progress'},
        lualine_z = {'location'}
    },
    extensions = { "quickfix", "man", "fugitive" },
}

return {
    'nvim-lualine/lualine.nvim',
    config = function()
        require('lualine').setup(cfg)
    end
}
