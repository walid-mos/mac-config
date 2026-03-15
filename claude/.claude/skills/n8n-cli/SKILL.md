---
name: n8n-cli
description: Manage n8n workflows on the NextNode automation instance with the local n8n-cli tool.
user-invocable: true
argument-hint: <list|get|create|update|activate|deactivate|execute|delete> [args]
autoload-dirs:
  - /Users/walid/Development/nextnode
  - /Users/walid/Development/saas
---

# n8n-cli Skill

Skill for managing n8n workflows using the n8n-cli command-line tool.

## Overview

The `n8n-cli` tool provides command-line access to manage n8n workflows on the NextNode instance (`https://automation.nextnode.fr`). It supports listing, creating, updating, activating, and executing workflows.

## Prerequisites

- `n8n-cli` must be installed at `~/.local/bin/n8n-cli`
- `N8N_API_KEY` environment variable must be set
- `jq` is recommended for formatted JSON output (optional)

## Available Commands

### List Workflows
```bash
n8n-cli list
```
Lists all workflows in the n8n instance with their IDs, names, and activation status.

### Get Workflow Details
```bash
n8n-cli get <workflow-id>
```
Retrieves detailed information about a specific workflow including nodes, connections, and settings.

### Create New Workflow
```bash
n8n-cli create <workflow-file.json>
```
Creates a new workflow from a JSON file. Returns the new workflow ID and URL.

**Example:**
```bash
n8n-cli create dripify-hubspot-full.json
```

### Update Existing Workflow
```bash
n8n-cli update <workflow-id> <workflow-file.json>
```
Updates an existing workflow while preserving metadata (name, tags, etc.).

**Example:**
```bash
n8n-cli update abc123 dripify-hubspot-full.json
```

### Activate/Deactivate Workflow
```bash
n8n-cli activate <workflow-id>
n8n-cli deactivate <workflow-id>
```
Enables or disables a workflow. Only active workflows can be triggered by webhooks.

### Execute Workflow Manually
```bash
n8n-cli execute <workflow-id>
```
Manually triggers a workflow execution for testing purposes.

### Delete Workflow
```bash
n8n-cli delete <workflow-id>
```
Permanently deletes a workflow (requires confirmation).

## Workflow Development Workflow

### 1. Initial Setup
```bash
# Check if CLI is working
n8n-cli list

# Find your workflow ID (if updating existing)
n8n-cli list | grep -i "workflow-name"
```

### 2. Export Current Workflow (for backup)
```bash
WORKFLOW_ID="your-workflow-id"
n8n-cli get $WORKFLOW_ID > backup-$(date +%Y%m%d).json
```

### 3. Modify Workflow
Edit the JSON file with your changes, or have the AI generate a new version.

### 4. Update Workflow
```bash
n8n-cli update $WORKFLOW_ID modified-workflow.json
```

### 5. Test Changes
```bash
# Activate if not already active
n8n-cli activate $WORKFLOW_ID

# Execute manually to test
n8n-cli execute $WORKFLOW_ID
```

### 6. Verify
```bash
# Check the workflow is running correctly
n8n-cli get $WORKFLOW_ID
```

## Common Patterns

### Creating a Webhook Workflow

1. **Generate the workflow JSON:**
   - Include a webhook node as the trigger
   - Set `httpMethod` to "POST"
   - Define a unique `path`

2. **Create the workflow:**
   ```bash
   n8n-cli create my-webhook-workflow.json
   ```

3. **Get the webhook URL:**
   - The webhook URL will be: `https://automation.nextnode.fr/webhook/{path}`
   - Example: `https://automation.nextnode.fr/webhook/dripify-webhook`

4. **Activate:**
   ```bash
   n8n-cli activate WORKFLOW_ID
   ```

### Updating Without Reimport

Instead of deleting and reimporting:

```bash
# Get current ID
ID=$(n8n-cli list | jq -r '.data[] | select(.name=="My Workflow") | .id')

# Update directly
n8n-cli update $ID updated-workflow.json
```

### Batch Operations

```bash
# Activate all inactive workflows
n8n-cli list | jq -r '.data[] | select(.active==false) | .id' | while read id; do
  n8n-cli activate $id
done
```

## Error Handling

Common errors and solutions:

### "N8N_API_KEY environment variable is not set"
**Solution:** Export your API key:
```bash
export N8N_API_KEY="n8n_api_your_key_here"
```

### "Workflow not found"
**Solution:** Verify the workflow ID:
```bash
n8n-cli list | grep -i "workflow-name"
```

### "Invalid JSON"
**Solution:** Validate the JSON file:
```bash
jq . workflow-file.json
```

## Security Best Practices

1. **Never commit API keys** to version control
2. **Use environment variables** for sensitive data
3. **Backup workflows** before major updates
4. **Test inactive workflows** before activating in production

## Integration with AI Workflows

When the user asks to:

- **"Create a new n8n workflow"** → Generate JSON → `n8n-cli create file.json`
- **"Update my workflow"** → Get ID → `n8n-cli update ID file.json`
- **"Check if my workflow is working"** → `n8n-cli get ID`
- **"Activate the workflow"** → `n8n-cli activate ID`

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `N8N_URL` | n8n instance URL | `https://automation.nextnode.fr` |
| `N8N_API_KEY` | API authentication key | Required |

## API Reference

The CLI uses the n8n REST API v1:
- Base URL: `$N8N_URL/api/v1`
- Authentication: `X-N8N-API-KEY` header
- Content-Type: `application/json`

## See Also

- n8n API Documentation: https://docs.n8n.io/api/
- NextNode n8n Instance: https://automation.nextnode.fr
