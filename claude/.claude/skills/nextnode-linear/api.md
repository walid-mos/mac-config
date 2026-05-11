# Linear API patterns

Direct GraphQL via curl. NO MCP - too heavy for a single-purpose integration.

## Endpoint and auth

- URL: `https://api.linear.app/graphql`
- Auth header: `Authorization: $LINEAR_API_KEY`
  - **NEVER** add `Bearer ` prefix - Linear personal API keys reject Bearer
  - Linear returns a clear error if you make this mistake

## Storing the key

The `LINEAR_API_KEY` MUST be:
- Stored in `~/.config/zsh/secrets` with `chmod 600`
- Sourced from `~/.zshenv` (NOT `.zshrc`)

Why `.zshenv`: it is loaded for all shells including non-interactive ones. Claude Code hooks, shell scripts, and `bash -c` calls all run non-interactively. `.zshrc` is interactive-only.

The user's `~/.zshenv` should contain:

```sh
[[ -f ~/.config/zsh/secrets ]] && source ~/.config/zsh/secrets
```

## Simple query (no special chars)

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{"query":"{ viewer { name email } }"}' | jq
```

## Simple mutation (inline values)

For mutations with short ASCII-safe inputs:

```bash
curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: $LINEAR_API_KEY" \
  -d '{"query":"mutation { issueDelete(id: \"abc-123\") { success } }"}'
```

## Complex mutation - use Python

When the mutation contains multi-line strings, accents, special characters, or you need to issue many requests, use Python's stdlib (no `pip install` needed):

```python
#!/usr/bin/env python3
import json
import os
import urllib.request

API_KEY = os.environ['LINEAR_API_KEY']

def call(query):
    body = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(
        "https://api.linear.app/graphql",
        data=body,
        headers={"Content-Type": "application/json", "Authorization": API_KEY},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8"))

def make_mutation_inline(operation, input_dict, return_fields):
    """Inline values into the mutation string via json.dumps for proper escaping.
    Avoids GraphQL typed variables (which contain `!` and break in shells).
    """
    fields = ", ".join(
        f"{k}: {json.dumps(v)}" if isinstance(v, str) else f"{k}: {v}"
        for k, v in input_dict.items()
    )
    return f"mutation {{ {operation}(input: {{ {fields} }}) {{ {return_fields} }} }}"

# Example usage:
query = make_mutation_inline(
    "issueCreate",
    {
        "title": "Add SEO meta tags",
        "description": "Multi-line\ndescription with accents éèà",
        "priority": 2,
        "projectId": "abc-123",
        "teamId": "def-456",
    },
    "success issue { id identifier title }"
)
result = call(query)
```

Why inline rather than GraphQL variables: typed variable declarations like `$input: IssueCreateInput!` contain `!`, which triggers shell history expansion in interactive zsh/bash. Even strict-quoted heredocs (`<<'EOF'`) sometimes get bitten depending on the shell version. Inlining via `json.dumps` sidesteps the issue and is just as safe.

## Pagination

`issues`, `projects`, etc. paginate at 50/250 per page. Use `pageInfo`:

```graphql
{
  issues(first: 250, after: "<cursor>") {
    nodes { id title }
    pageInfo { hasNextPage endCursor }
  }
}
```

Loop until `hasNextPage = false`.

## Common mutations

```graphql
# projectCreate MUST include icon + color matching the project's domain (rules.md Rule 9):
projectCreate(input: {
  name: "...",
  teamIds: ["..."],
  description: "...",
  icon: ":package:",     # :package: | :bar_chart: | :gear: | :rocket: | :bust_in_silhouette:
  color: "#6366F1"        # paired with icon - see rules.md Rule 9 mapping
})
projectUpdate(id: "...", input: { name: "...", description: "..." })
projectArchive(id: "...")    # soft archive
projectDelete(id: "...")     # to trash, recoverable 30 days

issueCreate(input: { title: "...", description: "...", priority: 2, projectId: "...", teamId: "..." })
issueUpdate(id: "...", input: { stateId: "...", priority: 3 })
issueArchive(id: "...")      # soft archive (kept in workspace)
issueDelete(id: "...")       # to trash, recoverable 30 days

initiativeCreate(input: { name: "..." })
initiativeToProjectCreate(input: { initiativeId: "...", projectId: "..." })
```

## Hard delete vs trash

`issueDelete` and `projectDelete` move items to **trash**, recoverable for ~30 days via Linear UI Settings → Trash. There is no public mutation to permanently empty trash - the user must do it manually if they want immediate hard-delete.

When the user says "hard delete", warn them about this 30-day trash window so they know to empty it manually if needed.

## Bulk operations

Linear safely handles ~10 parallel requests. For bulk runs, use a worker pool of 8-10 with retry. Bulk runs (>10 mutations OR >2 min) MUST be detached - see [rules.md](rules.md) Rule 10 for the full pattern.

Launch pattern:

```bash
nohup python3 -u /tmp/claude/<task>/run.py > /tmp/claude/<task>/run.log 2>&1 &
disown
echo "Started PID $!"
```

### Worker pools (inside the detached script)

Bash with `xargs`:

```bash
cat ids.txt | xargs -n 1 -P 8 ./delete-one.sh
```

Where `delete-one.sh` is a small standalone shell script (not a function - exported functions break with bash 3.2 on macOS):

```bash
#!/bin/bash
id="$1"
result=$(curl -s -X POST https://api.linear.app/graphql \
  -H "Content-Type: application/json" \
  -H "Authorization: ${LINEAR_API_KEY}" \
  -d "{\"query\":\"mutation { issueDelete(id: \\\"$id\\\") { success } }\"}")
if echo "$result" | jq -e '.data.issueDelete.success == true' > /dev/null 2>&1; then
  echo "OK $id"
else
  echo "FAIL $id $result"
fi
```

For Python-based bulk, prefer a small worker pool with `concurrent.futures.ThreadPoolExecutor(max_workers=8)`.

## Filtering issues

Linear's filter syntax is rich. Useful patterns:

```graphql
# Active issues (not done/canceled) for a project:
issues(filter: {
  project: { id: { eq: "..." } },
  state: { type: { nin: ["completed", "canceled"] } }
}) { nodes { id } }

# Issues with no project (orphans):
issues(filter: { project: { null: true } }) { nodes { id } }

# Issues in a team filtered by label name:
issues(filter: {
  team: { key: { eq: "INT" } },
  labels: { some: { name: { eq: "Bug" } } }
}) { nodes { id } }
```

## Common errors and meanings

| Error message                                                                | Cause                                                |
|------------------------------------------------------------------------------|------------------------------------------------------|
| `Authentication required, not authenticated`                                 | Missing or wrong header - check no `Bearer ` prefix  |
| `It looks like you're trying to use an API key as a Bearer token`            | Same - remove `Bearer `                              |
| `Argument Validation Error`                                                  | Input rejected - check required fields, allowed enum values |
| `Unterminated string` (GraphQL syntax)                                       | Newlines or quotes not escaped in inlined query - switch to Python builder |
| `Cannot iterate over null (null)`                                            | jq path mismatch - check field name (camelCase, GraphQL field, not `pushed_at`) |
