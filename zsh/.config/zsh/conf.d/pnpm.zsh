# =============================================================================
# pnpm
# =============================================================================
# Install: corepack enable pnpm
# =============================================================================

export PNPM_HOME="${XDG_DATA_HOME:-$HOME/.local/share}/pnpm"
# pnpm >= 11 pose les binaires globaux dans $PNPM_HOME/bin ; les versions
# antérieures les posaient directement dans $PNPM_HOME — garder les deux.
for dir in "$PNPM_HOME/bin" "$PNPM_HOME"; do
  case ":$PATH:" in
    *":$dir:"*) ;;
    *) export PATH="$dir:$PATH" ;;
  esac
done
unset dir
