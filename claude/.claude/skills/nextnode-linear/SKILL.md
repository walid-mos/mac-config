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

## Instructions

When loaded, immediately:

1. Read [workspace.md](workspace.md) to know the active teams, projects, and their repo bindings.
2. Apply the rules below to any Linear action (create project, create issue, plan a backlog).
3. If creating multiple issues programmatically, use the patterns in [api.md](api.md).

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

## Core rules (summary)

1. **Project creation** - every project ties to a GitHub repo OR a tangible non-code deliverable. Nothing else.
2. **Atomicity** - every issue = one PR, one concept, verifiable alone. No "and"/"et"/"+".
3. **Phase naming** - use `[P{N}-{step}]` prefix for phased work (e.g., `[P3-04]`).
4. **Project naming** - `NextNode <X>` for platform/tooling/infra; raw name for products and clients.
5. **No MCP** - talk to Linear via direct GraphQL + curl. The MCP server is too heavy for a single-purpose integration.
6. **Visual identity** - every project MUST set `icon` + `color` on creation, matching its domain (see Rule 9).
7. **Detached bulk runs** - any bulk operation > ~10 mutations OR > ~2 minutes MUST run detached (`nohup … &`), never inline as a `Bash` tool call Claude waits on (see Rule 10). Inline waits cross the 5-minute prompt-cache TTL and re-bill the entire conversation context - the single biggest token-burn pattern with this skill.

Detailed examples and edge cases: [rules.md](rules.md).

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

## Rules

(See also: [rules.md](rules.md) for full detail with FORBIDDEN/MANDATORY examples.)

1. Before creating a project, ask: "Is there a tangible artifact at the end? Is it tied to a GitHub repo or a real-world deliverable?" If no to both → it is not a project.
2. Issue titles must be atomic. Reject any title containing "and"/"et"/"+" - split into multiple issues.
3. Phased work uses the `[P{N}-{step}] ` prefix. Numbering is per-project, not workspace-wide. Use `[P0-XX]` for setup tasks.
4. Platform/tooling/infra projects use `NextNode <X>` naming. Products and clients use raw names.
5. Talk to Linear via direct GraphQL (curl). Do NOT install or rely on a Linear MCP server.
6. `LINEAR_API_KEY` lives in `~/.config/zsh/secrets` and is sourced from `.zshenv` (NEVER `.zshrc`). Non-interactive shells (Claude Code hooks, scripts) need it.
7. For complex API calls with newlines or special characters, build the JSON via Python's `json.dumps`. Avoid bash heredocs for non-trivial mutations.
8. `issueDelete` and `projectDelete` send to trash (recoverable 30 days). For true hard delete, the user must empty the trash via Linear UI Settings → Trash.
9. Every project MUST have an `icon` and a `color` set on creation, matching its domain:

    | Domain                   | Icon                    | Color     |
    |--------------------------|-------------------------|-----------|
    | INT - Packages           | `:package:`             | `#6366F1` |
    | INT - Internal app       | `:bar_chart:`           | `#0EA5E9` |
    | INT - CI / Infrastructure | `:gear:`               | `#14B8A6` |
    | SAS - SaaS / Product     | `:rocket:`              | `#A855F7` |
    | CLI - Client deliverable | `:bust_in_silhouette:`  | `#F97316` |

    Same icon + same color across all projects of the same domain - visual scanning beats per-project decoration. See [rules.md](rules.md) Rule 9 for the full mapping and FORBIDDEN/MANDATORY examples.

10. Bulk runs (>10 mutations OR >2 minutes) MUST be executed detached (`nohup script.py > log 2>&1 &`), never inline as a Bash tool call Claude waits on. Inline waits cross the 5-minute prompt-cache TTL and re-bill the entire conversation context - easily $10+ per turn on a 700k-token session. Hand control back to the user with `tail -50 log` for status checks. The script MUST be idempotent (skip items already on Linear by querying server state). See [rules.md](rules.md) Rule 10 for FORBIDDEN/MANDATORY examples and [api.md](api.md) for the launch pattern.
