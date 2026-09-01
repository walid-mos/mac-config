SHELL := /usr/bin/env bash

# brew n'est pas dans le PATH du shell tant qu'un shellenv n'a pas été sourcé, et
# chaque recette make tourne dans son propre sous-shell : sans ça, brew-bundle et
# les post-hooks ne verraient pas le brew que brew-install vient d'installer.
# Ajouter les deux préfixes (Apple Silicon / Intel) au PATH exporté couvre le
# premier install sans relancer dans un nouveau shell — un dir absent est inerte.
export PATH := /opt/homebrew/bin:/usr/local/bin:$(PATH)

STOW := stow -t $(HOME)

# Chaque dossier à la racine du repo est un package Stow — ajouter un dossier
# suffit à le rendre stowable. NONSTOW liste les seules exceptions : obsidian
# (cible custom iCloud, stowé par sa propre cible), scripts (outillage git
# interne) et claude (package conservé, non déployé).
NONSTOW := obsidian scripts claude
PACKAGES := $(filter-out $(NONSTOW),$(patsubst %/,%,$(wildcard */)))

# Packages dont le dossier cible reçoit aussi des fichiers écrits par l'outil
# (gh/hosts.yml, pi/auth.json + sessions, colima/_lima, docker/buildx +
# contexts, rtk/history.db, git/credentials via credential-store XDG,
# languages/.local/bin partagé avec pnpm/fnm) : --no-folding garde le dossier
# cible réel (jamais un symlink unique vers le package). Seuls les fichiers déjà
# présents dans le package sont liés ; un fichier créé ensuite reste local et
# n'entre dans le repo que s'il est ajouté explicitement au package puis restow.
# Sans --no-folding, Stow replierait le dossier entier et l'outil écrirait ses
# secrets/runtime dans le repo (puis un unstow les casserait). hermes écrit ses
# sessions, sa mémoire et ~/.hermes/.env (secrets) hors repo.
NOFOLD := colima docker gh git herdr hermes homebrew languages rclone rtk

# Hooks post-install chaînés par `make install` (cible <nom>-post ; rust et 
# n'ont pas de package Stow — rustup gère ~/.rustup/~/.cargo).
POSTS :=  dev-dirs gh herdr hermes nvim pi rtk rust


# Obsidian : le vault vit dans iCloud, seule la config .obsidian est stowée
# (symlinks relatifs → portables entre machines). Les binaires (thème,
# plugins) vivent en fichiers réels dans le vault : iCloud les synchronise et
# Obsidian réinstalle nativement les plugins manquants au premier lancement.
# Les fonts système sont dans le Brewfile.
OBSIDIAN_VAULT_DIR := $(HOME)/Library/Mobile Documents/iCloud~md~obsidian/Documents/Brain
OBSIDIAN_VAULT := $(OBSIDIAN_VAULT_DIR)/.obsidian

.PHONY: help bootstrap xcode-clt brew-install brew-bundle install all unstow restow $(PACKAGES) $(addsuffix -post,$(POSTS)) pi-dirs pi-update pi-test  pi-notify-test pi-ui-test  notifier-app notifier-app-test herdr-pi-smoke hermes-dirs hermes-gemma obsidian obsidian-save proxy-reset dev-dirs git-filters

help:
	@echo "Targets:"
	@echo "  bootstrap    Mac neuf, de zéro : Xcode CLT + Homebrew + brew bundle + install"
	@echo "  brew-bundle  Installe les paquets du Brewfile (formules + casks)"
	@echo "  install      Stow every package and run all post-install hooks"
	@echo "  all          Alias of install"
	@echo "  unstow       Unstow every package"
	@echo "  restow       Restow every package"
	@echo "  <package>    (Re)stow a single package (e.g. make nvim)"
	@echo ""
	@echo "  obsidian       Stow la config versionnée dans le vault Brain (iCloud)"
	@echo "  obsidian-save  Ré-adopte (--adopt) les fichiers qu'Obsidian a dé-symlinkés"
	@echo "  dev-dirs       Scaffolde ~/Development/{clients,tools,nextnode} (idempotent)"
	@echo "  git-filters    Configure les clean filters git (.gitattributes) dans .git/config"
	@echo ""
	@echo "  proxy-reset    Retire le PAC proxy laissé par Zscaler (rétablit le relais Apple)"
	@echo "  pi-update      Met à jour Pi et tous ses packages"
	@echo "  pi-test        Gate complète : extensions Pi, Stow et démarrage réel"
	@echo "  pi-notify-test Tests comportementaux isolés de l'extension de notifications"
	@echo "  notifier-app-test Teste le build et l'invalidation de Pi Notifications.app dans un dossier temporaire"
	@echo "  herdr-pi-smoke Isolated Herdr named-session smoke: 20+ rapid Pi pane starts"
	@echo "  hermes-gemma   Installe le superviseur Gemma (démarre/arrête avec Hermes.app)"
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

install all: git-filters notifier-app $(PACKAGES) $(addsuffix -post,$(POSTS)) obsidian

# -R (restow) est idempotent : premier stow ou réparation de drift, même geste.
# Seul point d'invocation de stow pour les packages — NOFOLD s'applique ici.
$(filter-out pi,$(PACKAGES)):
	@$(STOW) -R $(if $(filter $@,$(NOFOLD)),--no-folding) $@

restow: $(PACKAGES)

unstow:
	@for pkg in $(PACKAGES); do $(STOW) -D $$pkg; done

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

# gh est un formula brew ; sa config est stowée par le package gh (hosts.yml, qui
# contient le token OAuth, reste un fichier réel hors repo grâce à NOFOLD).
# L'auth `gh auth login` est interactive et ne peut pas être automatisée ici.
gh-post:
	@if ! command -v gh >/dev/null; then \
		if command -v brew >/dev/null; then brew install gh; \
		else echo "gh introuvable et brew indisponible — installe-le à la main (https://cli.github.com)"; fi; \
	fi
	@if command -v gh >/dev/null; then \
		gh auth status >/dev/null 2>&1 && echo "gh prêt et authentifié" \
			|| echo "gh installé — lance \`gh auth login\` pour t'authentifier (push/PR)"; \
	else echo "gh non installé — étape ignorée"; fi

# herdr est un binaire brew ; sa config est stowée par le package herdr (NOFOLD).
# Le plugin herdr-nvim-nav fournit les actions plugin_action bindées en alt+hjkl
# dans config.toml : sans lui, alt+hjkl n'a aucun effet côté herdr. Le pendant
# nvim du plugin est géré par lazy (lua/plugins/herdr-nav.lua), installé au 1er
# lancement de nvim — rien à faire ici pour ce versant.
# Pi Notifications.app est un poster résident Swift ; terminal-notifier fournit son bundle
# source et reste le fallback de l'extension. Le script couvre par hash le Swift,
# sa propre logique, le bundle, l'Info.plist, l'icône et les métadonnées attendues.
notifier-app:
	@scripts/build-notifier-app.sh

notifier-app-test:
	@python3 scripts/test-notifier-build.py

herdr-post:
	@if ! command -v herdr >/dev/null; then \
		if command -v brew >/dev/null; then brew install herdr; \
		else echo "herdr introuvable et brew indisponible — installe-le à la main (https://herdr.dev)"; fi; \
	fi
	@if command -v herdr >/dev/null; then \
		herdr plugin list 2>/dev/null | grep -q herdr-nvim-nav \
			|| herdr plugin install aimdevlee/herdr-nvim-nav --yes >/dev/null 2>&1; \
		herdr plugin list 2>/dev/null | grep -q herdr-nvim-nav \
			&& { herdr server reload-config >/dev/null 2>&1 || true; echo "herdr-nvim-nav prêt : alt+hjkl navigue nvim <-> panes herdr"; } \
			|| echo "herdr-nvim-nav non installé — alt+hjkl inactif côté herdr (vérifie \`herdr plugin install aimdevlee/herdr-nvim-nav\`)"; \
	else echo "herdr non installé — étape ignorée"; fi

# hermes est dans NOFOLD : stow ne replie jamais ~/.hermes, donc sessions/,
# memory/ et .env (secrets) restent des fichiers réels hors repo. hermes-dirs
# crée les dossiers runtime avant stow. La config (config.yaml, AGENTS.md,
# skills/) est versionnée dans hermes/.hermes/. Les deux installs sont brew :
# formula hermes-agent (CLI) + cask hermes-desktop (Hermes.app).
hermes: | hermes-dirs

hermes-dirs:
	@mkdir -p "$(HOME)/.hermes/sessions" "$(HOME)/.hermes/memory"

hermes-post:
	@if ! command -v hermes >/dev/null; then \
		if command -v brew >/dev/null; then \
			echo "→ installation de hermes-agent (CLI)"; \
			brew install hermes-agent; \
		else echo "hermes introuvable et brew indisponible — installe-le à la main (https://hermes-agent.nousresearch.com)"; fi; \
	fi
	@if [[ ! -d "/Applications/Hermes.app" ]]; then \
		if command -v brew >/dev/null; then \
			echo "→ installation de hermes-desktop (Hermes.app)"; \
			brew install --cask hermes-desktop; \
		fi; \
	fi
	@if command -v hermes >/dev/null; then \
		launchctl setenv PATH "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin" || true; \
		launchctl setenv HERMES_DESKTOP_HERMES "/opt/homebrew/bin/hermes" || true; \
		echo "hermes prêt — GUI: launchctl env posé (persisté par zsh/.zprofile à chaque login)"; \
		echo "  \`hermes model\` pour le provider LLM"; \
	else echo "hermes non installé — étape ignorée"; fi
	@$(MAKE) hermes-gemma

# Backend local Gemma 4 12B via MLX (multimodal). Hermes est un client HTTP :
# il ne lance pas l'inférence. Un LaunchAgent supervise mlx_vlm.server et le
# démarre/arrête avec Hermes.app (évite 7 Go de RAM résidents hors session).
# Rejouable : pose le binaire pipx, écrit le plist, (re)charge launchd.
hermes-gemma:
	@if ! command -v mlx_vlm.server >/dev/null; then \
		if command -v pipx >/dev/null; then \
			echo "→ installation de mlx-vlm via pipx"; \
			pipx install mlx-vlm; \
			pipx inject mlx-vlm jinja2; \
		else echo "pipx introuvable — installe-le via brew"; exit 1; fi; \
	fi
	@test -x "$(HOME)/.hermes/bin/hermes-gemma-supervise" \
		|| { echo "superviseur absent — lance \`make hermes\` d'abord"; exit 1; }
	@mkdir -p "$(HOME)/Library/LaunchAgents" "$(HOME)/.hermes/logs"
	@umask 077; printf '%s\n' \
		'<?xml version="1.0" encoding="UTF-8"?>' \
		'<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">' \
		'<plist version="1.0"><dict>' \
		'<key>Label</key><string>com.stow.hermes-gemma</string>' \
		'<key>ProgramArguments</key><array>' \
		'<string>$(HOME)/.hermes/bin/hermes-gemma-supervise</string>' \
		'</array>' \
		'<key>RunAtLoad</key><true/>' \
		'<key>KeepAlive</key><true/>' \
		'<key>ThrottleInterval</key><integer>5</integer>' \
		'<key>StandardOutPath</key><string>$(HOME)/.hermes/logs/gemma-supervise.log</string>' \
		'<key>StandardErrorPath</key><string>$(HOME)/.hermes/logs/gemma-supervise.log</string>' \
		'<key>EnvironmentVariables</key><dict>' \
		'<key>HOME</key><string>$(HOME)</string>' \
		'<key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:$(HOME)/.local/bin:/usr/sbin:/usr/bin:/bin</string>' \
		'</dict></dict></plist>' \
		> "$(HOME)/Library/LaunchAgents/com.stow.hermes-gemma.plist"
	@uid=$$(id -u); \
		launchctl bootout "gui/$$uid/com.stow.hermes-gemma" >/dev/null 2>&1 || true; \
		launchctl bootstrap "gui/$$uid" "$(HOME)/Library/LaunchAgents/com.stow.hermes-gemma.plist"; \
		launchctl enable "gui/$$uid/com.stow.hermes-gemma"; \
		launchctl kickstart -k "gui/$$uid/com.stow.hermes-gemma"
	@echo "superviseur Gemma chargé — démarre/arrête avec Hermes.app (:8080)"

nvim-post:
	@if ! command -v rg >/dev/null; then \
		if command -v brew >/dev/null; then brew install ripgrep; \
		else echo "ripgrep introuvable et brew indisponible — installe-le à la main (https://github.com/BurntSushi/ripgrep)"; fi; \
	fi
	@command -v rg >/dev/null && echo "ripgrep prêt: telescope live_grep/grep_string opérationnels" \
		|| echo "ripgrep non installé — telescope live_grep échouera"

# pi-dirs crée les répertoires runtime avant Stow : ~/.pi/agent reste réel car
# sessions/ et npm/ existent. Tous les descendants versionnés sont remplacés
# avant le restow : le package courant gagne aussi face à un fichier réel ou à un
# lien Stow provenant d'un autre worktree. Les autres descendants (auth.json,
# models-store.json, npm/, sessions/, external/, etc.) restent locaux hors repo.
PI_MANAGED := AGENTS.md archived background.json extensions keybindings.json npm-patches prompts settings.json skills tests themes
PI_OXFMT_VERSION := 0.65.0
PI_OXLINT_VERSION := 1.80.0
PI_FALLOW_VERSION := 3.21.0
PI_QUALITY_BASE ?= develop-pi

pi: | pi-dirs
	@$(STOW) --no-folding -D pi
	@for path in $(PI_MANAGED); do rm -rf -- "$(HOME)/.pi/agent/$$path"; done
	@$(STOW) -R pi
	@for path in $(PI_MANAGED); do \
		[ -L "$(HOME)/.pi/agent/$$path" ] || { \
			echo "déploiement Pi incomplet: ~/.pi/agent/$$path n'est pas géré par Stow" >&2; \
			exit 1; \
		}; \
	done

pi-dirs:
	@mkdir -p \
		"$(HOME)/.pi/agent/sessions" \
		"$(HOME)/.pi/agent/npm" \
		"$(HOME)/.pi/agent/external/skills"

# pnpm installé par brew est un script `#!/usr/bin/env node` et node arrive via
# fnm, pas via brew : sur un mac neuf on installe le LTS puis on lance pnpm au
# travers de `fnm exec`. FNM_DIR/PNPM_HOME reprennent zsh/.config/zsh/conf.d.
#
# pnpm 11 ignore les flags CLI --config.strict-dep-builds=false quand la commande
# utilise --prefix (c'est le cas des installs npm de pi : `pi install`/`pi update`
# passent toujours --prefix ~/.pi/agent/npm). Sans allowBuilds dans le workspace,
# l'install échoue en ERR_PNPM_IGNORED_BUILDS sur les build scripts sans décision
# explicite. node-pty reste approuvé pour les extensions npm qui en dépendent ;
# les scripts de @google/genai et protobufjs ne sont pas nécessaires ici. Le fichier
# est donc écrit de façon déterministe AVANT les pi install/update : toute nouvelle
# dépendance avec un build échouera explicitement jusqu'à examen de cette politique.
# patchedDependencies applique le patch de rendu compact de pi-web-access
# (npm-patches/pi-web-access.patch, versionné et déployé via Stow) : rows compactes
# pour les quatre tools web et leurs notifications/résultats asynchrones. Un bump
# du package qui casse le patch échoue
# bruyamment ici → régénérer avec `pnpm patch pi-web-access` + `pnpm patch-commit`,
# recopier patches/pi-web-access.patch vers npm-patches/ et relancer pi-post
# (patch-commit réécrit le chemin vers patches/ dans pnpm-workspace.yaml).
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
	@mkdir -p "$(HOME)/.pi/agent/npm"
	@printf '%s\n' \
		'# Build-script policy for Pi npm extensions (pnpm 11).' \
		'allowBuilds:' \
		"  '@google/genai': false" \
		'  node-pty: true' \
		'  protobufjs: false' \
		'patchedDependencies:' \
		'  pi-web-access: ../npm-patches/pi-web-access.patch' \
		> "$(HOME)/.pi/agent/npm/pnpm-workspace.yaml"
	@echo "→ pnpm-workspace.yaml: node-pty approuvé ; builds @google/genai/protobufjs refusés"
	@if command -v pi >/dev/null; then \
		if [ ! -x "$(PNPM_HOME)/bin/pnpm" ]; then \
			pnpm11=$$(find "$(FNM_DIR)/node-versions" -path "*/installation/bin/pnpm" \( -type f -o -type l \) 2>/dev/null | sort -V | tail -1); \
			if [ -n "$$pnpm11" ]; then \
				ln -sf "$$pnpm11" "$(PNPM_HOME)/bin/pnpm"; \
				echo "→ pnpm v11 symlinké dans PNPM_HOME/bin (store cohérent)"; \
			fi; \
		fi; \
		pi install npm:pi-web-access >/dev/null 2>&1 || true; \
		pi update --all; \
		echo "pi prêt et à jour — package web-access — \`pi\` puis /login pour l'auth"; \
	else echo "pi non installé — étape ignorée"; fi

pi-update:  pi-post

# Gate unique du harness : suites des extensions Pi contre les dépendances installées,
# validation isolée du déploiement Stow puis stress-test d'un vrai Pi. Aucun restow
# du HOME réel, aucune réinstallation de Pi et aucun symlink manuel.
pi-test: pi-quality-test  pi-notify-test pi-ui-test
	@python3 scripts/test-pi-config.py
	@python3 scripts/test-pi-startup.py
	@python3 scripts/test-git-filters.py

pi-quality-test:
	@{ printf '%s\0' pi/.pi/.fallowrc.json pi/.pi/.oxfmtrc.json pi/.pi/.oxlintrc.json; \
		find pi/.pi/agent/extensions pi/.pi/agent/tests -type f -name '*.ts' -print0; \
	} | xargs -0 pnpm dlx oxfmt@$(PI_OXFMT_VERSION) \
			--config pi/.pi/.oxfmtrc.json --check
	@cd pi/.pi && pnpm dlx oxlint@$(PI_OXLINT_VERSION) \
		--config .oxlintrc.json agent/extensions agent/tests
	@cd pi/.pi && pnpm dlx fallow@$(PI_FALLOW_VERSION) audit \
		--config .fallowrc.json \
		--base "$${FALLOW_BASE_REF:-$(PI_QUALITY_BASE)}"

pi-notify-test:
	@node --test \
		pi/.pi/agent/tests/pi-notify-extension.test.ts \
		pi/.pi/agent/tests/pi-notify-focus.test.ts \
		pi/.pi/agent/tests/pi-notify-poster.test.ts

pi-ui-test:
	@node --test \
		pi/.pi/agent/tests/compact-tools-renderer.test.ts \
		pi/.pi/agent/tests/compact-tools-stack.test.ts \
		pi/.pi/agent/tests/compact-tools-summary.test.ts \
		pi/.pi/agent/tests/design-system.test.ts \
		pi/.pi/agent/tests/double-escape-pacer.test.ts \
		pi/.pi/agent/tests/editor-decorator.test.ts \
		pi/.pi/agent/tests/footer.test.ts \
		pi/.pi/agent/tests/json-view-blob-store.test.ts \
		pi/.pi/agent/tests/json-view-command.test.ts \
		pi/.pi/agent/tests/json-view-detection.test.ts \
		pi/.pi/agent/tests/json-view-frame.test.ts \
		pi/.pi/agent/tests/json-view-rendering.test.ts \
		pi/.pi/agent/tests/mutation-view-edit.test.ts \
		pi/.pi/agent/tests/mutation-view-write.test.ts \
		pi/.pi/agent/tests/ordered-widget-stack.test.ts \
		pi/.pi/agent/tests/pi-web-render.test.ts \
		pi/.pi/agent/tests/polling-resource.test.ts \
		pi/.pi/agent/tests/response-view.test.ts \
		pi/.pi/agent/tests/session-shortcuts.test.ts \
		pi/.pi/agent/tests/surface.test.ts \
		pi/.pi/agent/tests/terminal-text.test.ts \
		pi/.pi/agent/tests/ui-registry-policy.test.ts \
		pi/.pi/agent/tests/working-loader-lifecycle.test.ts \
		pi/.pi/agent/tests/working-loader-primitives.test.ts \
		pi/.pi/agent/tests/working-loader-stream.test.ts

herdr-pi-smoke: herdr
	@python3 scripts/test-herdr-pi-startup.py

rtk-post:
	@if ! command -v rtk >/dev/null; then \
		if command -v brew >/dev/null; then brew install rtk; \
		else echo "rtk introuvable et brew indisponible — installe rtk à la main (https://github.com/rtk-ai/rtk)"; fi; \
	fi
	@command -v rtk >/dev/null && rtk init -g --auto-patch >/dev/null \
		&& echo "rtk prêt" \
		|| echo "rtk non installé — étape ignorée"

# rustup gère sa propre toolchain (~/.rustup, ~/.cargo) hors Stow ; c'est lui qui
# pose ~/.cargo/env sourcé par zsh/.zshenv. Installer non-interactif, profil par
# défaut, toolchain stable. Rejouable : si cargo est déjà là on ne touche à rien.
rust-post:
	@if ! command -v cargo >/dev/null && [[ ! -f "$(HOME)/.cargo/env" ]]; then \
		echo "→ installation de rustup (toolchain stable)"; \
		curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --no-modify-path --default-toolchain stable; \
	fi
	@[[ -f "$(HOME)/.cargo/env" ]] && echo "rust prêt: $$("$(HOME)/.cargo/bin/rustc" --version 2>/dev/null)" \
		|| echo "rust non installé — étape ignorée"

obsidian:
	@stow -d obsidian -t "$(OBSIDIAN_VAULT_DIR)" -R Brain
	@echo "config Obsidian stowée (symlinks) dans le vault Brain"

obsidian-save:
	@stow -d obsidian -t "$(OBSIDIAN_VAULT_DIR)" --adopt -R Brain
	@echo "fichiers dé-symlinkés par Obsidian ré-adoptés dans le repo — vérifie git diff avant commit"

# Dev directories scaffold — crée ~/Development/{clients,tools,nextnode} si absent.
# Idempotent : mkdir -p ne fait rien si le dossier existe déjà.
DEV_DIRS := $(HOME)/Development/clients $(HOME)/Development/tools $(HOME)/Development/nextnode

dev-dirs-post:
	@for d in $(DEV_DIRS); do \
		if [ -d "$$d" ]; then \
			echo "✓ $$d"; \
		else \
			mkdir -p "$$d" && echo "→ créé $$d"; \
		fi; \
	done

dev-dirs:
	@$(MAKE) dev-dirs-post

# Filtres clean git (cf. .gitattributes) : ils vivent dans .git/config, donc non
# versionnés — cette cible les (re)pose après chaque clone. Idempotente.
# Le script filtre est référencé en chemin absolu : git l'exécute quel que soit
# le cwd de la commande (status, diff, add...).
git-filters:
	@git config filter.pi-settings.clean "$(CURDIR)/scripts/git-filter-pi-settings-clean.sh"
	@git config filter.hermes-config.clean "$(CURDIR)/scripts/git-filter-hermes-config-clean.sh"
	@git config filter.claude-settings.clean "$(CURDIR)/scripts/git-filter-claude-settings-clean.sh"
	@chmod +x scripts/git-filter-pi-settings-clean.sh scripts/git-filter-hermes-config-clean.sh scripts/git-filter-claude-settings-clean.sh
	@echo "filtres pi-settings + hermes-config + claude-settings actifs — les clés runtime ne bougent que sur vrais changements"

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
