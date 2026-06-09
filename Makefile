SHELL := /usr/bin/env bash
STOW := stow -t $(HOME)
PACKAGES := claude cmux colima docker ghostty languages nvim opencode rectangle rp starship zsh

.PHONY: help install all unstow restow $(PACKAGES) claude-post rp-post

help:
	@echo "Targets:"
	@echo "  install      Stow every package and run all post-install hooks"
	@echo "  all          Alias of install"
	@echo "  unstow       Unstow every package"
	@echo "  restow       Restow every package (-R)"
	@echo "  <package>    Stow a single package (e.g. make claude)"
	@echo ""
	@echo "Packages: $(PACKAGES)"

install all: $(PACKAGES) claude-post rp-post

unstow:
	@for pkg in $(PACKAGES); do $(STOW) -D $$pkg; done

restow:
	@for pkg in $(PACKAGES); do $(STOW) -R $$pkg; done

$(PACKAGES):
	$(STOW) $@

claude-post:
	@command -v claude >/dev/null || { echo "claude CLI not found, skipping MCP setup"; exit 0; }
	@claude mcp add context7 -s user -- npx -y @upstash/context7-mcp@latest 2>/dev/null || echo "context7 already registered"
	@claude plugin marketplace add pbakaus/impeccable 2>/dev/null || echo "impeccable marketplace already added"
	@claude plugin list 2>/dev/null | grep -q impeccable || claude plugin install impeccable@impeccable
	@command -v jq >/dev/null || { echo "jq not found - skipping react-ts-gate hook merge"; exit 0; }
	@S="$$HOME/.claude/settings.json"; [ -f "$$S" ] || cp claude/.claude/settings.json "$$S"; \
		tmp="$$(mktemp)"; \
		jq --arg pre "sh ~/.claude/hooks/react-ts-gate.sh pre" --arg post "sh ~/.claude/hooks/react-ts-gate.sh post" \
		'def ensure($$evt; $$cmd): .hooks[$$evt] = ((.hooks[$$evt] // []) as $$arr | if any($$arr[]?; (.matcher=="Edit|Write") and any((.hooks//[])[]?; (.command//"")|test("react-ts-gate"))) then $$arr else $$arr + [{matcher:"Edit|Write", hooks:[{type:"command", command:$$cmd}]}] end); ensure("PreToolUse"; $$pre) | ensure("PostToolUse"; $$post)' \
		"$$S" > "$$tmp" && mv "$$tmp" "$$S" && echo "react-ts-gate hook ensured in $$S" || { echo "hook merge failed - is $$S valid JSON?"; rm -f "$$tmp"; }

rp-post:
	@command -v node >/dev/null || { echo "node not found — install it (fnm install --lts) so 'rp' can serve plan.html"; exit 0; }
	@echo "rp ready: \`rp <slug>\` will serve plan.html and wait for /submit"
