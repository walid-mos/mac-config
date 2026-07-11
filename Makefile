SHELL := /usr/bin/env bash
STOW := stow -t $(HOME)
PACKAGES := claude cmux colima docker ghostty languages nvim opencode rectangle rp rtk starship zsh

# Obsidian : le vault vit dans iCloud (symlinks Stow peu fiables là-bas),
# la config est donc copiée par make, pas stowée.
OBSIDIAN_VAULT := $(HOME)/Library/Mobile Documents/iCloud~md~obsidian/Documents/Brain/.obsidian
OBSIDIAN_PKG := obsidian/Brain/.obsidian
OBSIDIAN_CONF := app.json appearance.json core-plugins.json community-plugins.json graph.json
OBSIDIAN_PLUGIN_DATA := obsidian-style-settings obsidian-hider obsidian-icon-folder settings-search

.PHONY: help install all unstow restow $(PACKAGES) claude-post rp-post rtk-post obsidian obsidian-save obsidian-post

help:
	@echo "Targets:"
	@echo "  install      Stow every package and run all post-install hooks"
	@echo "  all          Alias of install"
	@echo "  unstow       Unstow every package"
	@echo "  restow       Restow every package (-R)"
	@echo "  <package>    Stow a single package (e.g. make nvim)"
	@echo ""
	@echo "  obsidian       Pousse la config versionnée vers le vault Brain (iCloud)"
	@echo "  obsidian-save  Rapatrie la config du vault dans le repo (avant commit)"
	@echo "  obsidian-post  Installe thème AnuPpuccin, plugins communautaires et fonts"
	@echo ""
	@echo "Packages: $(PACKAGES)"

install all: $(PACKAGES) claude-post rp-post rtk-post obsidian obsidian-post

unstow:
	@for pkg in $(PACKAGES); do $(STOW) -D $$pkg; done

restow:
	@for pkg in $(PACKAGES); do $(STOW) -R $$pkg; done

$(PACKAGES):
	$(STOW) $@

claude-post:
	@if ! command -v d2 >/dev/null; then \
		if command -v brew >/dev/null; then brew install d2; \
		else echo "d2 introuvable et brew indisponible — installe-le à la main (https://d2lang.com)"; fi; \
	fi
	@command -v d2 >/dev/null && echo "d2 prêt: le skill /html rend les blocs data-np=\"d2\" au build" \
		|| echo "d2 non installé — les blocs d2 feront échouer build.sh"

rp-post:
	@command -v node >/dev/null || { echo "node not found — install it (fnm install --lts) so 'rp' can serve plan.html"; exit 0; }
	@echo "rp ready: \`rp <slug>\` will serve plan.html and wait for /submit"

obsidian:
	@mkdir -p "$(OBSIDIAN_VAULT)/snippets"
	@for f in $(OBSIDIAN_CONF); do cp "$(OBSIDIAN_PKG)/$$f" "$(OBSIDIAN_VAULT)/$$f"; done
	@rsync -a --delete "$(OBSIDIAN_PKG)/snippets/" "$(OBSIDIAN_VAULT)/snippets/"
	@for id in $(OBSIDIAN_PLUGIN_DATA); do \
		if [ -f "$(OBSIDIAN_PKG)/plugins/$$id/data.json" ]; then \
			mkdir -p "$(OBSIDIAN_VAULT)/plugins/$$id"; \
			cp "$(OBSIDIAN_PKG)/plugins/$$id/data.json" "$(OBSIDIAN_VAULT)/plugins/$$id/data.json"; \
		fi; \
	done
	@echo "config Obsidian poussée vers le vault Brain"

obsidian-save:
	@for f in $(OBSIDIAN_CONF); do cp "$(OBSIDIAN_VAULT)/$$f" "$(OBSIDIAN_PKG)/$$f" 2>/dev/null || true; done
	@rsync -a --delete "$(OBSIDIAN_VAULT)/snippets/" "$(OBSIDIAN_PKG)/snippets/"
	@for id in $(OBSIDIAN_PLUGIN_DATA); do \
		if [ -f "$(OBSIDIAN_VAULT)/plugins/$$id/data.json" ]; then \
			mkdir -p "$(OBSIDIAN_PKG)/plugins/$$id"; \
			cp "$(OBSIDIAN_VAULT)/plugins/$$id/data.json" "$(OBSIDIAN_PKG)/plugins/$$id/data.json"; \
		fi; \
	done
	@echo "config du vault rapatriée dans le repo — pense à committer"

obsidian-post:
	@mkdir -p "$(OBSIDIAN_VAULT)/themes/AnuPpuccin" "$(OBSIDIAN_VAULT)/plugins"
	@echo "→ thème AnuPpuccin"
	@curl -fsSL -o "$(OBSIDIAN_VAULT)/themes/AnuPpuccin/theme.css" https://github.com/AnubisNekhet/AnuPpuccin/releases/latest/download/theme.css
	@curl -fsSL -o "$(OBSIDIAN_VAULT)/themes/AnuPpuccin/manifest.json" https://github.com/AnubisNekhet/AnuPpuccin/releases/latest/download/manifest.json
	@for spec in \
		obsidian-style-settings=obsidian-community/obsidian-style-settings \
		obsidian-hider=kepano/obsidian-hider \
		obsidian-icon-folder=florianwoelki/obsidian-iconize \
		settings-search=javalent/settings-search \
	; do \
		id=$${spec%%=*}; repo=$${spec#*=}; dir="$(OBSIDIAN_VAULT)/plugins/$$id"; \
		echo "→ plugin $$id"; mkdir -p "$$dir"; \
		curl -fsSL -o "$$dir/main.js" "https://github.com/$$repo/releases/latest/download/main.js" || { echo "échec $$id/main.js"; exit 1; }; \
		curl -fsSL -o "$$dir/manifest.json" "https://github.com/$$repo/releases/latest/download/manifest.json" || { echo "échec $$id/manifest.json"; exit 1; }; \
		curl -fsSL -o "$$dir/styles.css" "https://github.com/$$repo/releases/latest/download/styles.css" || rm -f "$$dir/styles.css"; \
	done
	@if command -v brew >/dev/null; then \
		brew list --cask font-ia-writer-quattro >/dev/null 2>&1 || brew install --cask font-ia-writer-quattro; \
		brew list --cask font-inter >/dev/null 2>&1 || brew install --cask font-inter; \
	else echo "brew indisponible — installe les fonts iA Writer Quattro et Inter à la main"; fi
	@echo "thème + plugins prêts — au premier lancement par machine : Settings → Community plugins → désactiver Restricted mode"

rtk-post:
	@if ! command -v rtk >/dev/null; then \
		if command -v brew >/dev/null; then brew install rtk; \
		else echo "rtk introuvable et brew indisponible — installe rtk à la main (https://github.com/rtk-ai/rtk)"; fi; \
	fi
	@command -v rtk >/dev/null && rtk init -g --auto-patch >/dev/null \
		&& echo "rtk prêt: hook posé dans ~/.claude — redémarre Claude Code pour l'activer" \
		|| echo "rtk non installé — étape ignorée"
