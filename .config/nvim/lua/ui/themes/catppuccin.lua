local cfg = {
    background = {
        light = "latte",
        dark = "frappe"
    },
    term_colors = true,
    integrations = {
        telescope = true,
        mason = true,
    },
    flavour = "auto"
}

return {
  {
    "catppuccin/nvim",
    lazy = false,
    name = "catppuccin",
    priority = 1000,
    config = function()
      require('catppuccin').setup()

      vim.cmd.colorscheme "catppuccin"
    end
  }
}
