SHELL := /usr/bin/env bash

# brew n'est pas dans le PATH du shell tant qu'un shellenv n'a pas été sourcé, et
# chaque recette make tourne dans son propre sous-shell : sans ça, brew-bundle et
# les post-hooks ne verraient pas le brew que brew-install vient d'installer.
# Ajouter les deux préfixes (Apple Silicon / Intel) au PATH exporté couvre le
# premier install sans relancer dans un nouveau shell — un dir absent est inerte.
export PATH := /opt/homebrew/bin:/usr/local/bin:$(PATH)

STOW := stow -t $(HOME)
PACKAGES := claude cmux colima docker gh ghostty git herdr homebrew languages nvim opencode pi rclone rectangle rp rtk starship zsh

# Packages dont le dossier cible reçoit aussi des fichiers écrits par l'outil
# (gh/hosts.yml, homebrew/trust.json.lock, …) : sans --no-folding Stow replierait
# le dossier entier en symlink et l'outil écrirait ses secrets dans le repo.
NOFOLD := gh git herdr homebrew rclone

# Obsidian : le vault vit dans iCloud, seule la config .obsidian est stowée
# (symlinks relatifs → portables entre machines). Les binaires (thème, plugins,
# fonts) ne sont pas versionnés : obsidian-post les installe.
OBSIDIAN_VAULT_DIR := $(HOME)/Library/Mobile Documents/iCloud~md~obsidian/Documents/Brain
OBSIDIAN_VAULT := $(OBSIDIAN_VAULT_DIR)/.obsidian
OBSIDIAN_PLUGIN_DATA := obsidian-style-settings obsidian-hider obsidian-icon-folder settings-search shiki-highlighter folder-notes

.PHONY: help bootstrap xcode-clt brew-install brew-bundle install all unstow restow $(PACKAGES) claude-post nvim-post pi-dirs pi-post rp-post rtk-post obsidian obsidian-save obsidian-post proxy-reset

help:
	@echo "Targets:"
	@echo "  bootstrap    Mac neuf, de zéro : Xcode CLT + Homebrew + brew bundle + install"
	@echo "  brew-bundle  Installe les paquets du Brewfile (formules + casks)"
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
	@echo "  proxy-reset    Retire le PAC proxy laissé par Zscaler (rétablit le relais Apple)"
	@echo ""
	@echo "Packages: $(PACKAGES)"

# Point d'entrée mac neuf : chaque étape est idempotente, la cible est rejouable.
# CLT et Homebrew posent les prérequis (git, compilateur, brew) avant tout stow.
bootstrap: xcode-clt brew-install brew-bundle install
	@echo "bootstrap terminé — ouvre un nouveau shell, puis lance 'pi' /login et rtk restart si besoin"

# xcode-select --install déclenche une pop-up GUI asynchrone et rend la main
# aussitôt ; on boucle jusqu'à ce que les CLT soient réellement présents.
xcode-clt:
	@if xcode-select -p >/dev/null 2>&1; then echo "Xcode CLT déjà présents"; else \
		echo "→ installation des Xcode Command Line Tools (valide la fenêtre qui s'ouvre)"; \
		xcode-select --install >/dev/null 2>&1 || true; \
		until xcode-select -p >/dev/null 2>&1; do printf '.'; sleep 5; done; \
		echo " CLT installés"; fi

# L'installeur Homebrew en NONINTERACTIVE vérifie sudo avec `sudo -n -v` et
# aborte sans timestamp en cache — `sudo -v` interactif juste avant le fournit.
brew-install:
	@if command -v brew >/dev/null; then echo "Homebrew déjà présent"; else \
		echo "→ installation de Homebrew (mot de passe sudo requis)"; \
		sudo -v; \
		NONINTERACTIVE=1 /bin/bash -c "$$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"; fi
	@command -v brew >/dev/null && echo "brew prêt: $$(brew --version | head -1)" \
		|| { echo "brew introuvable après install — vérifie le log Homebrew ci-dessus"; exit 1; }

brew-bundle:
	@command -v brew >/dev/null || { echo "brew introuvable — lance 'make brew-install' d'abord"; exit 1; }
	@echo "→ brew bundle (Brewfile)"
	@brew bundle --file=Brewfile

install all: $(PACKAGES) claude-post nvim-post pi-post rp-post rtk-post obsidian obsidian-post

unstow:
	@for pkg in $(PACKAGES); do $(STOW) -D $$pkg; done

restow:
	@for pkg in $(PACKAGES); do \
		if [[ " $(NOFOLD) " == *" $$pkg "* ]]; then $(STOW) --no-folding -R $$pkg; else $(STOW) -R $$pkg; fi; \
	done

$(PACKAGES):
	@if [[ " $(NOFOLD) " == *" $@ "* ]]; then $(STOW) --no-folding $@; else $(STOW) $@; fi

claude-post:
	@if ! command -v d2 >/dev/null; then \
		if command -v brew >/dev/null; then brew install d2; \
		else echo "d2 introuvable et brew indisponible — installe-le à la main (https://d2lang.com)"; fi; \
	fi
	@command -v d2 >/dev/null && echo "d2 prêt: le skill /html rend les blocs data-np=\"d2\" au build" \
		|| echo "d2 non installé — les blocs d2 feront échouer build.sh"
	@if command -v claude >/dev/null; then \
		claude plugin list 2>/dev/null | grep -q impeccable \
			|| { claude plugin marketplace add pbakaus/impeccable && claude plugin install impeccable@impeccable; }; \
		echo "plugin impeccable prêt (design craft — anti-slop)"; \
	else echo "claude introuvable — plugin impeccable non installé"; fi

nvim-post:
	@if ! command -v rg >/dev/null; then \
		if command -v brew >/dev/null; then brew install ripgrep; \
		else echo "ripgrep introuvable et brew indisponible — installe-le à la main (https://github.com/BurntSushi/ripgrep)"; fi; \
	fi
	@command -v rg >/dev/null && echo "ripgrep prêt: telescope live_grep/grep_string opérationnels" \
		|| echo "ripgrep non installé — telescope live_grep échouera"

# Sans ce dossier, stow replierait ~/.pi/agent en symlink vers le repo et pi y
# écrirait ses sessions et son auth.json. extensions/skills/themes sont des
# symlinks vers le repo : les nouveaux fichiers y sont versionnés d'office.
pi: | pi-dirs

pi-dirs:
	@mkdir -p "$(HOME)/.pi/agent/sessions"

# pnpm installé par brew est un script `#!/usr/bin/env node` et node arrive via
# fnm, pas via brew : sur un mac neuf on installe le LTS puis on lance pnpm au
# travers de `fnm exec`. FNM_DIR/PNPM_HOME reprennent zsh/.config/zsh/conf.d.
pi-post: export FNM_DIR := $(HOME)/.local/share/fnm
pi-post: export PNPM_HOME := $(HOME)/.local/share/pnpm
pi-post: export PATH := $(HOME)/.local/share/pnpm/bin:$(HOME)/.local/share/pnpm:$(PATH)
pi-post:
	@if ! command -v pi >/dev/null; then \
		if ! command -v pnpm >/dev/null; then echo "pnpm introuvable — installe pi à la main (https://pi.dev)"; \
		elif command -v node >/dev/null; then pnpm add -g @earendil-works/pi-coding-agent; \
		elif command -v fnm >/dev/null; then \
			echo "→ node LTS via fnm"; \
			fnm install --lts; \
			fnm exec --using lts-latest -- pnpm add -g @earendil-works/pi-coding-agent; \
		else echo "node et fnm introuvables — installe node puis relance make pi-post"; fi; \
	fi
	@command -v pi >/dev/null && echo "pi prêt — \`pi\` puis /login pour l'auth" \
		|| echo "pi non installé — étape ignorée"

rp-post:
	@command -v node >/dev/null || command -v fnm >/dev/null \
		|| { echo "node not found — install it (fnm install --lts) so 'rp' can serve plan.html"; exit 0; }
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
		folder-notes=LostPaul/obsidian-folder-notes \
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

# Zscaler pose son PAC (127.0.0.1:9000/systemproxy-*.pac) sur tous les services
# réseau et le laisse en place même arrêté ; macOS coupe alors le relais de
# confidentialité Apple et Mail ne charge plus le contenu distant de façon privée.
proxy-reset:
	@if pgrep -i zscaler >/dev/null; then \
		echo "Zscaler tourne — quitte-le d'abord, il repose son PAC au lancement"; exit 1; fi
	@networksetup -listallnetworkservices | tail -n +2 | sed 's/^\*//' | while IFS= read -r svc; do \
		url=$$(networksetup -getautoproxyurl "$$svc" 2>/dev/null | awk '/^URL:/ {print $$2}'); \
		case "$$url" in \
			*systemproxy-*.pac|*127.0.0.1:9000*) \
				networksetup -setautoproxystate "$$svc" off && echo "PAC retiré : $$svc" ;; \
		esac; \
	done
	@scutil --proxy | grep -q 'ProxyAutoConfigEnable : 0' \
		&& echo "aucun PAC actif — relais Apple opérationnel" \
		|| echo "un PAC reste actif (Réglages > Réseau > Proxies)"
