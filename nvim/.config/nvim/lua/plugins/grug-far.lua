return {
	"MagicDuck/grug-far.nvim",
	config = function()
		require("grug-far").setup({})

		local map = vim.keymap.set
		map("n", "<leader>rr", function()
			require("grug-far").open()
		end, { desc = "Search and Replace" })
		map("n", "<leader>rw", function()
			require("grug-far").open({ prefills = { search = vim.fn.expand("<cword>") } })
		end, { desc = "Replace word under cursor" })
		map("n", "<leader>rf", function()
			require("grug-far").open({ prefills = { paths = vim.fn.expand("%") } })
		end, { desc = "Replace in current file" })
		map("v", "<leader>rr", function()
			require("grug-far").open({ prefills = { search = require("grug-far").get_current_visual_selection() } })
		end, { desc = "Replace visual selection" })
	end,
}
