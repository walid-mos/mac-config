## Development Workflow

After each phase of a feature is developed, you must:
1. Lint (`pnpm lint` or package-specific lint command)
2. Typecheck (if project is in typescript : `pnpm type-check` or package-specific typecheck command)
3. Test (`pnpm test` or package-specific test command)
4. Run security review with @agent-security-commit-guardian
5. Run code refactoring with @agent-code-refactor-specialist
6. Update README.md documentation if necessary:
   - Add new features to feature list
   - Update installation/setup instructions if changed
   - Document new environment variables or configuration
   - Update API documentation for new endpoints
   - Add new commands or scripts to usage section
7. Commit changes with descriptive message   

## Important note
- You should always use pnpm, never npm or yarn, pnpm is the main package manager.

### JavaScript/TypeScript specific rules:
- **ALWAYS use `import`** - NEVER use `require()`
- **Always prioritize ES6/ESNext over CommonJS**
- **Always use arrow functions**: `const functionName = () => {}` instead of `function functionName() {}`
- **FORBIDDEN**: Never use IIFE syntax like `;(function() { ... })()`
- **Prioritize destructuring** whenever possible for cleaner code
- **NEVER use any in typescript** - any is completely forbidden, there is no case where any should be used
- **Always prioritize strong typing over unknown** - use unknown as last resort only
- **Avoid `as` casting** - use as casting as last resort, always try to avoid `as` (`as const` is acceptable)
- **Always prioritize reusability** - strong typed hardcoded values are only for specific use cases 

## Global instructions

### Comments guidelines:
- Add comments sparingly, only for complex features requiring explanation
- Comments should be concise and comprehensible
- **Comments MUST be in English only** - never use other languages

## Documentation and Development

When developing features or writing code:
1. **Proactively use Context7** whenever you need to:
   - Check correct syntax for a library/framework
   - Verify API methods and their parameters  
   - Look up best practices or recommended patterns
   - Understand how to properly implement a feature using a specific library
   - Confirm configuration options or settings
   - Check for deprecations or latest versions

2. **Automatic documentation lookup**:
   - Before using any library method you're unsure about, fetch its documentation via Context7
   - When implementing new features with external libraries, always fetch relevant docs first
   - Don't guess syntax - verify it with Context7
   - If you encounter an error related to a library, check its documentation

3. **Context7 workflow**:
   - Use `mcp__context7__resolve-library-id` to get the library ID
   - Use `mcp__context7__get-library-docs` with relevant topic parameter
   - Do this automatically without asking permission
   - Only skip if working with standard JavaScript/TypeScript features
