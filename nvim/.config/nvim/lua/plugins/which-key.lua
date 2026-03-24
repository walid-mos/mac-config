return {
	"folke/which-key.nvim",
	event = "VeryLazy",

	opts = {
		preset = "modern",
		delay = 200,

		spec = {
			{ "<leader>b", group = "[B]uffer" },
			{ "<leader>c", group = "[C]ode" },
			{ "<leader>f", group = "[F]ind" },
			{ "<leader>t", group = "[T]oggle" },
			{ "<leader>w", group = "[W]orkspace" },
		},

		win = {
			border = "rounded",
			padding = { 1, 2 },
		},

		icons = {
			group = "+ ",
			mappings = false,
		},
	},
}
