SHELL := /usr/bin/env bash
STOW := stow -t $(HOME)
PACKAGES := claude cmux colima docker ghostty languages nvim opencode rectangle starship zsh

.PHONY: help install all unstow restow $(PACKAGES) claude-post

help:
	@echo "Targets:"
	@echo "  install      Stow every package and run all post-install hooks"
	@echo "  all          Alias of install"
	@echo "  unstow       Unstow every package"
	@echo "  restow       Restow every package (-R)"
	@echo "  <package>    Stow a single package (e.g. make claude)"
	@echo ""
	@echo "Packages: $(PACKAGES)"

install all: $(PACKAGES) claude-post

unstow:
	@for pkg in $(PACKAGES); do $(STOW) -D $$pkg; done

restow:
	@for pkg in $(PACKAGES); do $(STOW) -R $$pkg; done

$(PACKAGES):
	$(STOW) $@

claude-post:
	@command -v claude >/dev/null || { echo "claude CLI not found, skipping MCP setup"; exit 0; }
	@claude mcp add context7 -s user -- npx -y @upstash/context7-mcp@latest 2>/dev/null || echo "context7 already registered"
