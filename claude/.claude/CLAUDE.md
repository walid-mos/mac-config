# ============================================================
# ZERO FAILING TESTS — ABSOLUTE, NON-NEGOTIABLE RULE
# ============================================================
#
# ALL tests MUST pass. No exceptions. Ever.
#
# - "Pre-existing failure" is NOT an excuse. Fix it.
# - "Unrelated to my changes" is NOT an excuse. Fix it.
# - You do NOT get to dismiss, skip, or ignore ANY failing test.
# - If a test fails, you have exactly TWO options:
#     1. Fix the CODE so the test passes.
#     2. If you believe the TEST is wrong (not the code), ASK
#        the user: "This test expects X but the code does Y —
#        should I fix the code or update the test?" Then do
#        whatever the user says.
# - You NEVER ship, commit, or report "done" with failing tests.
# - This rule applies to ALL agents (Code, Lead, Test, Bugfix,
#   every single one). No agent may waive it.
# - Saying "N failing tests are pre-existing" without fixing
#   them is a VIOLATION of this rule.
#
# In short: SEE RED? MAKE IT GREEN. THEN TALK.
# ============================================================

# Core Principles

1. English ONLY — responses, code, comments, commits
2. The user may write in French; Claude always responds in English
3. Generated code is always in English, unless specifically required (i18n, explicit user request, etc.)
4. When looking up library documentation, always use Context7 in two steps:
   - **Step 1:** `resolve-library-id` — resolve the library name to a Context7-compatible ID
   - **Step 2:** `query-docs` — fetch the actual documentation using that ID
   - Never skip Step 1 unless the user provides an explicit `/org/project` ID

# Naming Conventions

## TypeScript / React

| Element              | Convention        | Example                              |
|----------------------|-------------------|--------------------------------------|
| Components           | PascalCase        | `UserProfile.tsx`                    |
| Pages                | kebab-case        | `user-profile.tsx`                   |
| Variables / const    | camelCase         | `userName`, `isActive`               |
| Global constants     | UPPER_CASE        | `API_BASE_URL`                       |
| Functions            | camelCase         | `fetchUserData`                      |
| Event handlers       | handle + Action   | `handleClick`, `handleSubmit`        |
| Classes / Interfaces | PascalCase        | `UserService`, `AuthProvider`        |
| Types / Enums        | PascalCase        | `UserRole`, `AuthStatus`             |
| Props types          | ComponentProps    | `ButtonProps`, `UserCardProps`        |
| Custom hooks         | use + Action      | `useAuth`, `useFetchUsers`           |
| Context              | PascalCase + Ctx  | `AuthContext`, `ThemeContext`         |
| Booleans             | is/has/can/should | `isEnabled`, `hasPermission`         |
| Arrays               | plural nouns      | `users`, `products`                  |
| Utility files        | kebab-case        | `date-utils.ts`, `api-helpers.ts`    |
| Test files           | *.test / *.spec   | `auth.test.ts`, `utils.spec.ts`      |

- Never use barrel exports (`index.ts`) — direct imports only

## Shell (Zsh)

| Element              | Convention                   | Example                          |
|----------------------|------------------------------|----------------------------------|
| Files                | kebab-case + numeric prefix  | `00-setup.zsh`, `01-options.zsh` |
| Functions            | snake_case with `::` ns      | `module::function_name`          |
| Local variables      | snake_case                   | `branch_count`, `interactive_mode` |
| Environment vars     | SCREAMING_SNAKE_CASE         | `XDG_CONFIG_HOME`                |
| Aliases              | lowercase abbreviated        | `gst`, `gpl`, `v`               |
| Completion functions | `_` prefix                   | `_gf`, `_gmrc`                   |

## General

| Element         | Convention  | Example                          |
|-----------------|-------------|----------------------------------|
| Directories     | kebab-case  | `conf.d/`, `core/`, `plugins/`   |
| Config files    | kebab-case  | `appearance.conf`, `fonts.conf`  |

- Prefer single quotes unless interpolation is needed
- Section headers: `# ===...===` (shell) or `-- ===...===` (Lua)

# Mandatory Code Rules

- **Guard clauses ALWAYS** — before writing `if (x) { ...long block... } return`, flip to `if (!x) return` + flat logic. Evaluate both forms, pick the one that exits early. Nested ifs → sequential guards. Happy path at lowest indentation. All languages, no exceptions.

- **NEVER `sleep` to poll workflows** — no `sleep N && gh run view`, no `while/sleep` loops. Use GitHub MCP tools (`pull_request_read`, `get_commit`) or `gh run watch --exit-status` for real-time status. All agents, no exceptions.

- **NEVER swallow errors** — no empty `catch {}`, no `catch (_) { /* ignore */ }`, no `catch` that does nothing with the error. Every error MUST be handled: log it (minimum `console.warn`), re-throw it, propagate it, or return it. Decide what the caller needs — most of the time the error should crash, propagate, or be logged at warning+. Silent swallowing is ALWAYS a bug. All languages, all agents, no exceptions.
