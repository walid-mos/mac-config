local cfg = {
  ui = { border = "rounded" },
}

return {
  "williamboman/mason.nvim",
  config = function()
    require("mason").setup(cfg)
  end,
}
