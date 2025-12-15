# Agent Design Guidelines

Guidelines for creating custom Claude Code agents.

---

## Core Principles

### Subagent Capability for Large Codebases

**RULE**: Agents that crawl or analyze large codebases MUST be able to spawn subagents.

**Why?**
- Full codebase analysis can fill context quickly
- Subagents allow parallelization and context isolation
- Prevents incomplete analysis due to context limits

**Requirements for codebase-crawling agents:**
1. Include `Task` in the agent's tools list
2. Document partitioning strategy (by directory, by file count, etc.)
3. Set threshold for when to parallelize (e.g., > 20 files)
4. Aggregate results from subagents before reporting

**Example (in agent definition):**
```yaml
tools: Read, Edit, Grep, Glob, Bash, Task  # Task enables subagents
```

**Pattern:**
```
1. Discover scope (count files)
2. If scope > threshold:
   - Partition files by directory or logical grouping
   - Spawn subagents IN PARALLEL (single message, multiple Task calls)
   - Each subagent handles a partition
3. Aggregate subagent results
4. Report consolidated findings
```

---

## Agent Definition Structure

```yaml
---
name: agent-name
description: Clear description of when to use this agent
tools: Read, Grep, Glob, Task  # Include Task for subagent capability
model: inherit  # or specific model
---

# Agent Name

Instructions for the agent...
```

---

## Best Practices

### Tool Selection

| Tool | Include When |
|------|--------------|
| `Read` | Agent needs to read file contents |
| `Edit` | Agent makes changes to files |
| `Grep` | Agent searches code patterns |
| `Glob` | Agent finds files by pattern |
| `Bash` | Agent runs shell commands |
| `Task` | Agent may need subagents for large scope |

### Context Management

- **Threshold Rule**: Set explicit file count threshold (recommended: 20 files)
- **Partitioning**: Group by directory structure for logical coherence
- **Progress Tracking**: Report X/Y files processed
- **Completion Guarantee**: Verify 100% coverage before reporting complete

### Output Guidelines

- Report findings in chat, not markdown files (unless requested)
- Use structured format for findings: `file:line - issue - severity`
- Aggregate subagent results into single consolidated report
