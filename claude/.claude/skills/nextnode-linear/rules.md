# Rules - full detail

## Rule 1 - Project creation

A Linear project MUST satisfy ONE of these conditions:

### 1.a - Tied to a GitHub repo (code deliverable)

The project corresponds 1:1 to either:
- A standalone repo (e.g., `nextnode-landing` ↔ project `NextNode Landing`)
- A specific package within a monorepo (e.g., `core/packages/infrastructure` ↔ project `NextNode Infrastructure`)

### 1.b - Tangible non-code deliverable

A real-world output that someone can point to:
- A client site delivered (handover signed)
- A hire (onboarding completed)
- An office setup completed
- A vendor onboarded with contracts signed

### MUST NEVER be a project

- Workflow / process tracking → skill or hook in `~/.claude/`
- Meta tracking ("how we manage Linear") → same
- One-shot admin checklist → either an issue in an existing project, OR an orphan task with no project

### Counter-example (a real mistake)

```
WRONG: Created project "Backlog Reconstruction" to track the work of building
backlogs for 12 other projects.
```

That is a workflow. The correct shape would have been:
- A `[P0-01] Reconstruct backlog from commit history` issue inside each target project, OR
- 12 orphan issues in the INT team with no project

## Rule 2 - Atomicity

Every issue must be:
- A self-contained PR (one concept, one merge)
- Verifiable on its own (you can ship it without shipping anything else)
- A single mental unit - no multi-step "and" titles

### FORBIDDEN

```
[P3-04] Add SEO meta tags AND fix the favicon
[P5-12] Migrate to Tailwind v4 + setup dark mode
[P2-08] Refactor logger and add HTTP transport
```

### MANDATORY

```
[P3-04] Add SEO meta tags
[P3-05] Fix the favicon
[P5-12] Migrate to Tailwind v4
[P5-13] Configure dark mode
[P2-08] Extract TransportInterface in logger.ts
[P2-09] Implement HTTP transport
```

### Phase size is flexible

Atomicity is a per-task rule, not a per-phase rule:
- A phase with 5 atomic tasks is fine
- A phase with 30 atomic tasks is fine
- A phase with 1 non-atomic "do everything" task is FORBIDDEN

## Rule 3 - Phase naming

Use the prefix `[P{N}-{step}] ` for issues that are part of a multi-phase plan.

Format:
- `N` - phase number, integer; `0` is reserved for setup/scaffolding tasks
- `step` - task index within the phase, 2-digit zero-padded (`01` to `99`)
- Numbering is per-project, NOT workspace-wide

Examples:
- `[P0-01] Reconstruct backlog from commit history`
- `[P1-01] Setup project skeleton`
- `[P1-02] Add CI pipeline`
- `[P10-08] Final launch checklist`

## Rule 4 - Project naming

| Category                    | Pattern             | Examples                                       |
|-----------------------------|---------------------|------------------------------------------------|
| Platform / tooling / infra  | `NextNode <X>`      | NextNode Infrastructure, NextNode Monitoring   |
| Products                    | Raw product name    | YSumAI, Kicked, Adiffi                         |
| Clients (CLI team)          | Raw client name     | Gardefroidclim, Fleurs d'Aujourd'hui           |

Rationale: the team name (SAS/INT/CLI) already provides context for products and clients. The `NextNode` prefix is reserved for platform/tooling so it can be spotted from a project list at a glance.

## Rule 5 - Decision tree (where work goes)

| Work type                                | Destination                                          |
|------------------------------------------|------------------------------------------------------|
| Code work tied to a repo                 | Issue in project tied to that repo                   |
| Multi-repo coordination                  | Linear Initiative                                    |
| Process / Claude Code automation         | Skill or hook in `~/.claude/`                        |
| Setup within a project                   | First issue `[P0-01]` of that project                |
| Cross-cutting one-shot admin             | Orphan issue OR issue in nearest existing project    |
| Tangible non-code deliverable            | New project (rule 1.b)                               |

## Rule 6 - Initiative usage

Linear Initiatives group multiple projects. Use them when several projects share a coordinated effort.

- Use: the `NextNode Core` Initiative groups the 6 INT projects that map to packages of the `core` monorepo.
- Do NOT use Initiatives to group unrelated projects "just for organization".
- Do NOT use Initiatives as fake projects for meta workflow.

## Rule 7 - Workflow states

All teams use the same workflow:

`Backlog → Todo → In Progress → In Review → Done`

Plus terminal cancel states: `Canceled`, `Duplicate`.

When migrating completed work into Linear from existing commit history, mark issues with state `Done` to preserve the history without making the project look unstarted.

## Rule 8 - Hard delete vs trash

`issueDelete` and `projectDelete` move items to **trash**, recoverable for ~30 days via Linear UI Settings → Trash. There is no public mutation to permanently empty trash - the user must do it manually.

When the user says "hard delete", warn them about this 30-day trash window so they know to empty it manually if needed.

## Rule 9 - Project visual identity (icon + color)

Every project MUST have an `icon` and a `color` set on creation. Same icon + same color across all projects of the same domain - visual scanning beats individual cuteness.

### Mapping (canonical)

| Domain                          | Team | Icon                    | Color (hex) | Color name |
|---------------------------------|------|-------------------------|-------------|------------|
| Packages (libs, npm)            | INT  | `:package:`             | `#6366F1`   | indigo     |
| Internal app                    | INT  | `:bar_chart:`           | `#0EA5E9`   | sky/cyan   |
| CI / Infrastructure             | INT  | `:gear:`                | `#14B8A6`   | teal       |
| SaaS / Product / App            | SAS  | `:rocket:`              | `#A855F7`   | purple     |
| Client deliverable              | CLI  | `:bust_in_silhouette:`  | `#F97316`   | orange     |

Icons use Linear's emoji shortcode format (`:name:`), NOT raw Unicode.

### Domain decision

Pick the domain BEFORE creating the project - match the artifact, not the team alone:

- Does it ship to npm or live as a `core/packages/<x>` library? → **Packages**
- Is it an internal-facing app/dashboard NextNode operates? → **Internal app**
- Is it CI tooling, deploy scripts, infra orchestration? → **CI / Infrastructure**
- Is it a customer-facing product/SaaS/marketing site? → **SaaS / Product / App**
- Is it a deliverable for a specific external client? → **Client deliverable**

### FORBIDDEN

```
projectCreate(input: { name: "NextNode Foo", teamIds: [...] })
# No icon, no color - leaves the project visually unidentifiable.

projectCreate(input: { name: "Acme Co", icon: ":sparkles:", color: "#EAB308" })
# Custom icon for a client - breaks the per-domain unification.
```

### MANDATORY

```
# A new INT package (e.g., adding `core/packages/cache`):
projectCreate(input: {
  name: "NextNode Cache",
  teamIds: ["<INT_team_id>"],
  icon: ":package:",
  color: "#6366F1"
})

# A new SaaS product:
projectCreate(input: {
  name: "NewProduct",
  teamIds: ["<SAS_team_id>"],
  icon: ":rocket:",
  color: "#A855F7"
})

# A new client:
projectCreate(input: {
  name: "Acme Co",
  teamIds: ["<CLI_team_id>"],
  icon: ":bust_in_silhouette:",
  color: "#F97316"
})
```

The same rule applies to `projectUpdate` when adopting an existing project that lacks icon/color, or when reclassifying a project's domain.

## Rule 10 - Detached execution for bulk operations

Bulk Linear runs (>10 mutations OR >2 minutes) MUST run detached. Inline waits that exceed the 5-minute prompt-cache TTL re-bill the full conversation context as a cache miss on every later turn - $10+ per turn at 700k tokens.

### FORBIDDEN

```bash
# Long inline run - cache evicts, every later turn re-bills full context
python3 -u run.py 2>&1 | tee run.log | tail -60

# Poll loop has the same problem
until grep -q "^Done" run.log; do sleep 5; done
```

### MANDATORY

```bash
# Write an idempotent script (queries server state, never trusts local memory)
nohup python3 -u run.py > run.log 2>&1 &
disown
echo "Started PID $!"
```

Then hand off to the user: `tail -50 run.log` for status.

The script MUST log one structured line per item (`OK <id>`, `FAIL <id> <err>`, `SKIP <id> already exists`) and be re-runnable without duplicates. Without idempotency, partial failures force Claude to re-read state into context - defeating the point.
