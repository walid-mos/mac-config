local parsers = {
	"lua", "vim", "vimdoc", "query",
	"javascript", "typescript", "tsx", "python",
	"html", "css", "odin", "c",
	"json", "markdown", "markdown_inline", "bash",
	"sql", "regex", "toml", "yaml",
}

local filetypes = {
	"lua", "vim", "help", "query",
	"javascript", "typescript", "typescriptreact", "python",
	"html", "css", "odin", "c",
	"json", "jsonc", "markdown", "sh",
	"sql", "toml", "yaml",
}

return {
	"nvim-treesitter/nvim-treesitter",
	branch = "main",
	build = ":TSUpdate",
	lazy = false,

	config = function()
		require("nvim-treesitter").setup()
		require("nvim-treesitter").install(parsers)

		vim.api.nvim_create_autocmd("FileType", {
			pattern = filetypes,
			callback = function(args)
				local ok, stats = pcall(vim.loop.fs_stat, vim.api.nvim_buf_get_name(args.buf))
				if ok and stats and stats.size > 100 * 1024 then
					return
				end
				vim.treesitter.start(args.buf)
				vim.bo[args.buf].indentexpr = "v:lua.require'nvim-treesitter'.indentexpr()"
			end,
		})
	end,
}
