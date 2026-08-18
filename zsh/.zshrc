# =============================================================================
# ZSH Configuration (.zshrc)
# =============================================================================
# Loaded for INTERACTIVE shells only
# =============================================================================

# Load modular configurations
for config in ~/.config/zsh/conf.d/*.zsh(N); do
  source "$config"
done

# Aliases (outside conf.d for quick access)
source ~/.config/zsh/aliases

# opencode
export PATH=/Users/walid-mos/.opencode/bin:$PATH

# free les ports/process du dev astore (api :3000, vite :5173-5176)
alias killdev='P=$(lsof -ti tcp:3000,tcp:5173,tcp:5174,tcp:5175,tcp:5176 2>/dev/null); [ -n "$P" ] && kill -9 $P; pkill -f "tsx watch|vite|turbo run dev" 2>/dev/null; echo "dev killed"'

# Added by cua-driver-rs installer — see https://github.com/trycua/cua
export PATH="/Users/walid-mos/.local/bin:$PATH"
