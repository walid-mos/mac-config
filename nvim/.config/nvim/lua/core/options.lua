-- Leader keys — must be set before plugins
vim.g.mapleader = " "
vim.g.maplocalleader = "//"

-- Disable netrw (using oil.nvim)
vim.g.loaded_netrw = 1
vim.g.loaded_netrwPlugin = 1

-- Clipboard sync with OS
vim.opt.clipboard = "unnamedplus"

-- Line numbers
vim.opt.number = true
vim.opt.relativenumber = true
vim.opt.cursorline = true
vim.opt.ruler = false

-- Mouse
vim.opt.mouse = "a"

-- Tabs & indentation
vim.opt.tabstop = 4
vim.opt.shiftwidth = 4
vim.opt.softtabstop = 4
vim.opt.expandtab = true
vim.opt.smartindent = true
vim.opt.wrap = false

-- Scroll
vim.opt.scrolloff = 4
vim.opt.sidescrolloff = 8
vim.opt.pumheight = 10
vim.opt.pumblend = 10

-- Splits
vim.opt.splitbelow = true
vim.opt.splitright = true

-- Files
vim.opt.backup = false
vim.opt.swapfile = false
vim.opt.writebackup = false
vim.opt.hidden = true
vim.opt.autoread = true
vim.opt.undofile = true

-- Search
vim.opt.ignorecase = true
vim.opt.smartcase = true

-- UI
vim.wo.signcolumn = "yes"
vim.opt.updatetime = 250
vim.opt.timeoutlen = 300
vim.opt.numberwidth = 4
vim.opt.completeopt = { "menuone", "noselect" }
vim.opt.cmdheight = 1
vim.opt.termguicolors = true
vim.opt.showcmd = false
vim.opt.title = false
vim.opt.conceallevel = 0
vim.opt.laststatus = 3
vim.opt.shortmess:append("c")

vim.cmd("set whichwrap+=<,>,[,],h,l")
vim.cmd([[set iskeyword+=-]])

vim.opt.fillchars = vim.opt.fillchars + "eob: "
vim.opt.fillchars:append({ stl = " " })
