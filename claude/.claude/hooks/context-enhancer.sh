#!/bin/bash
# Hook: UserPromptSubmit - context-enhancer.sh
# Description: Enhances user prompts with git context and branch protection warnings

HOOK_EVENT="$1"
USER_PROMPT="$2"

# Get git information
GIT_STATUS=""
GIT_BRANCH=""
GIT_CHANGES=""
BRANCH_WARNING=""

if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    GIT_BRANCH=$(git branch --show-current 2>/dev/null)
    
    # Check if on protected branches
    if [[ "$GIT_BRANCH" == "main" || "$GIT_BRANCH" == "develop" ]]; then
        BRANCH_WARNING="🚨 WARNING: You are on protected branch '$GIT_BRANCH'. Consider creating a feature branch first."
    fi
    
    # Get git status summary
    if ! git diff-index --quiet HEAD -- 2>/dev/null; then
        GIT_CHANGES="📝 Uncommitted changes detected"
    fi
    
    # Get short status
    GIT_STATUS=$(git status --porcelain 2>/dev/null | wc -l | tr -d ' ')
    if [ "$GIT_STATUS" -gt 0 ]; then
        GIT_STATUS="$GIT_STATUS files modified"
    else
        GIT_STATUS="Clean working directory"
    fi
fi

# Build context information
CONTEXT_INFO=""

if [ -n "$GIT_BRANCH" ]; then
    CONTEXT_INFO="
🌿 Current branch: $GIT_BRANCH
📊 Status: $GIT_STATUS"
    
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