return {
	"nvim-telescope/telescope.nvim",
	branch = "0.1.x",
	dependencies = {
		"nvim-lua/plenary.nvim",
		{
			"nvim-telescope/telescope-fzf-native.nvim",
			build = "make",
		},
	},

	config = function()
		local telescope = require("telescope")
		local actions = require("telescope.actions")
		local builtin = require("telescope.builtin")

		local layout = { width = 0.87, preview_width = 0.55 }

		telescope.setup({
			defaults = {
				sorting_strategy = "ascending",
				layout_config = {
					horizontal = {
						prompt_position = "top",
						preview_width = layout.preview_width,
					},
					width = layout.width,
					height = 0.80,
				},
				mappings = {
					i = {
						["<C-j>"] = actions.move_selection_next,
						["<C-k>"] = actions.move_selection_previous,
						["<C-q>"] = actions.send_selected_to_qflist + actions.open_qflist,
						["<Esc>"] = function()
							vim.cmd("stopinsert")
						end,
					},
				},
				file_ignore_patterns = { "node_modules", ".git/", "%.lock" },
			},
			pickers = {
				find_files = { hidden = true },
				live_grep = { additional_args = { "--hidden" } },
			},
		})

		telescope.load_extension("fzf")

		-- SymbolKind reverse mapping (number -> name)
		local kind_name = {}
		for name, num in pairs(vim.lsp.protocol.SymbolKind) do
			if type(num) == "number" then kind_name[num] = name end
		end

		-- Sort priority: lower = first
		local kind_order = {
			Function = 1, Method = 2, Constructor = 3,
			Class = 4, Struct = 5, Interface = 6,
			Enum = 7, EnumMember = 8, Constant = 9,
			Variable = 10, Field = 11, Property = 12,
			Module = 13, Namespace = 14, Package = 15,
		}

		-- Highlight group per symbol kind
		local kind_hl = {
			Function = "TelescopeResultsFunction",
			Method = "TelescopeResultsMethod",
			Constructor = "TelescopeResultsFunction",
			Class = "TelescopeResultsClass",
			Struct = "TelescopeResultsStruct",
			Interface = "TelescopeResultsClass",
			Enum = "TelescopeResultsClass",
			EnumMember = "TelescopeResultsConstant",
			Constant = "TelescopeResultsConstant",
			Variable = "TelescopeResultsVariable",
			Field = "TelescopeResultsField",
			Property = "TelescopeResultsField",
			Module = "TelescopeResultsClass",
			Namespace = "TelescopeResultsClass",
		}

		local map = vim.keymap.set

		-- Buffers
		map("n", "<leader><space>", function()
			builtin.buffers({ sort_mru = true })
		end, { desc = "Buffers (MRU)" })
		map("n", "<leader>C", "<cmd>bdelete<CR>", { desc = "Close buffer" })

		-- Find
		map("n", "<leader>ff", builtin.find_files, { desc = "Files" })
		map("n", "<leader>fg", builtin.live_grep, { desc = "Grep" })
		map("n", "<leader>fw", builtin.grep_string, { desc = "Word under cursor" })
		map("n", "<leader>fh", builtin.help_tags, { desc = "Help" })
		map("n", "<leader>fr", builtin.oldfiles, { desc = "Recent files" })
		map("n", "<leader>fd", builtin.diagnostics, { desc = "Diagnostics" })
		map("n", "<leader>f/", builtin.current_buffer_fuzzy_find, { desc = "Fuzzy in buffer" })

		-- Document symbols (custom picker: sorted by kind then position)
		map("n", "<leader>fs", function()
			local params = { textDocument = vim.lsp.util.make_text_document_params() }
			vim.lsp.buf_request(0, "textDocument/documentSymbol", params, function(err, result)
				if err or not result or #result == 0 then return end

				local symbols = {}
				local function flatten(items, prefix)
					for _, item in ipairs(items) do
						local name = prefix and (prefix .. "." .. item.name) or item.name
						local kind = kind_name[item.kind] or "Unknown"
						table.insert(symbols, {
							name = name,
							kind = kind,
							priority = kind_order[kind] or 99,
							lnum = item.range.start.line + 1,
							col = item.range.start.character,
						})
						if item.children then flatten(item.children, name) end
					end
				end
				flatten(result, nil)

				table.sort(symbols, function(a, b)
					if a.priority ~= b.priority then return a.priority < b.priority end
					return a.lnum < b.lnum
				end)

				local conf = require("telescope.config").values
				local results_width = math.floor(vim.o.columns * layout.width * (1 - layout.preview_width)) - 10
				local filename = vim.api.nvim_buf_get_name(0)

				require("telescope.pickers").new({}, {
					prompt_title = "Document Symbols",
					finder = require("telescope.finders").new_table({
						results = symbols,
						entry_maker = function(entry)
							local hl = kind_hl[entry.kind] or "TelescopeResultsVariable"
							return {
								value = entry,
								display = function(e)
									local pad = math.max(1, results_width - #e.value.name - #e.value.kind)
									local text = e.value.name .. string.rep(" ", pad) .. e.value.kind
									return text, { { { #text - #e.value.kind, #text }, hl } }
								end,
								ordinal = entry.name .. " " .. entry.kind,
								filename = filename,
								lnum = entry.lnum,
								col = entry.col,
							}
						end,
					}),
					tiebreak = function(current, existing)
						return current.index < existing.index
					end,
					sorter = conf.generic_sorter({}),
					previewer = conf.grep_previewer({}),
				}):find()
			end)
		end, { desc = "Symbols" })
	end,
}
