# Team Communication Protocols

> Message protocol reference for phase-based team communication.
> This file is loaded by: Lead Agent, Planification Agent, Test Agent, Code Agent, Code Review Agent, Security Agent.
> All messages use `SendMessage` with `type: "message"`. Content is a prefix keyword + JSON payload.

---

## Phase A — Planning & Testing Team

Team name pattern: `<session>-phase1-iter<N>`

| Message | Sender | Receiver | Trigger |
|---------|--------|----------|---------|
| `TASK_SPEC_READY` | planification | test-agent | Each task item spec completed |
| `ALL_SPECS_COMPLETE` | planification | test-agent | All task items planned |
| `SPEC_FEEDBACK` | test-agent | planification | Spec gap found while writing tests |
| `SPEC_CLARIFICATION` | planification | test-agent | Response to SPEC_FEEDBACK |

### TASK_SPEC_READY

Sent incrementally as each task spec is ready. Test Agent starts writing tests immediately.

```
TASK_SPEC_READY: {
  "taskItem": <TaskItem>,
  "testingBriefItem": <TestingBriefItem>
}
```

### ALL_SPECS_COMPLETE

Sent after all task items are planned. Test Agent cross-checks coverage and finalizes output.

```
ALL_SPECS_COMPLETE: {
  "taskCount": <number>,
  "executionPlan": <ExecutionPlan>,
  "reuseMap": <ReuseMap>
}
```

### SPEC_FEEDBACK

Sent when the Test Agent discovers a gap while writing tests.

```
SPEC_FEEDBACK: {
  "taskId": "<string>",
  "gap": "<description of the gap>",
  "question": "<specific question>"
}
```

### SPEC_CLARIFICATION

Response to SPEC_FEEDBACK.

```
SPEC_CLARIFICATION: {
  "taskId": "<string>",
  "feedbackRef": "<original gap description>",
  "clarification": "<answer or updated spec detail>"
}
```

---

## Phase B — Implementation & Quality Team

Team name pattern: `<session>-phase2-iter<N>`

| Message | Sender | Receiver | Trigger |
|---------|--------|----------|---------|
| `IMPL_COMPLETE` | code-agent-* | code-review, security | Code Agent finished its task |
| `FIX_REQUIRED` | code-review / security | code-agent-* | Quick-fix issue found during review |
| `FIX_APPLIED` | code-agent-* | code-review / security | Fix implemented |
| `FIX_VERIFIED` | code-review / security | code-agent-* | Fix confirmed correct |
| `FIX_REJECTED` | code-review / security | code-agent-* | Fix insufficient, re-attempt needed |

### IMPL_COMPLETE

Sent by each Code Agent when it finishes its assigned task.

```
IMPL_COMPLETE: {
  "taskId": "<string>",
  "filesChanged": ["<string>"],
  "filesCreated": ["<string>"],
  "testResults": {
    "total": <number>,
    "passed": <number>,
    "failed": <number>
  }
}
```

### FIX_REQUIRED

Sent by review/security agents for quick-fix severity issues. Max 3 fix cycles per issue.

```
FIX_REQUIRED: [{
  "issueId": "<REV-NNN or SEC-NNN>",
  "type": "<issue type>",
  "severity": "quick-fix",
  "file": "<string>",
  "line": <number | null>,
  "description": "<what is wrong>",
  "suggestedFix": "<actionable fix instruction>"
}]
```

### FIX_APPLIED

Sent by Code Agent after applying requested fixes.

```
FIX_APPLIED: {
  "issueIds": ["<string>"],
  "filesChanged": ["<string>"]
}
```

### FIX_VERIFIED

Sent by review/security agent after confirming the fix is correct.

```
FIX_VERIFIED: {
  "issueIds": ["<string>"]
}
```

### FIX_REJECTED

Sent by review/security agent when a fix is insufficient. Code Agent must re-attempt.

```
FIX_REJECTED: {
  "issueId": "<string>",
  "reason": "<why the fix is insufficient>",
  "cycleCount": <number>
}
```

---

## Escalation Messages (Phase B)

For **significant** or **critical** issues that cannot be resolved via the inner fix loop, review/security agents create escalation tasks in the shared task list instead of sending messages to Code Agents. The Lead Agent reads these after the phase completes.

Escalation task format (created via `TaskCreate`):
- Subject: `ESCALATION: <issue type> — <brief description>`
- Description: Full issue details including `issueId`, `file`, `line`, `description`, `suggestedFix`, `severity`
- Status: `pending` (Lead Agent handles in Phase C)

---

## Shutdown Protocol

All agents respond to `shutdown_request` messages from the Lead Agent:

1. Lead sends `SendMessage` with `type: "shutdown_request"` to each teammate
2. Each teammate responds with `SendMessage` `type: "shutdown_response"` with `approve: true`
3. After all responses received, Lead calls `TeamDelete()`

Agents MUST approve shutdown when:
- Their assigned task is marked completed in the shared task list
- OR they receive a shutdown request (graceful exit — save any pending state to task metadata first)

---

## Task Metadata Transport

Between phases, structured outputs are stored in shared task list metadata:

| Data | Written By | Read By | Storage |
|------|-----------|---------|---------|
| `PlanificationOutput` | planification | Lead Agent | PLAN task metadata |
| `TestAgentOutput` | test-agent | Lead Agent | TEST task metadata |
| `CodeAgentOutput` | code-agent-* | Lead Agent | IMPL-PLAN-NNN task metadata |
| `ReviewAgentOutput` | code-review | Lead Agent | REVIEW task metadata |
| `SecurityAgentOutput` | security | Lead Agent | SECURITY task metadata |

Agents write outputs to task metadata via `TaskUpdate` with the `metadata` parameter before marking their task as completed.

The Lead Agent reads all metadata **before** calling `TeamDelete()`, as team deletion removes the task list.
