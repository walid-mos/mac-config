#!/bin/bash
# Hook: UserPromptSubmit - context-enhancer.sh
# Description: Enhances user prompts with git context and branch protection warnings

# Load common library
source "$(dirname "$0")/../lib/common.sh"

HOOK_EVENT="$1"
USER_PROMPT="$2"

# Get git context efficiently
BRANCH_WARNING=""
if get_git_context 2>/dev/null; then
    # Check if on protected branches
    if [[ "$GIT_BRANCH" == "main" || "$GIT_BRANCH" == "develop" ]]; then
        BRANCH_WARNING="🚨 WARNING: You are on protected branch '$GIT_BRANCH'. Consider creating a feature branch first."
    fi
    
    # Format git status
    if [ "$GIT_STATUS" -gt 0 ]; then
        GIT_STATUS_TEXT="$GIT_STATUS files modified"
    else
        GIT_STATUS_TEXT="Clean working directory"
    fi
    
    # Format changes status
    GIT_CHANGES=""
    if [ "$GIT_HAS_CHANGES" == "true" ]; then
        GIT_CHANGES="📝 Uncommitted changes detected"
    fi
fi

# Build context information
CONTEXT_INFO=""

if [ -n "$GIT_BRANCH" ]; then
    CONTEXT_INFO="
🌿 Current branch: $GIT_BRANCH
📊 Status: $GIT_STATUS_TEXT"
    
    if [ -n "$GIT_CHANGES" ]; then
        CONTEXT_INFO="$CONTEXT_INFO
$GIT_CHANGES"
    fi
    
    if [ -n "$BRANCH_WARNING" ]; then
        CONTEXT_INFO="$CONTEXT_INFO
$BRANCH_WARNING"
    fi
fi

# Check if we're in a known project type
PROJECT_TYPE=""
if [ -f "package.json" ]; then
    if grep -q "typescript" package.json; then
        PROJECT_TYPE="TypeScript/Node.js project"
    else
        PROJECT_TYPE="Node.js project"
    fi
elif [ -f "Cargo.toml" ]; then
    PROJECT_TYPE="Rust project"
elif [ -f "pyproject.toml" ] || [ -f "requirements.txt" ]; then
    PROJECT_TYPE="Python project"
fi

if [ -n "$PROJECT_TYPE" ]; then
    CONTEXT_INFO="$CONTEXT_INFO
🔧 Project type: $PROJECT_TYPE"
fi

# Add package manager info for Node.js projects
if [ -f "package.json" ]; then
    if [ -f "pnpm-lock.yaml" ]; then
        CONTEXT_INFO="$CONTEXT_INFO
📦 Package manager: pnpm (as per CLAUDE.md guidelines)"
    elif [ -f "package-lock.json" ]; then
        CONTEXT_INFO="$CONTEXT_INFO
⚠️  Package manager: npm (consider switching to pnpm per CLAUDE.md)"
    elif [ -f "yarn.lock" ]; then
        CONTEXT_INFO="$CONTEXT_INFO
⚠️  Package manager: yarn (consider switching to pnpm per CLAUDE.md)"
    fi
fi

# Output enhanced context if we have useful information
if [ -n "$CONTEXT_INFO" ]; then
    echo "📋 Context Information:$CONTEXT_INFO

---

$USER_PROMPT"
else
    echo "$USER_PROMPT"
fi