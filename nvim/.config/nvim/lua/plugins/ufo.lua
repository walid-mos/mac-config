-- nvim-ufo: Modern, high-performance code folding
-- Provides better folding than basic Treesitter with preview capabilities

return {
	"kevinhwang91/nvim-ufo",
	dependencies = "kevinhwang91/promise-async",
	event = "BufReadPost",

	opts = {
		-- Use Treesitter as primary provider, indent as fallback
		-- Performance is better than foldmethod=nvim_treesitter#foldexpr()
		provider_selector = function(bufnr, filetype, buftype)
			-- Disable ufo for oil buffers (prevents mkview errors)
			if filetype == "oil" then
				return ""
			end
			return { "treesitter", "indent" }
		end,
	},

	config = function(_, opts)
		-- Fold options
		vim.o.foldlevel = 99 -- Start with all folds open
		vim.o.foldlevelstart = 99 -- All folds open when opening a buffer
		vim.o.foldenable = true -- Enable folding

		-- Setup nvim-ufo
		require("ufo").setup(opts)

		-- Enhanced fold keymaps
		vim.keymap.set("n", "zR", require("ufo").openAllFolds, { desc = "Open all folds" })
		vim.keymap.set("n", "zM", require("ufo").closeAllFolds, { desc = "Close all folds" })

		-- Fold preview with K key
		-- If cursor is on a folded line, show preview
		-- Otherwise, show LSP hover documentation
		vim.keymap.set("n", "K", function()
			local winid = require("ufo").peekFoldedLinesUnderCursor()
			if not winid then
				vim.lsp.buf.hover()
			end
		end, { desc = "Peek fold or show hover" })
	end,
}
