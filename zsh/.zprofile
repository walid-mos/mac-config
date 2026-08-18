# =============================================================================
# ZSH Profile (.zprofile)
# =============================================================================
# Loaded for LOGIN shells only (after .zshenv, before .zshrc)
# =============================================================================

# Homebrew (macOS)
eval "$(/opt/homebrew/bin/brew shellenv)"

# Les apps GUI lancées depuis Finder héritent d'un PATH minimal sans
# /opt/homebrew/bin : Hermes Desktop (et son backend hermes serve), VS Code,
# etc. ne trouvent ni brew ni ses outils (node, ripgrep…). On réécrit le PATH
# du login launchd à chaque login — portée session, relancé au boot.
launchctl setenv PATH "/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"

# HERMES_DESKTOP_HERMES : le desktop app est installé via brew cask, le backend
# CLI via brew formula. Cette variable fait résoudre le backend vers le brew
# hermes au lieu de lancer le managed bootstrap (qui télécharge uv, python 3.11,
# node, clone le repo — duplication inutile). C'est le mécanisme documenté pour
# les packagers (Nix, brew).
launchctl setenv HERMES_DESKTOP_HERMES "/opt/homebrew/bin/hermes"

# Hermes Agent — ensure ~/.local/bin is on PATH
export PATH="$HOME/.local/bin:$PATH"
