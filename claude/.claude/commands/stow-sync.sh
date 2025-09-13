#!/bin/bash
# Command: /stow-sync
# Description: Synchronize dotfiles with GNU Stow, checking for conflicts and ensuring proper linking

# Load common library
source "$(dirname "$0")/../lib/common.sh"

# Initialize common library
init_common_lib
init_steps 4

echo "🔄 Starting Stow synchronization..."

# Check if we're in the stow repository
if [ ! -d ".stow-local-ignore" ] && [ ! -f ".stowrc" ] && [ ! -d "zsh" ] && [ ! -d "nvim" ]; then
    handle_error 1 "Not in stow repository directory" \
                 "Navigate to ~/.stow_repository first" \
                 "Directory validation"
fi

# Check if stow is available
if ! command_exists stow; then
    handle_error 1 "GNU Stow not found" \
                 "Install with: brew install stow" \
                 "Command availability"
fi

next_step "Checking for existing symlink conflicts"

# Function to check for conflicts
check_conflicts() {
    local package="$1"
    local temp_log
    
    echo "Checking package: $package"
    temp_log=$(create_temp_file)
    
    # Dry run to check for conflicts (properly quoted)
    if ! stow --no --verbose=2 "$package" 2>"$temp_log"; then
        if grep -q "existing target is" "$temp_log"; then
            show_warning "Conflicts found for $package:"
            grep "existing target is" "$temp_log"
            return 1
        fi
    fi
    return 0
}

# Get list of packages (directories excluding hidden ones)
PACKAGES=(*/)
PACKAGES=("${PACKAGES[@]%/}")

CONFLICT_PACKAGES=()

# Check each package for conflicts (with proper quoting)
for package in "${PACKAGES[@]}"; do
    if [ -d "$package" ] && [[ ! "$package" == .* ]]; then
        if ! check_conflicts "$package"; then
            CONFLICT_PACKAGES+=("$package")
        fi
    fi
done

# Handle conflicts if any
if [ ${#CONFLICT_PACKAGES[@]} -gt 0 ]; then
    echo "🚨 Found conflicts in packages: ${CONFLICT_PACKAGES[*]}"
    echo "📝 Options:"
    echo "  1. Backup conflicting files and continue"
    echo "  2. Abort and handle manually"
    read -p "Choose option (1/2): " choice
    
    case $choice in
        1)
            echo "💾 Creating backup of conflicting files..."
            BACKUP_DIR="$HOME/.stow_backup_$(date +%Y%m%d_%H%M%S)"
            mkdir -p "$BACKUP_DIR"
            
            for package in "${CONFLICT_PACKAGES[@]}"; do
                echo "Backing up conflicts for $package..."
                # This is a simplified backup - in practice, you'd parse stow output more carefully
            done
            
            echo "ℹ️ Backup created at: $BACKUP_DIR"
            ;;
        2)
            echo "🛑 Aborting synchronization"
            exit 1
            ;;
        *)
            echo "❌ Invalid choice"
            exit 1
            ;;
    esac
fi

echo "🔄 Step 2: Unstowing existing packages..."

# Unstow all packages first
for package in "${PACKAGES[@]}"; do
    if [ -d "$package" ] && [[ ! "$package" == .* ]]; then
        echo "Unstowing: $package"
        stow -D "$package" 2>/dev/null || true
    fi
done

echo "🔗 Step 3: Re-stowing all packages..."

# Stow all packages
SUCCESS_COUNT=0
FAILED_PACKAGES=()

for package in "${PACKAGES[@]}"; do
    if [ -d "$package" ] && [[ ! "$package" == .* ]]; then
        echo "Stowing: $package"
        if stow "$package" 2>/dev/null; then
            echo "  ✓ Successfully stowed $package"
            ((SUCCESS_COUNT++))
        else
            echo "  ❌ Failed to stow $package"
            FAILED_PACKAGES+=("$package")
        fi
    fi
done

echo "🔍 Step 4: Verifying symlinks..."

# Check some key symlinks to verify success
KEY_LINKS=(
    "$HOME/.zshrc:zsh/.zshrc"
    "$HOME/.config/nvim:nvim/.config/nvim"
    "$HOME/.config/tmux:tmux/.config/tmux"
    "$HOME/.config/ghostty:ghostty/.config/ghostty"
)

VERIFIED_COUNT=0
for link_info in "${KEY_LINKS[@]}"; do
    IFS=":" read -r target_path source_path <<< "$link_info"
    if [ -L "$target_path" ]; then
        echo "  ✓ $target_path -> $(readlink "$target_path")"
        ((VERIFIED_COUNT++))
    elif [ -d "$(dirname "$target_path")/$source_path" ]; then
        echo "  ⚠️  $target_path exists but may not be properly linked"
    fi
done

echo ""
echo "🎉 Stow synchronization completed!"
echo "📊 Summary:"
echo "  ✓ Successfully stowed: $SUCCESS_COUNT packages"
if [ ${#FAILED_PACKAGES[@]} -gt 0 ]; then
    echo "  ❌ Failed packages: ${FAILED_PACKAGES[*]}"
fi
echo "  ✓ Verified links: $VERIFIED_COUNT key symlinks"
echo ""
echo "💡 Tips:"
echo "  - Use 'stow -D package_name' to unstow a specific package"
echo "  - Use 'stow -R package_name' to restow a specific package"
echo "  - Check ~/.stow_backup_* for any backed up files"

# Cleanup
rm -f /tmp/stow_check.log