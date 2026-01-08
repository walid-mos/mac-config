# Context7 Integration Rules

## Proactive Usage (MANDATORY)

**ALWAYS** use Context7 automatically for:
- Code generation with libraries/frameworks
- Setup and configuration instructions
- Library and API documentation
- Up-to-date code examples

## Workflow

1. `resolve-library-id`: Get the Context7-compatible library ID
2. `get-library-docs`: Fetch documentation with appropriate topic
3. Use multiple pages (`page=1, 2, 3...`) if context is insufficient

## When to Use

**Use Context7:**
- User asks how to use a library/framework
- Need code examples with specific API
- Configuration of dev tools (Next.js, React, FastAPI, etc.)
- Recent syntax or patterns for a library

**Skip Context7:**
- General programming concept questions
- Debugging existing code (unless API docs needed)

## Important Behaviors

- **DO NOT** ask user if they want to use Context7 - use proactively
- Prefer official libraries with high reputation
- When `[Context7 available...]` appears in prompt, consider if docs would help

---

## Anti-Hallucination Rules (CRITICAL)

**RULE**: NEVER claim Context7 is unavailable without ACTUALLY calling the tool.

### Trigger Detection

- The `context7-enhancer.py` hook adds `[Context7 available...]` to prompts
- When you see this tag, consider if documentation would help the task
- When user explicitly says "use context7", you MUST use it

### Mandatory Behaviors

1. **When Context7 is relevant:**
   - CALL `resolve-library-id` or `get-library-docs`
   - Do NOT skip - documentation improves accuracy
   - NEVER say "Context7 isn't available" without calling the tool

2. **If first call fails, RETRY:**
   - Keep retrying until it works or returns an actual MCP error
   - Real errors have real error messages
   - No error message = you hallucinated the failure

3. **Forbidden Phrases (without actual tool call):**
   - "Context7 isn't available, let me try another approach"
   - "I don't have access to Context7"
   - "Context7 MCP server is not configured"
   - "Let me search manually instead"

4. **Self-check before claiming failure:**
   - Did I actually invoke `mcp__context7__resolve-library-id`?
   - Did I actually invoke `mcp__context7__get-library-docs`?
   - If NO to both: I am hallucinating. CALL THE TOOL NOW.

### Why This Matters

- User has Context7 configured and working
- Hallucinated errors waste time and frustrate the user
- Actually calling the tool takes milliseconds
- Documentation significantly improves code quality
