return {
	"aimdevlee/herdr-nvim-nav",
	config = function()
		require("herdr-nvim-nav").setup({
			keymaps = {
				left = { "<C-h>" },
				down = { "<C-j>" },
				up = { "<C-k>" },
				right = { "<C-l>" },
			},
		})
	end,
}
