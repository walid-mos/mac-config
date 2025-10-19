---
description: Add a technology to Context7 library detection list
---

# Add Technology to Context7 Detection

You are helping the user add a new technology to their Context7 library detection list.

## Workflow

1. **Resolve Library ID**: Use the MCP Context7 tool `resolve-library-id` to find the exact library identifier
   - If exact match found: use it
   - If no exact match: propose the closest matches and ask user to choose
   - Handle fuzzy matching (e.g., "next" → "nextjs", "vitret" → "vite" or "vitest")

2. **Confirm with User**: Show the resolved library name and ask for confirmation

3. **Categorize**: Determine the appropriate category in the file:
   - Frontend Frameworks
   - Styling
   - TypeScript & Build Tools
   - State Management & Data Fetching
   - Backend & APIs
   - Database & ORM
   - Testing
   - DevOps & Infrastructure
   - Utilities
   - APIs & Services

4. **Update File**: Add the library to `~/.claude/hooks/context7-libraries.txt` in the correct category
   - Format: `keyword:context7-id`
   - Use the most common keyword (e.g., "next" for Next.js, not "nextjs")
   - Sort alphabetically within the category

5. **Confirm Success**: Show what was added and where

## User Input

The user will provide one or more technology names after the command:
- Single: `/context7-add stripe`
- Multiple: `/context7-add stripe openai vercel`

## Important

- ALWAYS use Context7 MCP to validate the library exists
- If multiple matches, let user choose
- Keep the file organized and clean
- Use common/short keywords when possible (react not reactjs, next not nextjs)
