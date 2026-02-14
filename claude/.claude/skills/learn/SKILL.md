---
name: learn
description: Analyze the current package and update (or create) its associated Claude skill with the latest patterns, APIs, and conventions.
argument-hint: [skill-name]
user-invocable: true
allowed-tools: AskUserQuestion, Read, Glob, Grep, Edit, Write, Bash
---

# Learn Skill — Package-to-Skill Synchronizer

Analyze the current package/project codebase and update the associated Claude Code skill with the latest patterns, APIs, conventions, and best practices extracted from the source code.

---

## Step 1 — Detect Current Package

Read the project identity from the current working directory:

1. Read `package.json` — extract `name`, `description`, `main`/`exports`, `scripts`
2. Read `nextnode.toml` if it exists — extract `project.name`, `project.type`
3. If neither exists, abort with a clear message: "No package.json or nextnode.toml found in the current directory."

Derive a **skill identifier** (kebab-case) from the package name:
- `@nextnode-solutions/dagger-pipeline` → `dagger-pipeline`
- `@nextnode-solutions/standards` → `standards`
- `my-tool` → `my-tool`

Strip the scope (`@nextnode-solutions/`, `@scope/`) to get the base name.

---

## Step 2 — Resolve Target Skill

### With argument: `/learn <skill-name>`

If the user provides a skill name as argument, use that directly as the target skill.

### Without argument: `/learn`

1. Glob `~/.claude/skills/*/SKILL.md` to list all existing skills
2. Try to match the skill identifier from Step 1 against existing skill directory names:
   - Exact match: `standards` → `~/.claude/skills/standards/`
   - Prefix match: `dagger-pipeline` → `~/.claude/skills/dagger/` (if `dagger` is the only prefix match)
   - Contains match: `eslint-config-nextnode` → could match `standards` if ambiguous
3. If exactly one match is found, use it
4. If multiple matches or no match, ask the user via AskUserQuestion:
   - Show the detected package name
   - List existing skills as options
   - Add a "Create new skill" option
   - The user picks the target skill or creates a new one

---

## Step 3 — Analyze the Package

Perform a deep read of the package source code. Adapt the analysis to the package type:

### For TypeScript/JS packages:

1. **Exports & API surface**: Read `package.json` `exports`/`main` fields, then read the entry files to extract all public exports (functions, classes, types, constants)
2. **Source structure**: Glob `src/**/*.ts` (or `src/**/*.tsx`) to understand the module layout
3. **Key patterns**: Read 5-10 core source files to extract:
   - Function signatures and their purpose
   - Class structures and inheritance patterns
   - Type definitions and interfaces
   - Configuration schemas (Zod, JSON Schema, etc.)
   - Error handling patterns
   - Naming conventions specific to this package
4. **Usage examples**: Check `README.md`, `examples/`, `tests/` for usage patterns
5. **Dependencies**: Read `package.json` `dependencies` and `peerDependencies` to understand the ecosystem
6. **Scripts**: Extract available commands from `scripts` in `package.json`

### For Dagger modules:

1. Read `dagger.json` for module metadata
2. Read all `@object()` classes and their `@func()` methods
3. Extract the module's public API and chaining patterns

### For other project types:

Adapt the analysis: read config files, entry points, and core source files.

---

## Step 4 — Diff Against Existing Skill

If updating an existing skill:

1. Read the current `SKILL.md` content
2. Compare what the skill currently documents vs what the source code actually contains
3. Identify:
   - **New**: APIs, patterns, types, or conventions in the code but not in the skill
   - **Changed**: Items documented in the skill but that have evolved in the code
   - **Removed**: Items documented in the skill that no longer exist in the code
   - **Unchanged**: Items that are still accurate

Present a concise summary to the user:
```
Package: @nextnode-solutions/standards (v2.1.0)
Skill: ~/.claude/skills/standards/SKILL.md

Changes detected:
  + New: `createConfig()` helper, `RuleSet` type, flat config support
  ~ Changed: `defineConfig` now accepts an array, ESLint 9 flat config format
  - Removed: `legacyExtends` option (deprecated in v2.0)
  = Unchanged: 12 items still accurate
```

Ask the user via AskUserQuestion:
- **Apply all changes** (Recommended) — update the skill with everything detected
- **Cherry-pick** — let the user choose which changes to apply
- **Review first** — show the full proposed update before applying

---

## Step 5 — Update or Create the Skill

### Updating an existing skill:

- Use **Edit** to surgically update sections — preserve structure and any manually written notes
- Add new sections for new APIs/patterns
- Update changed descriptions, signatures, examples
- Remove documentation for deleted APIs
- Keep the same frontmatter unless the description needs updating

### Creating a new skill:

Generate a complete `SKILL.md` following this template:

```markdown
---
name: <skill-identifier>
description: <package-description>. Use when working with <package-name>.
user-invocable: false
---

# <Package Name> Standards

## Overview
<Brief description of what the package does and when to use it.>

## Installation & Setup
<How to install and configure, extracted from README or package.json.>

## API Reference
<Public exports, function signatures, types — organized by module/concern.>

## Patterns & Best Practices
<Key patterns extracted from source code: how to use the APIs correctly.>

## Configuration
<Config schema, options, defaults — extracted from types/Zod schemas.>

## Common Pitfalls
<Anti-patterns or gotchas discovered from the source code.>
```

Adjust sections based on what the package actually provides — not every package needs every section. Keep it concise and actionable (this is a skill, not full API docs).

---

## Step 6 — Cascade to Dependent Skills

After updating the target skill, check if other skills reference it. This ensures that `/learn` on one package propagates changes everywhere.

### 6a. Identify dependent skills

Grep `~/.claude/skills/*/SKILL.md` for references to the updated package name (e.g., `@nextnode-solutions/standards`, `standards` skill). Known dependency graph:

| Updated Skill | Dependents |
|---------------|------------|
| `standards` | `nextnode-standards` (audit checks reference standards for config patterns, required deps, scripts) |
| `logger` | `nextnode-standards` (optional package recommendation) |
| `email-manager` | `nextnode-standards` (optional package recommendation) |
| `nextnode` | `nextnode-standards` (references nextnode for toml config, CI templates) |
| `nextnode-infra` | `nextnode` (cross-references infra for CLI/deployment details) |

### 6b. Check for stale references

For each dependent skill:

1. Read the dependent skill's `SKILL.md`
2. Check if it contains any **hardcoded information** that should come from the updated skill instead
3. Specifically look for:
   - Package version numbers that have changed
   - API references, function names, or type definitions that have changed
   - Config patterns or extends paths that have changed
   - Dependency lists that have changed

### 6c. Update dependent skills

If stale references are found:

1. Use **Edit** to fix them — replace hardcoded details with references to the source skill, or update the hardcoded values
2. Report what was cascaded:

```
Cascade updates:
  → nextnode-standards: updated required peer deps list (oxlint → oxlint + oxfmt)
  → nextnode: no stale references found (already references standards skill)
```

If no cascade updates are needed, report:

```
Cascade check: no dependent skills need updating.
```

---

## Step 7 — Confirm & Report

After applying changes (including cascade):

1. Show the user what was updated with a brief summary
2. List any cascade updates that were applied
3. If a new skill was created, remind them it will be auto-loaded based on the `autoload-dirs` or matched by name
4. Suggest running `/learn` again after the next significant package update

---

## Guidelines

- **Be concise**: Skills are injected into the system prompt — every line costs context. Favor terse, actionable rules over verbose explanations.
- **Extract real patterns**: Don't just list function signatures. Identify how they're meant to be used together, common combinations, and implicit conventions.
- **Preserve manual edits**: If the existing skill has hand-written notes or rules not derivable from source code, keep them. Only remove what is provably outdated.
- **Code examples**: Include short, representative examples — prefer real patterns from the package's own tests over invented examples.
- **Version awareness**: If `package.json` has a version, note it in the skill so future runs can detect version bumps.
- **DRY across skills**: Never duplicate package details in multiple skills. The package skill is the single source of truth. Other skills (like `nextnode-standards`) should reference it, not copy it.
