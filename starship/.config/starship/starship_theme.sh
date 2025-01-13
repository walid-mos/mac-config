#!/bin/bash

# Logging
log_file="$TMPDIR/starship_theme.log"
echo "$(date): Script exécuté" >> "$log_file"

# Chemin vers le fichier de configuration Starship
STARSHIP_CONFIG="$HOME/.config/starship/starship.toml"

# Fonction pour obtenir le thème actuel
get_theme() {
    is_dark_mode=$([ "$(defaults read -g AppleInterfaceStyle 2>/dev/null)" = "Dark" ] && echo true || echo false)
    echo "is_dark_mode = $is_dark_mode" >> "$log_file"
    if $is_dark_mode; then
        echo "catppuccin_mocha"
    else
        echo "catppuccin_latte"
    fi
}

# Mettre à jour la configuration Starship
update_starship_config() {
    local theme=$(get_theme)
    sed -i.bak "s/^palette = .*/palette = \"$theme\"/" "$STARSHIP_CONFIG"
    echo "Configuration Starship mise à jour" >&2
    echo "$(date): Thème détecté - $theme" >> "$log_file"
    echo "$(date): Configuration mise à jour" >> "$log_file"
}

# Mettre à jour la configuration et recharger le shell
update_starship_config
