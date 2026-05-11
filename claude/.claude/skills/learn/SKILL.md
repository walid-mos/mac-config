---
name: learn
description: >-
  Create or update Claude Code skills. Use when the user says "/learn",
  wants to teach a new rule, create a skill for a package, or sync an
  existing skill with codebase changes.
user-invocable: true
argument-hint: "[rule or topic]"
---

# Learn - Skill Creator & Updater

Create new skills, update existing ones, or add rules to skills. Three modes: **rule**, **new**, **update**.

## Skills directory

All skills live in: `~/.stow_repository/claude/.claude/skills/<skill-name>/SKILL.md`

## Mode Detection

### Step 1 - Parse $ARGUMENTS

If $ARGUMENTS describes a coding rule or preference (imperative language: "use X", "never Y", "always Z", "prefer", "avoid", "ban", "no X", "don't"):
--> **Rule mode**

Otherwise, continue to Step 2.

### Step 2 - Detect project context

1. Read `package.json` (or equivalent manifest) to get the package name
2. List existing skills: `ls ~/.stow_repository/claude/.claude/skills/`
3. Match the current package against skill names and descriptions (read frontmatter of candidates)
4. Decision:
   - **Matching skill found** --> **Update mode**
   - **No matching skill** --> **New skill mode**

---

## Rule Mode

Add a rule to an existing skill.

### Workflow

1. **Identify the target skill** from the rule's domain. Match keywords in $ARGUMENTS against existing skill names (js/javascript --> `javascript`, ts/typescript --> `typescript`, react/component/jsx --> `react`, test/testing --> `test`, general/coding --> `coding`, etc.). If ambiguous, ask the user which skill to target.

2. **Read the target skill** - load the full SKILL.md to understand its structure, existing rules, numbering, and formatting.

3. **Check for duplicates** - if the rule already exists or contradicts an existing rule, flag it to the user instead of adding blindly.

4. **Generate the rule** in the skill's exact format:
   - Match the numbering scheme (RULE N, numbered list, table row)
   - Include FORBIDDEN/MANDATORY code examples if the skill uses that pattern
   - Keep the same voice and style
   - Place the rule in the logical section (rules list, quick reference table, or as a new numbered rule)

5. **Apply the edit** - use the Edit tool to add the rule. If the skill has both a rules section AND a quick reference table, update both.

6. **Summarize** what was added and where.

---

## New Skill Mode

Create a skill for a package or project that doesn't have one yet.

### Workflow

1. **Explore the project** systematically:
   - `package.json` - name, exports, entry points, dependencies, scripts
   - `README.md` - purpose, API, usage examples
   - Main entry point (`src/index.ts` or equivalent) - public API surface
   - Type definitions - exported interfaces and types
   - Tests - usage patterns, expected behaviors
   - Config files - options, defaults, environment variables

2. **Offer to interview** - ask the user:
   > "I've read the codebase. Want me to grill you with questions to deepen the skill, or should I generate it from what I've found?"

   If yes, invoke `/interview` focused on:
   - What patterns should the skill enforce?
   - What are common mistakes to avoid?
   - What non-obvious conventions exist?
   - What integration patterns matter most?

3. **Plan the file structure** - decide how to split content across files.

   SKILL.md is the entry point: overview, core workflow, essential concepts, rules. It references detail files for deep content. Follow the `react/` and `tdd/` patterns:

   ```
   skill-name/
   ├── SKILL.md          # Entry point: overview, arguments, instructions, rules, quick reference
   ├── api.md            # Full API reference (methods, signatures, options)
   ├── patterns.md       # Usage patterns, integration examples, recipes
   ├── types.md          # TypeScript interfaces and type definitions
   └── <topic>.md        # One file per major domain concept
   ```

   **Splitting rules**:
   - SKILL.md stays under ~200 lines - it's the map, not the territory
   - Each reference file covers ONE topic in depth (one concept = one file)
   - Reference from SKILL.md with `See [topic.md](topic.md)` links
   - Every file has a clear, descriptive name - no `misc.md` or `other.md`
   - Minimum 2 files (SKILL.md + at least one reference) for any non-trivial package

   **Examples from existing skills**:
   - `react/`: SKILL.md + composition.md, effects.md, state.md, hooks.md, patterns.md, jotai.md
   - `tdd/`: SKILL.md + tests.md, mocking.md, deep-modules.md, interface-design.md, refactoring.md

4. **Generate the files** - create `~/.stow_repository/claude/.claude/skills/<name>/`.

   **SKILL.md frontmatter**:
   ```yaml
   ---
   name: <package-or-topic-name>
   description: >-
     <What this skill covers. Mention the npm package name if applicable.
     Describe when to load it.>
   user-invocable: true
   synced-at: <current git commit hash of the project being documented>
   ---
   ```

   **SKILL.md body** - the overview and navigation layer:
   - Brief intro paragraph (what the package is, one sentence)
   - `## Arguments` - what arguments the skill accepts
   - `## Instructions` - Phase 1 (read project state), Phase 2 (provide guidance)
   - `## Installation` - how to install
   - Core concepts - summarize each topic with a link to its reference file
   - `## Rules` - numbered, actionable guidelines at the end
   - Quick reference table if applicable

   **Reference files** - the detail layer:
   - Full API reference with signatures, options, defaults, code examples
   - Usage patterns with real-world examples
   - Type definitions with all exported interfaces
   - One file per major domain concept

   **Quality bar**:
   - Every line teaches something or enforces something - no filler
   - Code examples use the correct language specifier
   - Tables for comparisons and options
   - Imperative voice ("Use X", not "You should use X")
   - Cross-reference related skills with `/skill-name` notation

5. **Record the sync point** - `synced-at` in frontmatter stores the HEAD commit of the project at generation time.

---

## Update Mode

Sync an existing skill with codebase changes since it was last written.

### Workflow

1. **Read the existing skill** - load SKILL.md and ALL reference files in the skill directory. Note the `synced-at` commit hash from frontmatter.

2. **Find what changed** in the project directory (not the stow repo):
   - If `synced-at` exists: `git log --oneline <synced-at>..HEAD` and `git diff <synced-at>..HEAD -- src/` (scoped to source files)
   - If `synced-at` is missing or the commit no longer exists: do a full comparison between skill content and current codebase (read the entry point, exports, types, tests)

3. **Analyze the diff** - focus on:
   - New exports or API additions
   - Changed function signatures or options
   - New configuration options
   - Removed or deprecated features
   - New patterns introduced by recent changes

4. **Update the skill files** - edit the appropriate files:
   - **SKILL.md**: update overview, add/remove topic links, update rules and quick reference
   - **Existing reference files**: update changed APIs, signatures, patterns, types
   - **New reference files**: create a new `<topic>.md` if the diff introduces a major new concept that deserves its own file
   - **Remove stale files**: delete reference files for features that no longer exist
   - Preserve existing structure - don't rewrite unchanged sections

5. **Bump synced-at** - update the `synced-at` field to the current HEAD commit of the project.

6. **Summarize** what was updated and why, with references to the relevant commits.

---

## Skill Conventions

Follow these rules when generating or editing skills:

1. **Multi-file by default** - SKILL.md is the overview (~200 lines max), reference files hold the depth. One file per major concept. Only trivial skills (pure workflow like `interview`) can be single-file.
2. **SKILL.md is the map** - summarize each topic in 3-5 lines, then link to the detail file with `See [topic.md](topic.md)`
3. **Reference files are self-contained** - each file covers one topic fully, with code examples, tables, and explanations. A reader should not need to jump between files.
4. **Frontmatter uses `>-`** for multiline descriptions
5. **Imperative voice** - "Use X", "Configure Y", never "You should"
6. **FORBIDDEN/MANDATORY** code examples for coding-rule skills
7. **Tables** for comparisons, options, quick reference
8. **Rules section at the end of SKILL.md** - numbered, actionable, specific
9. **Cross-reference** other skills with `/skill-name`
10. **`synced-at` in frontmatter** for package-documentation skills - always include it
