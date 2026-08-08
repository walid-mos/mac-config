#!/usr/bin/env bash
# Bootstrap one-shot d'un mac neuf, sans clone préalable :
#   /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/walid-mos/mac-config/main/bootstrap.sh)"
# Installe les Xcode CLT (git), clone le repo, puis lance `make bootstrap`.
set -euo pipefail

REPO_URL="${MAC_CONFIG_REPO:-https://github.com/walid-mos/mac-config.git}"
REPO_DIR="${MAC_CONFIG_DIR:-$HOME/.stow_repository}"
: "${MAKE:=make}"

if ! xcode-select -p >/dev/null 2>&1; then
	echo "→ Xcode Command Line Tools (valide la fenêtre qui s'ouvre)"
	xcode-select --install >/dev/null 2>&1 || true
	until xcode-select -p >/dev/null 2>&1; do printf '.'; sleep 5; done
	echo " CLT installés"
fi

if [ -d "$REPO_DIR/.git" ]; then
	echo "→ repo déjà cloné, mise à jour"
	git -C "$REPO_DIR" pull --ff-only || echo "  pull ignoré (repo local modifié ou divergent)"
else
	echo "→ clone dans $REPO_DIR"
	git clone "$REPO_URL" "$REPO_DIR"
fi

cd "$REPO_DIR"
$MAKE bootstrap
