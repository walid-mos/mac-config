#!/bin/bash
# Hook: UserPromptSubmit - context7-enhancer.sh
# Description: Automatically fetch library documentation when libraries are mentioned

HOOK_EVENT="$1"
USER_PROMPT="$2"

# Path to library configuration file
LIBRARIES_FILE="$(dirname "$0")/context7-libraries.txt"

# Check if configuration file exists
if [ ! -f "$LIBRARIES_FILE" ]; then
    echo "$USER_PROMPT"
    exit 0
fi

# Read library mappings from file (skip comments and empty lines)
DETECTED_LIBS=()
while IFS=':' read -r lib_name context7_id; do
    # Skip comments and empty lines
    [[ "$lib_name" =~ ^[[:space:]]*# ]] && continue
    [[ -z "$lib_name" ]] && continue

    # Trim whitespace
    lib_name=$(echo "$lib_name" | xargs)
    context7_id=$(echo "$context7_id" | xargs)

    # Case-insensitive match for library name in prompt
    if echo "$USER_PROMPT" | grep -qi "\b$lib_name\b"; then
        DETECTED_LIBS+=("$context7_id")
    fi
done < "$LIBRARIES_FILE"

# Remove duplicates
UNIQUE_LIBS=($(printf '%s\n' "${DETECTED_LIBS[@]}" | sort -u))

# If libraries detected, add a note to the prompt
if [ ${#UNIQUE_LIBS[@]} -gt 0 ]; then
    LIBS_LIST=$(IFS=", "; echo "${UNIQUE_LIBS[*]}")
    echo "📚 Libraries detected: $LIBS_LIST

💡 Suggestion: Use Context7 MCP for up-to-date documentation if needed
   • resolve-library-id → get-library-docs

---

$USER_PROMPT"
else
    echo "$USER_PROMPT"
fi
