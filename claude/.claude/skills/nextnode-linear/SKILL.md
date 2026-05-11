---
name: nextnode-linear
description: >-
  Linear workspace conventions and rules for NextNode Solutions. Covers project
  creation rules, issue atomicity, phase naming, the team/project/repo map, and
  GraphQL API patterns (no MCP). Load when the user mentions Linear, when
  LINEAR_API_KEY is set in the environment, or when working in a repo of the
  GitHub `NextNodeSolutions` organization.
user-invocable: true
---

# nextnode-linear

Conventions for using Linear in NextNode Solutions: where work lives, how it's organized, and how to talk to the Linear API without MCP overhead.

## Arguments

- No argument: full overview, decision tree, and rules
- `rules`: detailed rules with examples - see [rules.md](rules.md)
- `workspace`: live workspace map (teams, projects, repos) - see [workspace.md](workspace.md)
- `api`: GraphQL API patterns and escaping gotchas - see [api.md](api.md)

## The decision tree

Before creating anything in Linear, answer this:

| Type of work                            | Where it goes                                         |
|-----------------------------------------|-------------------------------------------------------|
| Code work tied to a repo                | Issue in the project tied to that repo                |
| Multi-repo coordination                 | Linear Initiative grouping projects                   |
| Process / Claude Code automation        | Skill (`~/.claude/skills/`) or hook - NEVER Linear    |
| One-shot setup task within a project    | First issue `[P0-01]` of that project                 |
| Cross-cutting one-shot admin task       | Orphan issue (no project) or issue in nearest project |
| New tangible non-code deliverable       | New project (rule 1.b applies)                        |

Never create a Linear project just to track meta workflow. If it doesn't ship a code deliverable or a tangible non-code deliverable, it is not a project.

## Core rules

1. **Project creation** - ties to a GitHub repo OR a tangible non-code deliverable. Nothing else.
2. **Atomicity** - one issue = one PR, one concept, verifiable alone. No "and"/"et"/"+".
3. **Phase naming** - `[P{N}-{step}]` prefix (per-project numbering, `[P0-XX]` for setup).
4. **Project naming** - `NextNode <X>` for platform/tooling/infra; raw name for products and clients.
5. **No MCP** - direct GraphQL + curl. NEVER prefix auth header with `Bearer`.
6. **Visual identity** - `icon` + `color` set on creation, same pair across all projects of the same domain (see [rules.md](rules.md) Rule 9).
7. **Detached bulk runs** - >10 mutations OR >2 min MUST run via `nohup script.py > log 2>&1 &` (idempotent). Inline waits cross the 5-min prompt-cache TTL and re-bill the full context. See [rules.md](rules.md) Rule 10 + [api.md](api.md) launch pattern.

Full FORBIDDEN/MANDATORY examples: [rules.md](rules.md).

## Workspace at a glance

Org: **Nextnode Solutions** (urlKey: `nextnode`)

Teams:
- **SAS** (SaaS) - products
- **INT** (Internal) - platform / tooling / infrastructure
- **CLI** (Clients) - client work

12 projects active across the 3 teams. Full mapping with IDs in [workspace.md](workspace.md).

The `NextNode Core` Initiative groups the 6 INT projects that map to packages of the `core` monorepo.

## API quickstart

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{"query":"{ viewer { name email } }"}' | jq
```

NEVER prefix the auth header with `Bearer ` - Linear personal API keys reject Bearer.

For complex mutations (multi-line strings, accents, batch operations), use the Python helper pattern in [api.md](api.md). DO NOT build mutation strings via bash heredocs - the `!` in `String!` triggers shell history expansion.

`LINEAR_API_KEY` lives in `~/.config/zsh/secrets`, sourced from `.zshenv` (NEVER `.zshrc`) so non-interactive shells (hooks, scripts) see it.

`issueDelete` and `projectDelete` send to trash (recoverable 30 days). True hard delete is manual via Linear UI Settings → Trash.
