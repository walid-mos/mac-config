-- which-key: Shows popup with available keybindings
-- Helps discover keymaps and provides visual feedback when pressing leader

return {
	"folke/which-key.nvim",
	event = "VeryLazy",

	opts = {
		preset = "modern", -- modern, classic, helix
		delay = 125, -- Time in ms before which-key popup appears (4x faster for quick access)

		-- Notification settings
		notify = true,

		-- Icons
		icons = {
			breadcrumb = "»",
			separator = "➜",
			group = "+",
			ellipsis = "…",
			mappings = true,
			rules = {},
			colors = true,
			keys = {
				Up = " ",
				Down = " ",
				Left = " ",
				Right = " ",
				C = "󰘴 ",
				M = "󰘵 ",
				D = "󰘳 ",
				S = "󰘶 ",
				CR = "󰌑 ",
				Esc = "󱊷 ",
				ScrollWheelDown = "󱕐 ",
				ScrollWheelUp = "󱕑 ",
				NL = "󰌑 ",
				BS = "󰁮",
				Space = "󱁐 ",
				Tab = "󰌒 ",
				F1 = "󱊫",
				F2 = "󱊬",
				F3 = "󱊭",
				F4 = "󱊮",
				F5 = "󱊯",
				F6 = "󱊰",
				F7 = "󱊱",
				F8 = "󱊲",
				F9 = "󱊳",
				F10 = "󱊴",
				F11 = "󱊵",
				F12 = "󱊶",
			},
		},

		-- Window settings
		win = {
			border = "rounded",
			padding = { 1, 2 },
			title = true,
			title_pos = "center",
			zindex = 1000,
		},

		-- Layout settings
		layout = {
			width = { min = 20, max = 50 },
			spacing = 3,
		},
	},

	config = function(_, opts)
		local wk = require("which-key")
		wk.setup(opts)

		-- Register leader key groups with descriptions
		wk.add({
			-- Buffer management
			{ "<leader>b", group = "[B]uffer" },
			{ "<leader>bn", desc = "Next buffer" },
			{ "<leader>bp", desc = "Previous buffer" },

			-- Code/LSP actions (when LSP is attached)
			{ "<leader>c", group = "[C]ode" },
			{ "<leader>ca", desc = "Code actions" },
			{ "<leader>cd", desc = "Go to definition" },
			{ "<leader>cD", desc = "Go to declaration" },
			{ "<leader>cf", desc = "Format buffer" },
			{ "<leader>ch", desc = "Clear highlight" },
			{ "<leader>ci", desc = "Go to implementation" },
			{ "<leader>cn", desc = "Rename symbol" },
			{ "<leader>cr", desc = "Find references" },
			{ "<leader>ct", desc = "Go to type definition" },

			-- Diagnostics
			{ "<leader>e", desc = "Open diagnostic float" },
			{ "<leader>q", desc = "Open diagnostics list" },

			-- Fuzzy finder (Telescope)
			{ "<leader>f", group = "[F]ind" },
			{ "<leader>fb", desc = "Find buffers" },
			{ "<leader>ff", desc = "Find files" },
			{ "<leader>fg", desc = "Live grep" },
			{ "<leader>fh", desc = "Help tags" },
			{ "<leader>fr", desc = "LSP references" },
			{ "<leader>fs", desc = "LSP document symbols" },
			{ "<leader>fw", desc = "Grep word under cursor" },

			-- Git hunks (when in git repo)
			{ "<leader>h", group = "Git [H]unk" },
			{ "<leader>hb", desc = "Blame line" },
			{ "<leader>hd", desc = "Diff this" },
			{ "<leader>hD", desc = "Diff this ~" },
			{ "<leader>hp", desc = "Preview hunk" },
			{ "<leader>hr", desc = "Reset hunk" },
			{ "<leader>hR", desc = "Reset buffer" },
			{ "<leader>hs", desc = "Stage hunk" },
			{ "<leader>hS", desc = "Stage buffer" },
			{ "<leader>hu", desc = "Undo stage hunk" },

			-- Toggles
			{ "<leader>t", group = "[T]oggle" },
			{ "<leader>tb", desc = "Toggle line blame" },
			{ "<leader>td", desc = "Toggle deleted" },

			-- Workspace (LSP)
			{ "<leader>w", group = "[W]orkspace" },
			{ "<leader>wa", desc = "Add workspace folder" },
			{ "<leader>wl", desc = "List workspace folders" },
			{ "<leader>wr", desc = "Remove workspace folder" },

			-- Standalone mappings
			{ "<leader>C", desc = "Close current buffer" },
			{ "<leader><tab>", desc = "Switch to last buffer" },
			{ "<leader>-", desc = "Open file explorer" },
		})
	end,
}
