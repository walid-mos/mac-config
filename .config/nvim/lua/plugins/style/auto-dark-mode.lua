local cfg = {
    update_interval = 1000,
    set_dark_mode = function()
        vim.api.nvim_set_option("background", "dark")
    end,
    set_light_mode = function()
        vim.api.nvim_set_option("background", "light")
    end
}

return {
    'f-person/auto-dark-mode.nvim',
    config = function()
        require('auto-dark-mode').setup(cfg)
    end
}
