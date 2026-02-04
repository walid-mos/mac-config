# Investigation Report: [Issue Title]

**Date:** [Date]
**Issue:** [Brief description of reported problem]

---

## Symptoms Observed

- [What user reported]
- [What was reproduced during investigation]
- [Error messages verbatim]

---

## Evidence Gathered

### Source Analysis

**Files examined:**
- `path/to/file.ts` - [What was found]
- `path/to/other.ts` - [What was found]

**Data flow:**
```
[Trace how data moves through the system]
Input → Component A → Component B → Output (breaks here)
```

### Runtime Inspection

**Console output:**
```
[Relevant console logs/errors]
```

**Network requests:**
- `POST /api/endpoint` - [Status, response summary]

**Browser state:**
- [DOM state, component state, etc.]

### Documentation Check (Context7)

**Library/API:** [Name and version]
**Expected behavior:** [What docs say should happen]
**Actual behavior:** [What's happening instead]
**Breaking changes:** [Any relevant version changes]

### Historical Context (claude-mem)

**Related past work:**
- [Observation ID] - [Summary of related issue/decision]

**Patterns found:**
- [Any recurring issues or relevant decisions]

### Recent Changes (git)

**Commits in affected area:**
```
[git log output for relevant files]
```

**Suspicious changes:**
- [Commit hash] - [Description of potentially related change]

---

## Root Cause Analysis

### Hypothesis

[Clear, specific statement of what is broken and why]

### Confidence Level

**[High / Medium / Low]**

### Supporting Evidence

1. [Evidence point 1 - reference specific finding above]
2. [Evidence point 2]
3. [Evidence point 3]

### Alternative Hypotheses Considered

| Hypothesis | Why Ruled Out |
|------------|---------------|
| [Alt 1] | [Reason] |
| [Alt 2] | [Reason] |

---

## Proposed Fix Plan

### Files to Modify

| File | Line | Change |
|------|------|--------|
| `path/to/file.ts` | 123 | [Description of change] |
| `path/to/other.ts` | 45-50 | [Description of change] |

### Implementation Steps

1. [Step 1 - specific action]
2. [Step 2 - specific action]
3. [Step 3 - specific action]

### Code Changes (Pseudocode)

```typescript
// Before
[current code]

// After
[proposed code]
```

### Verification

**Command to verify fix:**
```bash
[test command]
```

**Expected result:**
[What successful fix looks like]

**Manual verification steps:**
1. [Step 1]
2. [Step 2]

---

## Risk Assessment

### Potential Side Effects

- [Risk 1 and mitigation]
- [Risk 2 and mitigation]

### Rollback Strategy

```bash
[Commands to rollback if needed]
```

### Areas Requiring Extra Testing

- [Area 1]
- [Area 2]

---

## Notes

[Any additional observations, warnings, or context for implementation]

---

**Investigation Status:** Complete
**Ready for Implementation:** Yes / No (reason if no)
