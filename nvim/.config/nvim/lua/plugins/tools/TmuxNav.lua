return {
      "christoomey/vim-tmux-navigator",
      lazy = false,
      cmd = {
            "TmuxNavigateLeft",
            "TmuxNavigateDown",
            "TmuxNavigateUp",
            "TmuxNavigateRight",
      },
      keys = {
            { "<a-h>", "<cmd>TmuxNavigateLeft<cr>",  { silent = true, desc = "navigate left"  } },
            { "<a-j>", "<cmd>TmuxNavigateDown<cr>",  { silent = true, desc = "navigate down"  } },
            { "<a-k>", "<cmd>TmuxNavigateUp<cr>",    { silent = true, desc = "navigate up"    } },
            { "<a-l>", "<cmd>TmuxNavigateRight<cr>", { silent = true, desc = "navigate right" } },
      },
}
