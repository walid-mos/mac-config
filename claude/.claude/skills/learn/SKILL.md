---
name: learn
description: >-
  Create or update Claude Code skills. Use when the user runs /learn, wants to
  teach a new rule or coding convention, create a skill for a package, or sync
  an existing skill with codebase changes.
user-invocable: true
argument-hint: "[rule or topic]"
---

# Learn - Skill Creator & Updater

Create new skills, update existing ones, or add rules to skills. Three modes: **rule**, **new**, **update**.

## Skills directory

Locate the skills directory dynamically:
```bash
find ~ -name "SKILL.md" -path "*/.claude/skills/*" | head -1
# Extract the parent-parent directory: that is the skills root
```
The path is machine-specific (e.g. `~/.stow_repository/claude/.claude/skills/` on this machine). Never hardcode it across machines.

## Mode Detection

### Step 1 - Parse $ARGUMENTS

If $ARGUMENTS describes a coding rule or preference (imperative language: "use X", "never Y", "always Z", "prefer", "avoid", "ban", "no X", "don't"):
--> **Rule mode**

Otherwise, continue to Step 2.

### Step 2 - Detect project context

1. Read `package.json` (or equivalent manifest) to get the package name
2. List existing skills by running `ls` on the skills directory (resolved above)
3. Match the current package against skill names and descriptions (read frontmatter of candidates)
4. Decision:
   - **Matching skill found** --> **Update mode**
   - **No matching skill** --> **New skill mode**

---

## Rule Mode

Add a rule to an existing skill.

### Workflow

1. **Identify the target skill** from the rule's domain. Match keywords in $ARGUMENTS against existing skill names (js/javascript --> `javascript`, ts/typescript --> `typescript`, react/component/jsx --> `react`, test/testing --> `test`, general/coding --> `coding`, etc.). Auto-decide on a clear match. If still ambiguous after keyword matching, ask the user which skill to target before proceeding.

2. **Read the target skill** - load the full SKILL.md to understand its structure, existing rules, numbering, and formatting.

3. **Check for duplicates** - if the rule already exists or contradicts an existing rule, flag it to the user instead of adding blindly.

4. **Generate the rule** in the skill's exact format:
   - Match the numbering scheme (RULE N, numbered list, table row)
   - Include FORBIDDEN/MANDATORY code examples if the skill uses that pattern
   - Keep the same voice and style
   - Place the rule in the logical section (rules list, quick reference table, or as a new numbered rule)

5. **Apply the edit** - use the Edit tool to add the rule. If the skill has both a rules section AND a quick reference table, update both.

6. **Verify placement** - re-read the edited section to confirm correct placement and formatting. Do not report success without checking.

7. **Summarize** what was added and where.

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

2. **Check for partial matches** - before creating, re-scan the skills directory for any skill whose name or description partially matches the package. If found, switch to Update mode instead.

3. **Offer to interview** - ask the user:
   > "I've read the codebase. Want me to grill you with questions to deepen the skill, or should I generate it from what I've found?"

   If yes, call the **Skill tool** with `skill="interview"` and focus the interview on:
   - What patterns should the skill enforce?
   - What are common mistakes to avoid?
   - What non-obvious conventions exist?
   - What integration patterns matter most?

   Do not just write `/interview` in text - invoke the Skill tool.

4. **Generate the files** - create `<skills-root>/<name>/`. SKILL.md is the entry point (frontmatter + overview + rules); reference files hold deep content. See `## Skill Conventions` below for structure and quality bar.

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

5. **Record the sync point** - `synced-at` in frontmatter stores the HEAD commit of the project at generation time. If the project has no git history, set `synced-at` to the current date in `YYYY-MM-DD` format and note it is date-based.

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

### Structure template

```
---
name: <skill-name>
description: >-
  <What it does, 1 sentence. Use when <triggers>, 1 sentence.>
user-invocable: true          # omit if internal only
argument-hint: "[hint]"       # omit if no args
synced-at: <git-sha or YYYY-MM-DD>  # package skills only
---

# <Title>

<2-3 line overview>

## <Section>
...

## Rules
1. ...
```

### Description = the always-on cost

The frontmatter `description` is the ONLY thing loaded into every session (it sits in the always-on skill list) and is the sole trigger signal. Treat it as permanent tax:
- 3rd person. First sentence = what the skill does; second = `Use when <concrete triggers>` (slash command, keywords, file globs, package names).
- Keep it tight - drop feature enumerations and implementation internals (those belong in the body). If two skills could fire for the same intent, make each description say which one owns it.

### Progressive disclosure = the per-call cost

The SKILL.md **body** loads in full on every invocation; **sub-files** load only when the body points to them.
- Keep INLINE: the rules/imperatives plus a FORBIDDEN/MANDATORY quick-reference table - that is what makes the skill get followed.
- Move OUT to a `<topic>.md` sub-file: long code examples, edge-case catalogues, rarely-needed detail. Reference sub-files one level deep (a sub-file never links to another sub-file).
- Single ownership: never restate another skill's rule - cross-reference its owner (brand tokens -> nextnode-design, DRY/SOLID -> coding, status table -> track). No time-sensitive claims ("ends 2025-…"): state the current reality.

### FORBIDDEN / MANDATORY

| NEVER | ALWAYS |
|---|---|
| Single-file SKILL.md over 200 lines without sub-files | Split large content into `<topic>.md` reference files |
| Omit `synced-at` for package-documentation skills | Include it; use date if no git history |
| Put rules anywhere but the last section of SKILL.md | Rules section is last, numbered, actionable |
| Omit `>-` for multiline frontmatter descriptions | Use `>-` block style |
| Report rule added without re-reading the edited section | Verify placement by re-reading after every Edit |
| Create a new skill without checking for a partial match first | Scan the skills directory; switch to Update mode if match found |
| Description that enumerates features / implementation internals | One sentence "what" + one sentence "Use when <triggers>" |
| Restate a rule another skill owns | Cross-reference the owner in one line |
| Long code examples / edge-case catalogues in the body | Keep rules + quick-ref table inline; move examples to a `<topic>.md` |
