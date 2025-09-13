#!/bin/bash
# Common utility functions for Claude Code scripts
# Extracted from duplicated code across multiple scripts

# Constants
readonly MIN_COMMITS_FOR_SQUASH=3
readonly LOG_HISTORY_SIZE=1000
readonly BUILD_TIME_SLOW_THRESHOLD=60
readonly BUILD_TIME_MODERATE_THRESHOLD=30

# Colors for output
readonly RED='\033[0;31m'
readonly GREEN='\033[0;32m'
readonly YELLOW='\033[1;33m'
readonly BLUE='\033[0;34m'
readonly NC='\033[0m' # No Color

# Common validation functions

# Validate that we're in a git repository
validate_git_repo() {
    if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
        echo -e "${RED}❌ Error: Not in a git repository${NC}"
        echo -e "${BLUE}💡 Navigate to a git repository or run 'git init'${NC}"
        return 1
    fi
    return 0
}

# Validate that we're in a Node.js project
validate_nodejs_project() {
    if [ ! -f "package.json" ]; then
        echo -e "${RED}❌ Error: No package.json found${NC}"
        echo -e "${BLUE}💡 This command is designed for Node.js projects${NC}"
        return 1
    fi
    return 0
}

# Check current branch and warn if on protected branch
check_current_branch() {
    local current_branch
    current_branch=$(git branch --show-current 2>/dev/null)
    
    if [[ "$current_branch" == "main" || "$current_branch" == "develop" ]]; then
        echo -e "${YELLOW}⚠️  Currently on protected branch: $current_branch${NC}"
        echo -e "${BLUE}💡 Consider creating a feature branch first${NC}"
        return 1
    fi
    
    echo "$current_branch"
    return 0
}

# Check if pnpm is available (per CLAUDE.md guidelines)
validate_pnpm() {
    if ! command -v pnpm >/dev/null 2>&1; then
        echo -e "${RED}❌ Error: pnpm not found${NC}"
        echo -e "${BLUE}💡 Install pnpm per CLAUDE.md guidelines: npm install -g pnpm${NC}"
        return 1
    fi
    return 0
}

# Parse JSON tool input efficiently (single jq call)
parse_tool_input() {
    local tool_input="$1"
    
    # Parse all needed fields in one jq call
    eval "$(echo "$tool_input" | jq -r '
        @sh "
        FILE_PATH=\(.file_path // "")
        NEW_STRING=\(.new_string // "")
        COMMAND=\(.command // "")
        DESCRIPTION=\(.description // "No description")
        "
    ')"
    
    # Export variables for caller
    export FILE_PATH NEW_STRING COMMAND DESCRIPTION
}

# Enhanced error handling with context
handle_error() {
    local exit_code=$1
    local error_msg="$2"
    local suggestion="$3"
    local context="$4"
    
    echo -e "${RED}❌ Error: $error_msg${NC}"
    
    if [ -n "$suggestion" ]; then
        echo -e "${BLUE}💡 $suggestion${NC}"
    fi
    
    if [ -n "$context" ]; then
        echo -e "${YELLOW}📍 Context: $context${NC}"
    fi
    
    exit "$exit_code"
}

# Success message with context
show_success() {
    local message="$1"
    local details="$2"
    
    echo -e "${GREEN}✅ $message${NC}"
    
    if [ -n "$details" ]; then
        echo -e "${BLUE}ℹ️  $details${NC}"
    fi
}

# Warning message
show_warning() {
    local message="$1"
    local suggestion="$2"
    
    echo -e "${YELLOW}⚠️  $message${NC}"
    
    if [ -n "$suggestion" ]; then
        echo -e "${BLUE}💡 $suggestion${NC}"
    fi
}

# Step counter for multi-step operations
CURRENT_STEP=0
TOTAL_STEPS=0

init_steps() {
    TOTAL_STEPS="$1"
    CURRENT_STEP=0
}

next_step() {
    local step_description="$1"
    ((CURRENT_STEP++))
    echo -e "${BLUE}📝 Step $CURRENT_STEP/$TOTAL_STEPS: $step_description...${NC}"
    echo "=================================="
}

# Cleanup function for temporary files
TEMP_FILES=()

create_temp_file() {
    local temp_file
    temp_file=$(mktemp)
    TEMP_FILES+=("$temp_file")
    echo "$temp_file"
}

cleanup_temp_files() {
    for temp_file in "${TEMP_FILES[@]}"; do
        if [ -f "$temp_file" ]; then
            rm -f "$temp_file"
        fi
    done
    TEMP_FILES=()
}

# Set up cleanup trap
setup_cleanup_trap() {
    trap 'cleanup_temp_files' EXIT INT TERM
}

# Check if command exists (with simple caching)
# Note: Using simple variables instead of associative arrays for compatibility

command_exists() {
    local cmd="$1"
    
    # Direct check for better compatibility
    if command -v "$cmd" >/dev/null 2>&1; then
        return 0
    else
        return 1
    fi
}

# Safe logging with atomic operations
safe_log() {
    local log_file="$1"
    local log_entry="$2"
    local temp_log
    
    # Create temporary file for atomic operation
    temp_log=$(mktemp)
    
    # Append new entry
    echo "$log_entry" >> "$temp_log"
    
    # If original log exists, append it and rotate
    if [ -f "$log_file" ]; then
        cat "$log_file" >> "$temp_log"
        head -n "$LOG_HISTORY_SIZE" "$temp_log" > "${temp_log}.tmp"
        mv "${temp_log}.tmp" "$temp_log"
    fi
    
    # Atomically replace the log file
    mv "$temp_log" "$log_file"
}

# Enhanced git operations
get_git_context() {
    if ! validate_git_repo >/dev/null 2>&1; then
        return 1
    fi
    
    # Get git info without associative arrays
    export GIT_BRANCH=$(git branch --show-current 2>/dev/null || echo "unknown")
    export GIT_STATUS=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    export GIT_HAS_CHANGES=$(git diff-index --quiet HEAD -- 2>/dev/null && echo "false" || echo "true")
    export GIT_REPO_CLEAN=$([ "$GIT_STATUS" -eq 0 ] && echo "true" || echo "false")
}

# Performance timing
SCRIPT_START_TIME=0

start_timer() {
    SCRIPT_START_TIME=$(date +%s)
}

end_timer() {
    local end_time
    local duration
    
    end_time=$(date +%s)
    duration=$((end_time - SCRIPT_START_TIME))
    
    echo -e "${BLUE}⏱️  Operation completed in ${duration}s${NC}"
    
    if [ "$duration" -gt "$BUILD_TIME_SLOW_THRESHOLD" ]; then
        show_warning "Operation took longer than expected (>${BUILD_TIME_SLOW_THRESHOLD}s)" \
                    "Consider optimization opportunities"
    fi
}

# Version information
get_version() {
    echo "Claude Code Common Library v1.0"
    echo "Generated: $(date)"
}

# Main initialization function
init_common_lib() {
    setup_cleanup_trap
    start_timer
}

# If script is run directly, show version
if [[ "${BASH_SOURCE[0]}" == "${0}" ]]; then
    get_version
fi