---
name: readme
description: "Analyze a project folder and generate a comprehensive README.md (human-focused, usage-centric) plus hierarchical CLAUDE.md files (agent-focused, non-discoverable info only). Use when you need to document a project from scratch or refresh stale docs."
user-invocable: true
argument-hint: "<path-to-project-folder>"
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Task, AskUserQuestion
---

# /readme — Project Documentation Generator

You analyze a project folder in depth and produce two deliverables:

1. **README.md** — Human-readable, extremely complete, focused on **how to use the product**
2. **Hierarchical CLAUDE.md files** — Agent-readable, scoped per module, containing ONLY non-discoverable information (gotchas, landmines, non-obvious conventions)

You are NOT a template filler. You read actual source code, configs, and scripts to understand what the project does and how it works. Every claim in the generated docs must be backed by something you found in the codebase.

---

## Step 1 — Argument Parsing

**Invocation**: `/readme <path>` or `/readme` (defaults to current working directory)

- If `<path>` is provided, resolve it to an absolute path
- Validate the directory exists
- If no argument, use the current working directory

---

## Step 2 — Deep Project Analysis

Launch **parallel Explore agents** (via Task tool with `subagent_type: "Explore"`) to gather project intelligence. All 8 scans run concurrently. Each agent returns structured findings.

### 2a: Project Identity

Prompt the agent to find and read:
- `package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `composer.json`, `Gemfile`, `*.cabal`, `deno.json` — whichever exists
- Extract: name, version, description, license, author, repository URL
- Read the first 20 lines of existing `README.md` (if any) to capture the current project pitch
- Check for `.github/` metadata (FUNDING.yml, CODEOWNERS)

### 2b: Tech Stack & Dependencies

Prompt the agent to:
- Identify the language(s) and runtime(s)
- List production dependencies and their purposes (read import statements, not just lockfiles)
- List dev dependencies and categorize: testing, linting, building, tooling
- Identify frameworks: web (Express, Fastify, Astro, Next.js, Django, FastAPI...), UI (React, Vue, Svelte...), CSS (Tailwind, CSS modules...), ORM (Prisma, Drizzle, SQLAlchemy...)
- Identify build tools: Vite, webpack, esbuild, Turbopack, tsc, Rollup...

### 2c: Directory Structure & Architecture

Prompt the agent to:
- Map the top-level and first two levels of directory structure
- For each significant directory, describe its purpose (read a few files to understand, don't guess)
- Identify entry points: `main`, `index`, `app`, `server`, `cli`
- Identify the module/component organization pattern (domain-driven, feature-based, layer-based, etc.)
- Note any monorepo structure (workspaces, packages/)

### 2d: Scripts, CLI & Commands

Prompt the agent to:
- Read ALL scripts from `package.json` (or equivalent: `Makefile`, `justfile`, `taskfile.yml`, `pyproject.toml [tool.poetry.scripts]`, `Cargo.toml [[bin]]`)
- For each script, trace what it actually does (follow the command chain)
- Identify CLI entry points (bin field, __main__.py, main.go)
- Check for Docker commands (`docker-compose.yml`, `Dockerfile`)
- List all available user-facing commands with what they do

### 2e: Environment Variables & Configuration

Prompt the agent to:
- Read `.env.example`, `.env.sample`, `.env.template` (whichever exists)
- Grep source code for `process.env.`, `os.environ`, `env::var`, `viper.Get` to find ALL env vars actually used
- For each env var: name, purpose, required/optional, default value (if any), example value
- Read config files: `tsconfig.json`, `vite.config.*`, `next.config.*`, `astro.config.*`, `.eslintrc*`, `biome.json`, `prettier*`, `tailwind.config.*`, etc.
- Note which configs are standard/boring vs. have project-specific customizations worth documenting

### 2f: API Surface & Exports

Prompt the agent to:
- Find API endpoints (route definitions, controller decorators, handler registrations)
- For each endpoint: method, path, brief description, auth required?
- Find public module exports (for libraries: what does the user import?)
- Find WebSocket events, GraphQL schema, gRPC services if applicable
- Check for OpenAPI/Swagger specs

### 2g: Existing Documentation & Non-Discoverable Info

Prompt the agent to:
- Read ALL existing markdown files (README, CONTRIBUTING, CHANGELOG, docs/)
- Read code comments marked TODO, FIXME, HACK, WORKAROUND, XXX, NOTE
- Look for `.claude/CLAUDE.md`, `.cursor/rules`, `.github/copilot-instructions.md` — existing AI instructions
- Identify test quirks: special setup, fixtures, mocks that need explanation
- Identify build quirks: specific order of operations, known issues, workarounds
- Look for non-obvious conventions (naming patterns not enforced by linters, implicit dependencies between modules)
- Find "landmines": code that looks wrong but is intentional, or code that looks fine but is fragile

### 2h: Function Ownership Registry

Prompt the agent to:
- Identify functions that are the **single canonical owner** of a specific domain capability — meaning creating a second implementation would be a duplication bug
- Ownership is about **what the function does for the project**, not its name. There is no naming pattern that indicates ownership. You must read the code and understand the domain.
- Ask: "If an agent needed to [do X], is there already ONE function that handles this?" If yes, that's an ownership function.
- Common ownership domains (examples, not exhaustive): talking to a specific external service, managing a specific infrastructure resource, resolving environment/config, handling a specific business workflow end-to-end
- For each ownership function found: function name, file path, what domain it owns, why a duplicate would be harmful
- Also identify **ownership gaps** — the same capability done ad-hoc in multiple places instead of through one function (e.g., 5 files each calling the Cloudflare API directly instead of going through one wrapper)

---

## Step 3 — Synthesize & Confirm Scope

After all agents return:

1. **Merge** all findings into a unified project model
2. **Present a summary** to the user via AskUserQuestion:
   - "Here's what I found about your project: [2-3 sentence summary]. I'll generate README.md + CLAUDE.md files. Anything I should know that I might have missed?"
   - Options: "Looks good, proceed" / "Let me add context" (free text)
3. If the user adds context, incorporate it

---

## Step 4 — Generate README.md

Write `README.md` at the project root. Follow this structure **but only include sections that have real content** — never write empty sections or placeholder text.

### README Structure

```markdown
# Project Name

One-paragraph description of what this project does and who it's for.
Not a technical summary — a human pitch.

## Quick Start

The fastest path from zero to running. 3-5 commands max.
If it takes more, the project needs a better setup, not a longer README.

## Prerequisites

What needs to be installed before anything else works.
Version requirements if they matter. Links to installation guides.

## Installation

Step-by-step. Every command the user needs to run.
Include what to expect (output snippets) so users know it worked.

## Configuration

Every environment variable and config option the user might need to set.
Format as a table: Name | Description | Required | Default | Example

## Usage

THIS IS THE MOST IMPORTANT SECTION. It should be the longest.

### [Primary Use Case]

Real examples of the most common thing users do with this project.
Show the command/code AND the expected output.

### [Secondary Use Case]

More examples. Cover the 80% of what users actually do.

### [Advanced Use Case]

Power-user features. Less common but important.

### CLI Reference (if applicable)

Every command, every flag, with examples.
Format: `command --flag` — Description. Default: X.

### API Reference (if applicable)

Every endpoint or public function.
Format: `METHOD /path` — Description. Params. Returns.

## Architecture

Brief overview of how the project is organized.
A small directory tree with 1-line descriptions per folder.
Only include this if the structure isn't obvious.

## Development

How to set up a development environment.
How to run in development mode.
How to run tests (and what they test).
How to build for production.

## Deployment (if applicable)

How to deploy. Environment-specific instructions if needed.
Docker instructions if a Dockerfile exists.

## Troubleshooting

Common errors and their solutions.
Only include problems you found evidence of in the codebase
(error messages in code, issues mentioned in comments, known workarounds).

## Contributing (if applicable)

Only if there's a CONTRIBUTING.md or clear contribution patterns.

## License

One line: "Licensed under [LICENSE]" with link to LICENSE file.
```

### README Writing Rules

- **No fluff** — every sentence must convey information. Cut "This project is designed to..." → just say what it does.
- **Examples over explanations** — show, don't tell. A code block is worth a paragraph.
- **Real values in examples** — use realistic data, not `foo`/`bar`/`example.com`. Use plausible project-relevant values.
- **Test every claim** — if you say "run `npm start`", verify that script exists. If you say "set `DATABASE_URL`", verify the code reads that variable.
- **Link, don't repeat** — if there's a detailed doc elsewhere, link to it. Don't copy-paste.
- **No badges unless they provide information** — skip decorative badges. Build status and version badges are fine.
- **Code blocks have language tags** — always specify the language for syntax highlighting.
- **Output snippets** — after commands that produce output, show what the user should see.

---

## Step 5 — Generate Hierarchical CLAUDE.md Files

### Philosophy

CLAUDE.md is a **living list of codebase smells you haven't fixed yet**, NOT a project overview. Every line must be something an AI agent CANNOT discover by reading the code. If it can be found via grep, glob, or reading a config file — it does NOT belong in CLAUDE.md.

### What Belongs in CLAUDE.md

- Tooling gotchas ("biome ignores this folder because of X — don't try to lint it")
- Non-obvious conventions ("we use `handle*` prefix for event handlers but `on*` for callbacks — this is intentional")
- Landmines ("the `auth` middleware looks stateless but mutates a global cache — don't parallelize")
- Order-of-operations dependencies ("must run `generate` before `build` — the codegen output is gitignored")
- Test-specific knowledge ("integration tests require a running Postgres — use `docker compose up db` first")
- Historical decisions that look wrong but aren't ("we vendor this lib because the npm version has a bug in ESM mode")
- Implicit coupling between modules ("changing the User type requires updating both `api/` AND `worker/` — there's no shared types package yet")
- **Function ownership** — which function is THE canonical owner of a domain capability (see dedicated section below)

### What Does NOT Belong in CLAUDE.md

- Project description (that's in README)
- Tech stack listing (discoverable via package.json)
- Directory structure overview (discoverable via ls/glob)
- How to install or run (that's in README)
- Coding style rules (that's in linter config)
- Naming conventions (discoverable by reading the code)
- Generic best practices ("use meaningful variable names")
- Anything an agent can find by reading files

### Hierarchy Strategy

Create CLAUDE.md files at these levels (only when there's genuine content for that level):

1. **Root `CLAUDE.md`** — project-wide gotchas, cross-module coupling, build/test quirks
2. **Per major module** (e.g., `src/api/CLAUDE.md`, `src/workers/CLAUDE.md`) — module-specific landmines
3. **Per complex subdirectory** — only if it has genuinely non-obvious behavior

**Decision rule**: If a directory has zero non-discoverable information, do NOT create a CLAUDE.md for it. Empty or boilerplate CLAUDE.md files are worse than no file at all — they waste agent context budget.

### CLAUDE.md Format

```markdown
# <Directory/Module Name>

## Ownership Registry

Functions that are the SINGLE canonical owner of a domain capability.
Do NOT create alternatives — use these directly or extend them.

| Function | File | Owns | Notes |
|----------|------|------|-------|
| `upsertDnsDomain` | `src/infra/cloudflare.ts` | DNS record management on Cloudflare | Handles create + update idempotently |
| `resolveEnv` | `src/config/env.ts` | dev/staging/prod environment resolution | All env-dependent logic MUST go through this |
| `sendTransactional` | `src/email/transactional.ts` | Sending transactional emails via Resend | Don't use the Resend SDK directly elsewhere |

## Gotchas

- <Specific gotcha with context>

## Non-Obvious Conventions

- <Convention that can't be inferred from linters or code patterns>

## Implicit Dependencies

- <Things that break if you change X without also changing Y>
```

The **Ownership Registry** is the highest-priority section. It directly prevents the most common AI agent mistake: creating a duplicate function when a canonical one already exists. The table format is mandatory — it gives agents instant lookup.

**How to identify ownership functions during analysis (Step 2h):**
- Read the code and understand what it does. There is NO naming pattern that reliably indicates ownership.
- Ask: "If an agent needed to [do X], does this codebase already have ONE function that handles it?" If yes → ownership function.
- If you find the SAME capability implemented in 2+ places, flag it as an **ownership gap** in a separate note under the table.

Keep it terse. Bullet points. No prose paragraphs. Every bullet should make an agent go "oh, I would NOT have guessed that."

---

## Step 6 — Write Files

1. Write `README.md` at the project root (overwrite if existing — the user invoked the skill knowing this)
2. Write CLAUDE.md files at their respective locations
3. Present a summary: which files were created/updated, line counts

---

## Constraints

- **Never fabricate** — if you can't determine something from the codebase, omit it. Don't guess API endpoints, don't invent environment variables.
- **Preserve existing content judiciously** — if there's an existing README with user-written prose that your analysis can't improve on, keep it and enhance around it.
- **Don't over-CLAUDE.md** — it's better to have 1 excellent root CLAUDE.md than 15 empty ones. Only create per-module files when there's real non-discoverable content.
- **README is for humans, CLAUDE.md is for agents** — never mix the audiences. README should be readable by a new developer. CLAUDE.md should be actionable by an AI agent.
- **No CLAUDE.md for the root if the project is simple** — a 3-file project with a clear package.json needs zero CLAUDE.md files. Only document the non-obvious.

## Anti-Patterns

1. **NEVER generate a CLAUDE.md that restates discoverable information** — if it says "This project uses React and TypeScript" or "Tests are in the `__tests__/` folder", delete it. That's noise.
2. **NEVER write empty README sections** — if there's no API, don't include an "API Reference" section with "N/A". Just omit it.
3. **NEVER use placeholder text** — no "TODO: fill this in", no "Description goes here", no `example.com` URLs.
4. **NEVER copy-paste from package.json into README** — synthesize and explain, don't mirror data that's already in the repo.
5. **NEVER create CLAUDE.md files for simple/obvious directories** — a `utils/` folder with pure functions needs no CLAUDE.md.
6. **NEVER write CLAUDE.md as a project overview** — it's a landmine map, not a tour guide.
7. **NEVER skip the analysis phase** — you must read actual source code. Generating docs from package.json alone produces garbage.
8. **NEVER include generic best practices in CLAUDE.md** — "use guard clauses" and "prefer composition over inheritance" are not project-specific information.
9. **NEVER omit the Ownership Registry when ownership functions exist** — if the codebase has functions that canonically own a domain capability (DNS management, email sending, env resolution...), they MUST appear in the registry table. Missing ownership entries directly cause duplicate function creation by agents.
10. **NEVER list every function in the Ownership Registry** — only functions that are THE single canonical way to do something. A utility like `formatDate` is not an ownership function. `upsertDnsDomain` is, because creating a second DNS updater would be a bug.
