SHELL := /usr/bin/env bash
STOW := stow -t $(HOME)
PACKAGES := cmux colima docker ghostty languages nvim opencode rectangle rp starship zsh

.PHONY: help install all unstow restow $(PACKAGES) rp-post

help:
	@echo "Targets:"
	@echo "  install      Stow every package and run all post-install hooks"
	@echo "  all          Alias of install"
	@echo "  unstow       Unstow every package"
	@echo "  restow       Restow every package (-R)"
	@echo "  <package>    Stow a single package (e.g. make nvim)"
	@echo ""
	@echo "Packages: $(PACKAGES)"

install all: $(PACKAGES) rp-post

unstow:
	@for pkg in $(PACKAGES); do $(STOW) -D $$pkg; done

restow:
	@for pkg in $(PACKAGES); do $(STOW) -R $$pkg; done

$(PACKAGES):
	$(STOW) $@

rp-post:
	@command -v node >/dev/null || { echo "node not found — install it (fnm install --lts) so 'rp' can serve plan.html"; exit 0; }
	@echo "rp ready: \`rp <slug>\` will serve plan.html and wait for /submit"
