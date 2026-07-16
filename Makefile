SHELL := /usr/bin/env bash
STOW := stow -t $(HOME)
PACKAGES := claude cmux colima docker ghostty languages nvim opencode rectangle rp rtk starship zsh

# Obsidian : le vault vit dans iCloud, seule la config .obsidian est stowée
# (symlinks relatifs → portables entre machines). Les binaires (thème, plugins,
# fonts) ne sont pas versionnés : obsidian-post les installe.
OBSIDIAN_VAULT_DIR := $(HOME)/Library/Mobile Documents/iCloud~md~obsidian/Documents/Brain
OBSIDIAN_VAULT := $(OBSIDIAN_VAULT_DIR)/.obsidian
OBSIDIAN_PLUGIN_DATA := obsidian-style-settings obsidian-hider obsidian-icon-folder settings-search shiki-highlighter

.PHONY: help install all unstow restow $(PACKAGES) claude-post nvim-post rp-post rtk-post obsidian obsidian-save obsidian-post

help:
	@echo "Targets:"
	@echo "  install      Stow every package and run all post-install hooks"
	@echo "  all          Alias of install"
	@echo "  unstow       Unstow every package"
	@echo "  restow       Restow every package (-R)"
	@echo "  <package>    Stow a single package (e.g. make nvim)"
	@echo ""
	@echo "  obsidian       Stow la config versionnée dans le vault Brain (iCloud)"
	@echo "  obsidian-save  Ré-adopte (--adopt) les fichiers qu'Obsidian a dé-symlinkés"
	@echo "  obsidian-post  Installe thème AnuPpuccin, plugins communautaires et fonts"
	@echo ""
	@echo "Packages: $(PACKAGES)"

install all: $(PACKAGES) claude-post nvim-post rp-post rtk-post obsidian obsidian-post

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

nvim-post:
	@if ! command -v rg >/dev/null; then \
		if command -v brew >/dev/null; then brew install ripgrep; \
		else echo "ripgrep introuvable et brew indisponible — installe-le à la main (https://github.com/BurntSushi/ripgrep)"; fi; \
	fi
	@command -v rg >/dev/null && echo "ripgrep prêt: telescope live_grep/grep_string opérationnels" \
		|| echo "ripgrep non installé — telescope live_grep échouera"

rp-post:
	@command -v node >/dev/null || { echo "node not found — install it (fnm install --lts) so 'rp' can serve plan.html"; exit 0; }
	@echo "rp ready: \`rp <slug>\` will serve plan.html and wait for /submit"

obsidian:
	@for id in $(OBSIDIAN_PLUGIN_DATA); do mkdir -p "$(OBSIDIAN_VAULT)/plugins/$$id"; done
	@stow -d obsidian -t "$(OBSIDIAN_VAULT_DIR)" -R Brain
	@echo "config Obsidian stowée (symlinks) dans le vault Brain"

obsidian-save:
	@stow -d obsidian -t "$(OBSIDIAN_VAULT_DIR)" --adopt -R Brain
	@echo "fichiers dé-symlinkés par Obsidian ré-adoptés dans le repo — vérifie git diff avant commit"

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
		shiki-highlighter=mprojectscode/obsidian-shiki-plugin \
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
