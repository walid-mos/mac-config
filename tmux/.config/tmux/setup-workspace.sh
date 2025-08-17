#!/bin/bash
# Script pour configurer rapidement l'espace de travail tmux
# Remplace les layouts Zellij

# Fonction pour créer une session avec split vertical
setup_project_session() {
    local session_name="$1"
    local project_path="$2"
    
    # Créer la session si elle n'existe pas
    if ! tmux has-session -t "$session_name" 2>/dev/null; then
        # Créer session dans le répertoire du projet
        tmux new-session -d -s "$session_name" -c "$project_path"
        
        # Créer split vertical (à droite)
        tmux split-window -h -t "$session_name" -c "$project_path"
        
        # Retourner au pane de gauche
        tmux select-pane -t 0
        
        echo "Session '$session_name' créée dans $project_path"
    else
        echo "Session '$session_name' existe déjà"
    fi
}

# Configuration de vos 3 projets principaux
setup_nextnode_workspace() {
    echo "Configuration de l'espace de travail NextNode..."
    
    # NextNode Front
    setup_project_session "nextnode-front" "$HOME/Documents/Development/nextnode/nextnode-front"
    
    # NextNode
    setup_project_session "nextnode" "$HOME/Documents/Development/nextnode"
    
    # Configs
    setup_project_session "configs" "$HOME/.stow_repository"
    
    echo "Espace de travail configuré !"
    echo ""
    echo "Sessions disponibles :"
    echo "  tmux attach -t nextnode-front"
    echo "  tmux attach -t nextnode"
    echo "  tmux attach -t configs"
}

# Fonction pour nettoyer toutes les sessions
cleanup_sessions() {
    echo "Nettoyage des sessions tmux..."
    tmux kill-server 2>/dev/null || echo "Aucune session tmux active"
}

# Menu principal
case "$1" in
    "setup")
        setup_nextnode_workspace
        ;;
    "clean")
        cleanup_sessions
        ;;
    "list")
        tmux list-sessions 2>/dev/null || echo "Aucune session tmux active"
        ;;
    *)
        echo "Usage: $0 {setup|clean|list}"
        echo ""
        echo "  setup - Configure l'espace de travail NextNode"
        echo "  clean - Nettoie toutes les sessions tmux"
        echo "  list  - Liste les sessions actives"
        ;;
esac