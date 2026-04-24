local function resolve_file_from_neogit()
	local ok, status_mod = pcall(require, "neogit.buffers.status")
	if not ok then return nil end
	local instance = status_mod.instance and status_mod.instance()
	if not instance or not instance.buffer or not instance.buffer.ui then return nil end
	local item = instance.buffer.ui:get_item_under_cursor()
	if not item then return nil end
	return item.absolute_path or item.name or (item.escaped_path and item.escaped_path())
end

local function open_inline_diff_for_cfile()
	local file = resolve_file_from_neogit()
	if not file or file == "" then
		vim.notify("No file under cursor", vim.log.levels.WARN)
		return
	end

	local git_root = vim.fn.systemlist({ "git", "rev-parse", "--show-toplevel" })[1]
	if vim.v.shell_error ~= 0 or not git_root then
		vim.notify("Not in a git repo", vim.log.levels.ERROR)
		return
	end

	local rel = vim.fn.fnamemodify(file, ":." )
	if vim.fn.fnamemodify(file, ":p"):sub(1, #git_root) == git_root then
		rel = vim.fn.fnamemodify(file, ":p"):sub(#git_root + 2)
	end

	local diff = vim.fn.systemlist({ "git", "-C", git_root, "diff", "HEAD", "--", rel })
	if #diff == 0 then
		diff = vim.fn.systemlist({ "git", "-C", git_root, "diff", "--no-index", "--", "/dev/null", rel })
	end
	if #diff == 0 then
		vim.notify("No changes for " .. rel, vim.log.levels.INFO)
		return
	end

	for _, win in ipairs(vim.api.nvim_list_wins()) do
		local b = vim.api.nvim_win_get_buf(win)
		if vim.api.nvim_buf_get_name(b):match("inline%-diff:") then
			pcall(vim.api.nvim_win_close, win, true)
		end
	end

	local height = math.floor(vim.o.lines * 0.7)
	vim.cmd("topleft " .. height .. "split")
	local buf = vim.api.nvim_create_buf(false, true)
	vim.api.nvim_win_set_buf(0, buf)
	vim.api.nvim_buf_set_lines(buf, 0, -1, false, diff)
	vim.bo[buf].filetype = "diff"
	vim.bo[buf].buftype = "nofile"
	vim.bo[buf].bufhidden = "wipe"
	vim.bo[buf].modifiable = false
	pcall(vim.api.nvim_buf_set_name, buf, "inline-diff: " .. rel)
	vim.wo.wrap = false
	vim.wo.cursorline = true
	local kopts = { buffer = buf, silent = true, nowait = true }
	vim.keymap.set("n", "q", "<cmd>close<CR>", kopts)
	vim.keymap.set("n", "<A-j>", "<C-w>j", kopts)
	vim.keymap.set("n", "<A-k>", "<C-w>k", kopts)
	vim.keymap.set("n", "<A-h>", "<C-w>h", kopts)
	vim.keymap.set("n", "<A-l>", "<C-w>l", kopts)
	vim.keymap.set("n", "<Tab>", "<C-w>w", kopts)
end

vim.api.nvim_create_autocmd("FileType", {
	pattern = "NeogitStatus",
	callback = function(args)
		local kopts = { buffer = args.buf, silent = true, nowait = true }
		vim.keymap.set("n", "<A-j>", "<C-w>j", kopts)
		vim.keymap.set("n", "<A-k>", "<C-w>k", kopts)
		vim.keymap.set("n", "<A-h>", "<C-w>h", kopts)
		vim.keymap.set("n", "<A-l>", "<C-w>l", kopts)
		vim.keymap.set("n", "o", "<C-w>w", kopts)
	end,
})

return {
	{
		"NeogitOrg/neogit",
		dependencies = {
			"nvim-lua/plenary.nvim",
			"sindrets/diffview.nvim",
		},
		cmd = { "Neogit" },
		keys = {
			{ "<leader>gg", "<cmd>Neogit kind=replace<CR>", desc = "Git status (inline)" },
			{ "<leader>gd", "<cmd>DiffviewOpen<CR>", desc = "Git diff (side-by-side)" },
			{ "<leader>gq", "<cmd>DiffviewClose<CR>", desc = "Close Diffview" },
			{ "<leader>gh", "<cmd>DiffviewFileHistory %<CR>", desc = "File history (current)" },
			{ "<leader>gH", "<cmd>DiffviewFileHistory<CR>", desc = "File history (branch)" },
		},
		opts = {
			kind = "replace",
			disable_hint = false,
			disable_commit_confirmation = true,
			auto_refresh = true,
			graph_style = "unicode",
			status = {
				recent_commit_count = 10,
			},
			integrations = {
				diffview = true,
			},
			sections = {
				untracked = { folded = false, hidden = false },
				unstaged = { folded = false, hidden = false },
				staged = { folded = false, hidden = false },
				stashes = { folded = true, hidden = false },
				unpulled_upstream = { folded = true, hidden = false },
				unmerged_upstream = { folded = false, hidden = false },
				recent = { folded = true, hidden = false },
			},
			mappings = {
				status = {
					["<tab>"] = "Toggle",
					["<cr>"] = open_inline_diff_for_cfile,
					["s"] = "Stage",
					["S"] = "StageUnstaged",
					["u"] = "Unstage",
					["U"] = "UnstageStaged",
					["x"] = "Discard",
					["q"] = "Close",
					["]c"] = "GoToNextHunkHeader",
					["[c"] = "GoToPreviousHunkHeader",
					["e"] = "GoToFile",
				},
			},
		},
	},

	{
		"sindrets/diffview.nvim",
		dependencies = { "nvim-lua/plenary.nvim" },
		cmd = { "DiffviewOpen", "DiffviewClose", "DiffviewToggleFiles", "DiffviewFocusFiles", "DiffviewFileHistory" },
		opts = {
			enhanced_diff_hl = true,
			use_icons = true,
			show_help_hints = false,
			view = {
				default = { layout = "diff2_horizontal", winbar_info = true },
				file_history = { layout = "diff2_horizontal", winbar_info = true },
			},
			file_panel = {
				listing_style = "list",
				win_config = { position = "bottom", height = 12 },
			},
			file_history_panel = {
				win_config = { position = "bottom", height = 14 },
			},
			hooks = {
				diff_buf_read = function()
					vim.opt_local.wrap = false
					vim.opt_local.cursorline = true
				end,
			},
			keymaps = {
				file_panel = {
					{ "n", "<Tab>", "<Cmd>DiffviewToggleFiles<CR>", { desc = "Toggle file panel" } },
					{ "n", "q", "<Cmd>DiffviewClose<CR>", { desc = "Close Diffview" } },
				},
				view = {
					{ "n", "q", "<Cmd>DiffviewClose<CR>", { desc = "Close Diffview" } },
					{ "n", "<Tab>", "<Cmd>DiffviewToggleFiles<CR>", { desc = "Toggle file panel" } },
				},
				file_history_panel = {
					{ "n", "<Tab>", "<Cmd>DiffviewToggleFiles<CR>", { desc = "Toggle file panel" } },
					{ "n", "q", "<Cmd>DiffviewClose<CR>", { desc = "Close Diffview" } },
				},
			},
		},
	},

	{
		"lewis6991/gitsigns.nvim",
		event = { "BufReadPre", "BufNewFile" },
		opts = {
			signs = {
				add = { text = "┃" },
				change = { text = "┃" },
				delete = { text = "" },
				topdelete = { text = "" },
				changedelete = { text = "~" },
				untracked = { text = "┆" },
			},
			on_attach = function(bufnr)
				local gs = require("gitsigns")
				local map = function(mode, lhs, rhs, desc)
					vim.keymap.set(mode, lhs, rhs, { buffer = bufnr, desc = desc })
				end

				map("n", "]c", function()
					if vim.wo.diff then return "]c" end
					vim.schedule(gs.next_hunk)
					return "<Ignore>"
				end, "Next hunk")
				map("n", "[c", function()
					if vim.wo.diff then return "[c" end
					vim.schedule(gs.prev_hunk)
					return "<Ignore>"
				end, "Prev hunk")

				map("n", "<leader>gv", gs.preview_hunk, "Preview hunk")
				map("n", "<leader>gb", function() gs.blame_line({ full = true }) end, "Blame line")
				map("n", "<leader>gB", gs.toggle_current_line_blame, "Toggle line blame")
				map({ "o", "x" }, "ih", ":<C-U>Gitsigns select_hunk<CR>", "Select hunk")
			end,
		},
	},
}
