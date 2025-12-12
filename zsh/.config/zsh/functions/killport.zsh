# =============================================================================
# killport - Kill process running on a specific port
# =============================================================================
# Usage: killport <port>
# Example: killport 3000
# =============================================================================

killport() {
    local port="${1:?Usage: killport <port>}"
    local pids

    pids=$(lsof -ti:"$port" 2>/dev/null)

    if [[ -z "$pids" ]]; then
        echo "No process found on port $port"
        return 1
    fi

    echo "$pids" | xargs kill -9
    echo "Killed process(es) on port $port"
}
