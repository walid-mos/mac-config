#!/usr/bin/env bash
# ============================================================
# swarm.sh — Deterministic shell orchestrator for /swarm
# ============================================================
#
# Replaces AI-based orchestration with deterministic shell logic.
# Receives inputs from SKILL.md, decomposes spec into batches,
# executes Phase A-D per batch, and returns a result JSON.
#
# Exit codes:
#   0 = success, result JSON at $TMPDIR/swarm-${SESSION_NAME}-result.json
#   1 = failure (unrecoverable)
#   2 = user input needed, blocker at $TMPDIR/swarm-${SESSION_NAME}-blocker.txt
#
# Note: claude -p calls are wrapped with env -u CLAUDECODE ... to
# prevent nested session detection when launched from Claude Code.
# ============================================================

set -euo pipefail

# ============================================================
# Global variables (set during argument parsing / init)
# ============================================================
SESSION_NAME=''
SPEC_PATH=''
TECH_STACK=''
SWARM_CONFIG=''
PROJECT_DIR=''
SKILLS_JSON=''
SKILL_AUDIT_JSON=''
RESUME=false

STATE_FILE=''
LOG_DIR=''
BLOCKER_FILE=''
RESULT_FILE=''
DONE_FILE=''
SCHEMA_DIR=''
PKG_MGR='npm'

# ============================================================
# swarm::log — Structured logging to stderr and log file
# ============================================================
swarm::log() {
  local timestamp
  timestamp=$(date '+%H:%M:%S')
  local msg="[SWARM ${timestamp}] $*"
  echo "$msg" >&2
  if [[ -n "${LOG_DIR:-}" ]] && [[ -d "$LOG_DIR" ]]; then
    echo "$msg" >> "${LOG_DIR}/swarm.log"
  fi
}

# ============================================================
# swarm::cleanup — Trap handler for SIGINT/SIGTERM
# ============================================================
swarm::cleanup() {
  swarm::log 'Caught signal, cleaning up...'

  # Kill any background child processes
  local children
  children=$(jobs -p 2>/dev/null || true)
  if [[ -n "$children" ]]; then
    swarm::log "Killing background processes: $children"
    echo "$children" | xargs kill 2>/dev/null || true
  fi

  # Persist current state (best effort)
  if [[ -n "${STATE_FILE:-}" ]] && [[ -f "$STATE_FILE" ]]; then
    swarm::log "State preserved at $STATE_FILE"
  fi

  swarm::log 'Cleanup complete, exiting'
  exit 1
}

# ============================================================
# swarm::write_done_file — EXIT trap: write done marker with exit code
# ============================================================
# The launcher uses this file to detect completion without polling.
# Written on ANY exit (success, failure, signal).
swarm::write_done_file() {
  local rc=$?
  if [[ -n "${DONE_FILE:-}" ]]; then
    echo "$rc" > "$DONE_FILE"
  fi
}

# ============================================================
# swarm::detect_pkg_mgr — Auto-detect package manager from lockfile
# ============================================================
swarm::detect_pkg_mgr() {
  if [[ -f "${PROJECT_DIR}/pnpm-lock.yaml" ]]; then
    PKG_MGR='pnpm'
  elif [[ -f "${PROJECT_DIR}/bun.lockb" ]] || [[ -f "${PROJECT_DIR}/bun.lock" ]]; then
    PKG_MGR='bun'
  elif [[ -f "${PROJECT_DIR}/yarn.lock" ]]; then
    PKG_MGR='yarn'
  else
    PKG_MGR='npm'
  fi
  swarm::log "Detected package manager: $PKG_MGR"
}

# ============================================================
# swarm::read_state — Read a value from state JSON
# ============================================================
# Usage: swarm::read_state '.currentIteration'
# Usage: swarm::read_state --argjson n 1 '.plannedBatches[] | select(.iteration == $n)'
# All positional args before the last one are passed to jq as flags.
# The last positional arg is the jq filter.
swarm::read_state() {
  local args=()
  # Collect jq flags (--arg, --argjson take 2 values each)
  while [[ $# -gt 1 ]]; do
    case "$1" in
      --arg|--argjson)
        args+=("$1" "$2" "$3")
        shift 3
        ;;
      *)
        break
        ;;
    esac
  done
  local jq_path="${1:-.}"
  if [[ ${#args[@]} -gt 0 ]]; then
    jq -r "${args[@]}" "$jq_path" "$STATE_FILE"
  else
    jq -r "$jq_path" "$STATE_FILE"
  fi
}

# ============================================================
# swarm::update_state — Apply a jq filter to the state file
# ============================================================
# Usage: swarm::update_state '.currentIteration = 2'
# Usage: swarm::update_state --argjson n 1 '.currentIteration = $n'
# All positional args before the last one are passed to jq as flags.
# The last positional arg is the jq filter.
swarm::update_state() {
  local args=()
  # Collect jq flags (--arg, --argjson take 2 values each)
  while [[ $# -gt 1 ]]; do
    case "$1" in
      --arg|--argjson)
        args+=("$1" "$2" "$3")
        shift 3
        ;;
      *)
        break
        ;;
    esac
  done
  local jq_filter="$1"
  local tmp_state="${STATE_FILE}.tmp"
  local jq_exit=0
  if [[ ${#args[@]} -gt 0 ]]; then
    jq "${args[@]}" "$jq_filter" "$STATE_FILE" > "$tmp_state" || jq_exit=$?
  else
    jq "$jq_filter" "$STATE_FILE" > "$tmp_state" || jq_exit=$?
  fi

  # Safety: never overwrite state with empty/invalid output
  if [[ "$jq_exit" -ne 0 ]] || [[ ! -s "$tmp_state" ]]; then
    swarm::log "ERROR: update_state failed (jq exit=$jq_exit, filter=$jq_filter)"
    rm -f "$tmp_state"
    return 1
  fi
  mv "$tmp_state" "$STATE_FILE"
}

# ============================================================
# swarm::init — Write initial state JSON
# ============================================================
swarm::init() {
  swarm::log 'Initializing state'

  local initial_state
  initial_state=$(jq -n \
    --arg session "$SESSION_NAME" \
    '{
      sessionName: $session,
      currentIteration: 0,
      plannedBatches: [],
      completedItems: [],
      pendingItems: [],
      blockedItems: [],
      iterationHistory: [],
      filesChanged: [],
      filesCreated: [],
      testsWritten: 0,
      testsPassing: 0,
      humanPrerequisites: [],
      retryCounters: {}
    }')

  echo "$initial_state" > "$STATE_FILE"
  swarm::log "State written to $STATE_FILE"
}

# ============================================================
# swarm::call_agent — Wrapper for all claude -p calls
# ============================================================
# All AI invocations go through this function.
# Options:
#   --agent <name>        Agent definition file (without extension)
#   --schema <file>       JSON schema file in SCHEMA_DIR
#   --prompt-file <path>  File containing the prompt
#   --log-prefix <name>   Prefix for log files
swarm::call_agent() {
  local agent='' schema='' prompt_file='' log_prefix='call'

  while [[ $# -gt 0 ]]; do
    case "$1" in
      --agent) agent="$2"; shift 2 ;;
      --schema) schema="$2"; shift 2 ;;
      --prompt-file) prompt_file="$2"; shift 2 ;;
      --log-prefix) log_prefix="$2"; shift 2 ;;
      *) shift ;;
    esac
  done

  if [[ -z "$prompt_file" ]]; then
    swarm::log 'ERROR: --prompt-file is required for call_agent'
    return 1
  fi

  if [[ ! -f "$prompt_file" ]]; then
    swarm::log "ERROR: Prompt file not found: $prompt_file"
    return 1
  fi

  local cmd=(claude -p --output-format json --verbose)
  cmd+=(--permission-mode bypassPermissions)
  cmd+=(--no-session-persistence)
  cmd+=(--cwd "$PROJECT_DIR")

  if [[ -n "$agent" ]]; then
    cmd+=(--agent "$agent")
  fi

  if [[ -n "$schema" ]]; then
    local schema_path="${SCHEMA_DIR}/${schema}"
    if [[ ! -f "$schema_path" ]]; then
      swarm::log "WARNING: Schema file not found: $schema_path — proceeding without schema"
    else
      local schema_content
      schema_content=$(cat "$schema_path")
      cmd+=(--json-schema "$schema_content")
    fi
  fi

  cmd+=(--model opus)

  local output_file="${LOG_DIR}/${log_prefix}-raw.jsonl"
  local stderr_file="${LOG_DIR}/${log_prefix}-stderr.log"

  swarm::log "Calling agent: agent=${agent:-none} schema=${schema:-none} prompt=${prompt_file}"

  # When a JSON schema is enforced, append a hard directive to the prompt
  # so the agent outputs ONLY the JSON object — no narrative, no fences.
  local effective_prompt="$prompt_file"
  if [[ -n "$schema" ]]; then
    effective_prompt="${prompt_file%.md}-effective.md"
    {
      cat "$prompt_file"
      printf '\n\n---\n\n'
      printf '## CRITICAL OUTPUT RULE\n\n'
      printf 'Your ENTIRE response MUST be a single valid JSON object matching the schema above.\n'
      printf 'Do NOT include ANY text before or after the JSON.\n'
      printf 'Do NOT wrap it in markdown code fences.\n'
      printf 'Do NOT add explanations, summaries, or commentary.\n'
      printf 'Output ONLY the raw JSON object. Nothing else.\n'
    } > "$effective_prompt"
  fi

  # Unset env vars that trigger nested session detection in claude -p
  local exit_code=0
  env -u CLAUDECODE -u CLAUDE_CODE_ENTRYPOINT -u CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS \
    "${cmd[@]}" < "$effective_prompt" > "$output_file" 2>"$stderr_file" || exit_code=$?

  if [[ "$exit_code" -ne 0 ]]; then
    swarm::log "ERROR: claude -p failed (exit $exit_code)"
    swarm::log "stderr: $(tail -20 "$stderr_file" 2>/dev/null || echo 'no stderr')"
    return 1
  fi

  # Extract the JSON result from the streaming output.
  # claude -p --output-format json produces a JSON array of event objects.
  # The actual answer is in the element with type=="result", field .result.
  local result=''

  # Try array format first (streaming event array)
  result=$(jq -r '.[] | select(.type == "result") | .result' "$output_file" 2>/dev/null) || true

  # Fallback: object with .result field
  if [[ -z "$result" ]] || [[ "$result" == 'null' ]]; then
    result=$(jq -r '.result // empty' "$output_file" 2>/dev/null) || true
  fi

  # Fallback: raw file content
  if [[ -z "$result" ]] || [[ "$result" == 'null' ]]; then
    result=$(cat "$output_file")
  fi

  # When a schema was provided, validate as JSON.
  # The CRITICAL OUTPUT RULE in the prompt should produce clean JSON,
  # but as a safety net: strip markdown fences, then extract first { to last }.
  if [[ -n "$schema" ]]; then
    if ! echo "$result" | jq empty 2>/dev/null; then
      # Strip markdown code fences
      result=$(echo "$result" | sed '/^```[a-z]*$/d; /^```$/d')
    fi

    if ! echo "$result" | jq empty 2>/dev/null; then
      # Use Python's json decoder to extract the first complete JSON object
      # from mixed text+JSON output (handles nested brackets correctly)
      local extracted
      extracted=$(echo "$result" | python3 -c "
import sys, json
text = sys.stdin.read()
idx = text.find('{')
if idx < 0:
    idx = text.find('[')
if idx >= 0:
    obj, _ = json.JSONDecoder().raw_decode(text[idx:])
    print(json.dumps(obj))
" 2>/dev/null) || true
      if [[ -n "$extracted" ]] && echo "$extracted" | jq empty 2>/dev/null; then
        result="$extracted"
      else
        swarm::log "ERROR: Invalid JSON output from agent"
        swarm::log "Raw output (first 500 chars): $(echo "$result" | head -c 500)"
        return 1
      fi
    fi
  fi

  echo "$result"
}

# ============================================================
# swarm::build_plan_prompt — Build prompt for planification agent
# ============================================================
swarm::build_plan_prompt() {
  local batch_json="$1"
  local iteration_number="$2"

  local spec_content
  spec_content=$(cat "$SPEC_PATH")

  local shared_assets
  shared_assets=$(swarm::read_state '.iterationHistory // []')

  local skills_section=''
  if [[ -n "$SKILLS_JSON" ]] && [[ "$SKILLS_JSON" != 'null' ]]; then
    skills_section="
## Referenced Skills (BINDING STANDARDS)

These skills were explicitly referenced. Every check, config, and pattern MUST be implemented exactly.

$SKILLS_JSON
"
  fi

  local audit_section=''
  if [[ -n "$SKILL_AUDIT_JSON" ]] && [[ "$SKILL_AUDIT_JSON" != 'null' ]]; then
    audit_section="
## Skill Audit Results

Every FAIL and MISSING item below MUST become PASS.

$SKILL_AUDIT_JSON
"
  fi

  cat <<PROMPT
# Planification Agent Input — Iteration ${iteration_number}

## Spec Items for This Batch

\`\`\`json
${batch_json}
\`\`\`

## Full Spec Content

${spec_content}

## Tech Stack

\`\`\`json
${TECH_STACK}
\`\`\`

## Swarm Config

\`\`\`json
${SWARM_CONFIG}
\`\`\`

## Iteration History

\`\`\`json
${shared_assets}
\`\`\`

## Project Directory

${PROJECT_DIR}
${skills_section}
${audit_section}

## Instructions

Analyze the spec items in this batch and produce a PlanificationOutput:
1. Break items into concrete TaskItems with file reuse analysis
2. Build an execution plan (parallel vs serial groups)
3. Create a testing brief for each task
4. Detect human prerequisites (secrets, external services, etc.)
5. Follow ALL referenced skill standards scrupulously

Return valid JSON matching the planification-output schema.
PROMPT
}

# ============================================================
# swarm::build_test_prompt — Build prompt for test agent
# ============================================================
swarm::build_test_prompt() {
  local plan_output="$1"
  local iteration_number="$2"

  local testing_brief
  testing_brief=$(echo "$plan_output" | jq -c '.testingBrief')

  local task_list
  task_list=$(echo "$plan_output" | jq -c '.taskList')

  cat <<PROMPT
# Test Agent Input — Iteration ${iteration_number}

## Testing Brief

\`\`\`json
${testing_brief}
\`\`\`

## Task List

\`\`\`json
${task_list}
\`\`\`

## Tech Stack

\`\`\`json
${TECH_STACK}
\`\`\`

## Project Directory

${PROJECT_DIR}

## Instructions

Write tests for each task according to the testing brief:
- tdd-strict: Write complete, failing tests with real assertions
- tdd-flexible: Write test outlines with structure but placeholder assertions
- post-code: Note the task for post-implementation testing

Follow existing test patterns in the codebase. Use the test framework from the tech stack.
Return valid JSON matching the test-agent-output schema.
PROMPT
}

# ============================================================
# swarm::build_code_prompt — Build prompt for a single code agent
# ============================================================
swarm::build_code_prompt() {
  local task_item="$1"
  local test_context="$2"
  local iteration_number="$3"
  local fix_instructions="${4:-null}"

  local task_id
  task_id=$(echo "$task_item" | jq -r '.id')

  local specialist
  specialist=$(echo "$task_item" | jq -r '.specialist')

  local shared_assets
  shared_assets=$(swarm::read_state '.iterationHistory // []')

  local fix_section=''
  if [[ "$fix_instructions" != 'null' ]]; then
    fix_section="
## Fix Instructions

The following issues were found in code review / security review. Apply minimal fixes.

\`\`\`json
${fix_instructions}
\`\`\`
"
  fi

  cat <<PROMPT
# Code Agent Input — Task ${task_id} — Iteration ${iteration_number}

## Task Item

\`\`\`json
${task_item}
\`\`\`

## Test Context

\`\`\`json
${test_context}
\`\`\`

## Tech Stack

\`\`\`json
${TECH_STACK}
\`\`\`

## Specialist Skill

${specialist}

## Session Name

${SESSION_NAME}

## Project Directory

${PROJECT_DIR}

## Shared Assets from Prior Iterations

\`\`\`json
${shared_assets}
\`\`\`
${fix_section}

## Instructions

Implement the task as specified. Make all tests pass. Follow the specialist skill standards.
Return valid JSON matching the code-agent-output schema.
PROMPT
}

# ============================================================
# swarm::build_review_prompt — Build prompt for code review agent
# ============================================================
swarm::build_review_prompt() {
  local changed_files="$1"
  local iteration_number="$2"

  cat <<PROMPT
# Code Review Agent Input — Iteration ${iteration_number}

## Changed Files

\`\`\`json
${changed_files}
\`\`\`

## Session Name

${SESSION_NAME}

## Project Directory

${PROJECT_DIR}

## Instructions

Review all changed files for:
- DRY violations
- Dead code
- Bad patterns
- Code quality issues

Classify each issue as quick-fix, significant, or critical.
Return valid JSON matching the review-agent-output schema.
PROMPT
}

# ============================================================
# swarm::build_security_prompt — Build prompt for security agent
# ============================================================
swarm::build_security_prompt() {
  local changed_files="$1"
  local iteration_number="$2"

  cat <<PROMPT
# Security Agent Input — Iteration ${iteration_number}

## Changed Files

\`\`\`json
${changed_files}
\`\`\`

## Session Name

${SESSION_NAME}

## Project Directory

${PROJECT_DIR}

## Instructions

Review all changed files for security vulnerabilities:
- OWASP Top 10 categories
- Injection, access control, crypto, misconfig, auth, design, integrity, logging
- Classify severity and impact
- Assess fix complexity

Return valid JSON matching the security-agent-output schema.
PROMPT
}

# ============================================================
# swarm::decompose_spec — Phase 0: Break spec into batches
# ============================================================
swarm::decompose_spec() {
  swarm::log 'Phase 0: Decomposing spec into iteration batches'

  local spec_content
  spec_content=$(cat "$SPEC_PATH")

  local prompt_file="${LOG_DIR}/phase0-decompose-prompt.md"
  cat > "$prompt_file" <<PROMPT
# Batch Decomposition

## Spec Content

${spec_content}

## Tech Stack

\`\`\`json
${TECH_STACK}
\`\`\`

## Swarm Config

\`\`\`json
${SWARM_CONFIG}
\`\`\`

## Instructions

Decompose this spec into iteration batches. Each batch should:
1. Group related spec items that can be implemented together
2. Order batches by dependency (foundations first, features second, polish last)
3. Keep batch size reasonable (2-5 spec items per batch)
4. Estimate task count per batch

Return ONLY valid JSON (no markdown fences) matching this exact structure:

{
  "batches": [
    {
      "iteration": 1,
      "specItemIds": ["FR-1", "FR-2"],
      "rationale": "Why these items are grouped",
      "complexity": "low",
      "estimatedTasks": 3
    }
  ],
  "totalSpecItems": 2,
  "totalBatches": 1,
  "orderingRationale": "Why this batch ordering was chosen"
}

IMPORTANT: specItemIds must be a flat array of string IDs (e.g. ["FR-1", "FR-2", "FR-3"]), NOT nested objects.
PROMPT

  local decomp_output
  decomp_output=$(swarm::call_agent \
    --schema 'batch-decomposition.json' \
    --prompt-file "$prompt_file" \
    --log-prefix 'phase0-decompose')

  echo "$decomp_output" > "${LOG_DIR}/phase0-decompose-output.json"

  # Normalize: if model returned .batches[].id instead of .iteration, or
  # .batches[].specItems (array of objects) instead of .specItemIds (array of strings), fix it.
  decomp_output=$(echo "$decomp_output" | jq '
    .batches = [.batches[] | {
      iteration: (.iteration // .id // 1),
      specItemIds: (
        if (.specItemIds | type) == "array" and ((.specItemIds[0]? // "") | type) == "string"
        then .specItemIds
        elif (.specItems | type) == "array"
        then [.specItems[] | .id]
        else []
        end
      ),
      rationale: (.rationale // .name // ""),
      complexity: (.complexity // "medium"),
      estimatedTasks: (.estimatedTasks // .taskCount // 0)
    }]
  ')

  # Validate batch count
  local batch_count
  batch_count=$(echo "$decomp_output" | jq '.totalBatches')
  if [[ "$batch_count" -eq 0 ]]; then
    swarm::log 'ERROR: Decomposition produced 0 batches'
    return 1
  fi

  # Build planned batches array for state
  local planned_batches
  planned_batches=$(echo "$decomp_output" | jq '[.batches[] | {
    iteration: .iteration,
    specItemIds: .specItemIds,
    status: "pending"
  }]')

  # Collect all spec item IDs as pending
  local all_spec_ids
  all_spec_ids=$(echo "$decomp_output" | jq '[.batches[].specItemIds[]] | unique')

  swarm::update_state \
    --argjson pb "$planned_batches" \
    --argjson pi "$all_spec_ids" \
    '.plannedBatches = $pb | .pendingItems = $pi'

  # Log summary
  local batch_summary
  batch_summary=$(echo "$decomp_output" | jq -r '.batches[] | "[batch \(.iteration): \(.specItemIds | join(","))]"' | tr '\n' ' ')
  swarm::log "Decomposed into $batch_count batches: $batch_summary"
}

# ============================================================
# swarm::run_code_agent — Run a single code agent for a task
# ============================================================
swarm::run_code_agent() {
  local iteration_number="$1"
  local task_id="$2"
  local plan_output="$3"
  local test_output="$4"
  local fix_instructions="${5:-null}"

  swarm::log "Running code agent for task $task_id (iteration $iteration_number)"

  # Extract specific task item from plan output
  local task_item
  task_item=$(echo "$plan_output" | jq -c --arg id "$task_id" '.taskList[] | select(.id == $id)')
  if [[ -z "$task_item" ]] || [[ "$task_item" == 'null' ]]; then
    swarm::log "ERROR: Task $task_id not found in plan output"
    return 1
  fi

  # Extract test context for this task
  local test_context
  test_context=$(echo "$test_output" | jq -c --arg id "$task_id" '.codeAgentContext[$id] // empty')
  if [[ -z "$test_context" ]]; then
    test_context='null'
  fi

  # Build prompt
  local prompt_file="${LOG_DIR}/iter${iteration_number}-code-${task_id}-prompt.md"
  swarm::build_code_prompt "$task_item" "$test_context" "$iteration_number" "$fix_instructions" > "$prompt_file"

  # Call agent
  local code_output
  code_output=$(swarm::call_agent \
    --agent 'code-agent' \
    --schema 'code-agent-output.json' \
    --prompt-file "$prompt_file" \
    --log-prefix "iter${iteration_number}-code-${task_id}")

  echo "$code_output" > "${LOG_DIR}/iter${iteration_number}-code-${task_id}-output.json"

  # Check status
  local status
  status=$(echo "$code_output" | jq -r '.status')
  if [[ "$status" == 'failed' ]]; then
    swarm::log "WARNING: Code agent failed for task $task_id"
    return 1
  fi

  swarm::log "Code agent completed task $task_id (status: $status)"
}

# ============================================================
# swarm::fix_loop — Apply quick-fixes from review/security (max 3)
# ============================================================
swarm::fix_loop() {
  local iteration_number="$1"
  local review_output="$2"
  local security_output="$3"
  local plan_output="$4"
  local test_output="$5"

  # Collect quick-fix issues from review
  local review_fixes
  review_fixes=$(echo "$review_output" | jq '[.issues[] | select(.severity == "quick-fix")]')

  # Collect quick-fix issues from security
  local security_fixes
  security_fixes=$(echo "$security_output" | jq '[.issues[] | select(.severity == "quick-fix")]')

  # Merge all quick-fixes
  local all_fixes
  all_fixes=$(jq -n --argjson r "$review_fixes" --argjson s "$security_fixes" '$r + $s')

  local fix_count
  fix_count=$(echo "$all_fixes" | jq 'length')

  if [[ "$fix_count" -eq 0 ]]; then
    swarm::log 'No quick-fixes needed'
    return 0
  fi

  swarm::log "Fix loop: $fix_count quick-fix issues to address"

  local cycle
  for cycle in 1 2 3; do
    swarm::log "Fix cycle $cycle/3: $fix_count remaining issues"

    # Group fixes by file to identify which code agent owns them
    local fix_files
    fix_files=$(echo "$all_fixes" | jq -r '[.[].file] | unique | .[]')

    # For each affected file, find the code agent that created it and re-run with fix instructions
    while IFS= read -r fix_file; do
      [[ -z "$fix_file" ]] && continue

      # Find which task created/modified this file
      local task_id
      task_id=$(echo "$plan_output" | jq -r \
        --arg f "$fix_file" \
        '.taskList[] | select(.files.creates[] == $f or .files.extends[] == $f) | .id' | head -1)

      if [[ -z "$task_id" ]]; then
        swarm::log "WARNING: No task found for file $fix_file, skipping fix"
        continue
      fi

      # Get fixes for this file
      local file_fixes
      file_fixes=$(echo "$all_fixes" | jq -c --arg f "$fix_file" '[.[] | select(.file == $f)]')

      swarm::log "Sending fixes for $fix_file to task $task_id"
      swarm::run_code_agent "$iteration_number" "$task_id" "$plan_output" "$test_output" "$file_fixes" || true
    done <<< "$fix_files"

    # Re-run review on changed files only (lightweight)
    local changed_files
    changed_files=$(cat "${LOG_DIR}"/iter"${iteration_number}"-code-*-output.json 2>/dev/null \
      | jq -s '[.[].filesChanged, .[].filesCreated] | flatten | unique')

    local re_review_prompt="${LOG_DIR}/iter${iteration_number}-fix${cycle}-review-prompt.md"
    swarm::build_review_prompt "$changed_files" "$iteration_number" > "$re_review_prompt"

    local re_review_output
    re_review_output=$(swarm::call_agent \
      --agent 'code-review-agent' \
      --schema 'review-agent-output.json' \
      --prompt-file "$re_review_prompt" \
      --log-prefix "iter${iteration_number}-fix${cycle}-review") || true

    # Check remaining quick-fixes
    all_fixes=$(echo "$re_review_output" | jq '[.issues[] | select(.severity == "quick-fix")]' 2>/dev/null || echo '[]')
    fix_count=$(echo "$all_fixes" | jq 'length')

    if [[ "$fix_count" -eq 0 ]]; then
      swarm::log "Fix loop resolved all quick-fixes in cycle $cycle"
      return 0
    fi

    swarm::log "Fix cycle $cycle complete: $fix_count quick-fixes remain"
  done

  swarm::log "WARNING: $fix_count quick-fixes remain after 3 fix cycles — escalating"
}

# ============================================================
# swarm::phase_a — Plan + Test (SEQUENTIAL)
# ============================================================
swarm::phase_a() {
  local iteration_number="$1"
  local batch_json="$2"

  swarm::log "Phase A: Planning iteration $iteration_number"

  # Step 1: Run planification agent
  local plan_prompt_file="${LOG_DIR}/iter${iteration_number}-plan-prompt.md"
  swarm::build_plan_prompt "$batch_json" "$iteration_number" > "$plan_prompt_file"

  local plan_output
  plan_output=$(swarm::call_agent \
    --agent 'planification-agent' \
    --schema 'planification-output.json' \
    --prompt-file "$plan_prompt_file" \
    --log-prefix "iter${iteration_number}-plan")

  # Validate planification output
  local task_count
  task_count=$(echo "$plan_output" | jq '.taskList | length')
  if [[ "$task_count" -eq 0 ]]; then
    swarm::log 'ERROR: Planification produced 0 tasks'
    return 1
  fi

  # Extract human prerequisites
  local prereqs
  prereqs=$(echo "$plan_output" | jq '[.humanPrerequisites[] | select(.urgency == "before-impl")]')
  if [[ "$(echo "$prereqs" | jq 'length')" -gt 0 ]]; then
    swarm::log 'BLOCKER: before-impl prerequisites found'
    echo "$prereqs" | jq -r '.[] | "- \(.description) (\(.category))"' > "$BLOCKER_FILE"
    return 2
  fi

  # Store before-deploy prerequisites in state
  local deploy_prereqs
  deploy_prereqs=$(echo "$plan_output" | jq '[.humanPrerequisites[] | select(.urgency == "before-deploy")]')
  if [[ "$(echo "$deploy_prereqs" | jq 'length')" -gt 0 ]]; then
    swarm::update_state --argjson hp "$deploy_prereqs" '.humanPrerequisites += $hp'
  fi

  # Step 2: Run test agent with planification output
  local test_prompt_file="${LOG_DIR}/iter${iteration_number}-test-prompt.md"
  swarm::build_test_prompt "$plan_output" "$iteration_number" > "$test_prompt_file"

  local test_output
  test_output=$(swarm::call_agent \
    --agent 'test-agent' \
    --schema 'test-agent-output.json' \
    --prompt-file "$test_prompt_file" \
    --log-prefix "iter${iteration_number}-test")

  # Store outputs for Phase B
  echo "$plan_output" > "${LOG_DIR}/iter${iteration_number}-plan-output.json"
  echo "$test_output" > "${LOG_DIR}/iter${iteration_number}-test-output.json"

  local total_tests
  total_tests=$(echo "$test_output" | jq '.summary.totalTests // 0')
  swarm::log "Phase A complete: $task_count tasks planned, $total_tests tests written"
}

# ============================================================
# swarm::phase_b — Code + Review + Security
# ============================================================
swarm::phase_b() {
  local iteration_number="$1"

  swarm::log "Phase B: Implementation iteration $iteration_number"

  local plan_output test_output
  plan_output=$(cat "${LOG_DIR}/iter${iteration_number}-plan-output.json")
  test_output=$(cat "${LOG_DIR}/iter${iteration_number}-test-output.json")

  # Get execution plan — parallel groups and serial groups
  local parallel_groups serial_groups
  parallel_groups=$(echo "$plan_output" | jq -c '.executionPlan.parallel // []')
  serial_groups=$(echo "$plan_output" | jq -c '.executionPlan.serial // []')

  # Execute serial groups FIRST (scaffolding / dependencies)
  local group_json
  while IFS= read -r group_json; do
    [[ -z "$group_json" ]] && continue

    local task_id
    while IFS= read -r task_id; do
      [[ -z "$task_id" ]] && continue
      if ! swarm::run_code_agent "$iteration_number" "$task_id" "$plan_output" "$test_output"; then
        swarm::log "ERROR: Code agent failed for serial task $task_id"
        return 1
      fi
    done < <(echo "$group_json" | jq -r '.[]')
  done < <(echo "$serial_groups" | jq -c '.[]')

  # Execute parallel groups AFTER serial dependencies are done
  while IFS= read -r group_json; do
    [[ -z "$group_json" ]] && continue

    local pids=()
    local task_id
    while IFS= read -r task_id; do
      [[ -z "$task_id" ]] && continue
      swarm::run_code_agent "$iteration_number" "$task_id" "$plan_output" "$test_output" &
      pids+=($!)
    done < <(echo "$group_json" | jq -r '.[]')

    # Wait for all parallel agents in this group
    local failed=0
    local pid
    for pid in "${pids[@]}"; do
      if ! wait "$pid"; then
        ((failed++))
      fi
    done

    if [[ "$failed" -gt 0 ]]; then
      swarm::log "WARNING: $failed code agent(s) failed in parallel group"
    fi
  done < <(echo "$parallel_groups" | jq -c '.[]')

  # Post-code test phase: re-invoke test agent for blocked tasks
  local blocked_tasks
  blocked_tasks=$(echo "$test_output" | jq -c '[.blockedItems // [] | .[] | .taskId] // []')
  if [[ "$(echo "$blocked_tasks" | jq 'length')" -gt 0 ]]; then
    swarm::log "Post-code test phase: $(echo "$blocked_tasks" | jq 'length') blocked tasks need tests"

    # Collect files created/changed by code agents so far
    local code_files='[]'
    if ls "${LOG_DIR}"/iter"${iteration_number}"-code-*-output.json >/dev/null 2>&1; then
      code_files=$(cat "${LOG_DIR}"/iter"${iteration_number}"-code-*-output.json \
        | jq -s '[.[].filesChanged // [], .[].filesCreated // []] | flatten | unique')
    fi

    local posttest_prompt_file="${LOG_DIR}/iter${iteration_number}-posttest-prompt.md"
    cat > "$posttest_prompt_file" <<POSTTEST_PROMPT
# Test Agent Input — Post-Code — Iteration ${iteration_number}

## Mode

post-code

## Blocked Tasks Requiring Tests

\`\`\`json
${blocked_tasks}
\`\`\`

## Completed Files

\`\`\`json
${code_files}
\`\`\`

## Original Test Output

\`\`\`json
$(cat "${LOG_DIR}/iter${iteration_number}-test-output.json")
\`\`\`

## Plan Output

\`\`\`json
$(cat "${LOG_DIR}/iter${iteration_number}-plan-output.json")
\`\`\`

## Tech Stack

\`\`\`json
${TECH_STACK}
\`\`\`

## Project Directory

${PROJECT_DIR}

## Instructions

Write post-implementation tests for the blocked tasks listed above.
The code is now implemented — read the completed files and write real assertions.
Return valid JSON matching the test-agent-output schema.
POSTTEST_PROMPT

    local posttest_output
    posttest_output=$(swarm::call_agent \
      --agent 'test-agent' \
      --schema 'test-agent-output.json' \
      --prompt-file "$posttest_prompt_file" \
      --log-prefix "iter${iteration_number}-posttest") || {
      swarm::log "WARNING: Post-code test agent failed, continuing"
    }

    if [[ -n "$posttest_output" ]]; then
      echo "$posttest_output" > "${LOG_DIR}/iter${iteration_number}-posttest-output.json"
      swarm::log "Post-code tests written"
    fi
  fi

  # Collect all changed files from code agent outputs
  local all_changed_files
  all_changed_files=$(cat "${LOG_DIR}"/iter"${iteration_number}"-code-*-output.json 2>/dev/null \
    | jq -s '[.[].filesChanged // [], .[].filesCreated // []] | flatten | unique')

  if [[ "$(echo "$all_changed_files" | jq 'length')" -eq 0 ]]; then
    swarm::log 'WARNING: No files were changed by code agents'
    all_changed_files='[]'
  fi

  # Run code review
  swarm::log 'Phase B: Running code review'
  local review_prompt_file="${LOG_DIR}/iter${iteration_number}-review-prompt.md"
  swarm::build_review_prompt "$all_changed_files" "$iteration_number" > "$review_prompt_file"

  local review_output
  review_output=$(swarm::call_agent \
    --agent 'code-review-agent' \
    --schema 'review-agent-output.json' \
    --prompt-file "$review_prompt_file" \
    --log-prefix "iter${iteration_number}-review")

  echo "$review_output" > "${LOG_DIR}/iter${iteration_number}-review-output.json"

  # Run security review
  swarm::log 'Phase B: Running security review'
  local security_prompt_file="${LOG_DIR}/iter${iteration_number}-security-prompt.md"
  swarm::build_security_prompt "$all_changed_files" "$iteration_number" > "$security_prompt_file"

  local security_output
  security_output=$(swarm::call_agent \
    --agent 'security-agent' \
    --schema 'security-agent-output.json' \
    --prompt-file "$security_prompt_file" \
    --log-prefix "iter${iteration_number}-security")

  echo "$security_output" > "${LOG_DIR}/iter${iteration_number}-security-output.json"

  # Handle quick-fix issues from review and security
  swarm::fix_loop "$iteration_number" "$review_output" "$security_output" "$plan_output" "$test_output"

  swarm::log 'Phase B complete'
}

# ============================================================
# swarm::phase_c — Escalation handling (pure shell, no AI)
# ============================================================
swarm::phase_c() {
  local iteration_number="$1"

  swarm::log "Phase C: Escalation handling iteration $iteration_number"

  # Collect significant/critical issues from review
  local sig_review='[]'
  if [[ -f "${LOG_DIR}/iter${iteration_number}-review-output.json" ]]; then
    sig_review=$(jq '[.issues[] | select(.severity == "significant" or .severity == "critical")]' \
      "${LOG_DIR}/iter${iteration_number}-review-output.json" 2>/dev/null || echo '[]')
  fi

  # Collect significant/critical issues from security
  local sig_security='[]'
  if [[ -f "${LOG_DIR}/iter${iteration_number}-security-output.json" ]]; then
    sig_security=$(jq '[.issues[] | select(.severity == "significant" or .severity == "critical")]' \
      "${LOG_DIR}/iter${iteration_number}-security-output.json" 2>/dev/null || echo '[]')
  fi

  local total_escalations
  total_escalations=$(jq -n --argjson r "$sig_review" --argjson s "$sig_security" '$r + $s | length')

  if [[ "$total_escalations" -eq 0 ]]; then
    swarm::log 'Phase C: No escalations'
    return 0
  fi

  swarm::log "Phase C: $total_escalations significant/critical issues found"

  # Write escalations to fixes.md
  local fixes_dir="${PROJECT_DIR}/docs/swarm/${SESSION_NAME}"
  mkdir -p "$fixes_dir"
  local fixes_file="${fixes_dir}/fixes.md"

  local timestamp
  timestamp=$(date -u '+%Y-%m-%dT%H:%M:%SZ')

  {
    if [[ ! -f "$fixes_file" ]]; then
      echo "# Fixes — ${SESSION_NAME}"
      echo ''
    fi

    echo "## Iteration ${iteration_number} — ${timestamp}"
    echo ''

    # Review escalations
    if [[ "$(echo "$sig_review" | jq 'length')" -gt 0 ]]; then
      echo '### Code Review Issues'
      echo ''
      echo "$sig_review" | jq -r '.[] | "- **\(.id)** [\(.severity)] \(.file):\(.line // "?") — \(.description)"'
      echo ''
    fi

    # Security escalations
    if [[ "$(echo "$sig_security" | jq 'length')" -gt 0 ]]; then
      echo '### Security Issues'
      echo ''
      echo "$sig_security" | jq -r '.[] | "- **\(.id)** [\(.severity)] \(.file):\(.line // "?") — \(.description) (OWASP: \(.owaspCategory // "N/A"))"'
      echo ''
    fi
  } >> "$fixes_file"

  # Update state with escalation info
  local escalation_descs
  escalation_descs=$(jq -n --argjson r "$sig_review" --argjson s "$sig_security" \
    '[$r[], $s[]] | [.[] | "\(.id): \(.description)"]')
  swarm::update_state --argjson e "$escalation_descs" \
    ".iterationHistory[-1].escalations = (\$e // [])"

  swarm::log "Phase C complete: wrote $total_escalations issues to fixes.md"
}

# ============================================================
# swarm::phase_d — Lint + Build + Commit (MANDATORY GATES)
# ============================================================
swarm::phase_d() {
  local iteration_number="$1"

  swarm::log "Phase D: Validation iteration $iteration_number"

  cd "$PROJECT_DIR"

  # D0: Lint (auto-detect tool)
  local lint_passed=true
  if [[ -f 'biome.json' ]] || [[ -f 'biome.jsonc' ]]; then
    swarm::log 'D0: Running biome lint'
    if ! $PKG_MGR exec biome check . 2>"${LOG_DIR}/iter${iteration_number}-lint-stderr.log"; then
      lint_passed=false
    fi
  elif [[ -f '.eslintrc.js' ]] || [[ -f '.eslintrc.json' ]] || [[ -f '.eslintrc.cjs' ]] \
    || [[ -f 'eslint.config.js' ]] || [[ -f 'eslint.config.mjs' ]] || [[ -f 'eslint.config.ts' ]]; then
    swarm::log 'D0: Running eslint'
    if ! $PKG_MGR exec eslint . 2>"${LOG_DIR}/iter${iteration_number}-lint-stderr.log"; then
      lint_passed=false
    fi
  elif jq -e '.scripts.lint' package.json >/dev/null 2>&1; then
    swarm::log 'D0: Running package.json lint script'
    if ! $PKG_MGR run lint 2>"${LOG_DIR}/iter${iteration_number}-lint-stderr.log"; then
      lint_passed=false
    fi
  else
    swarm::log 'D0: No lint tool detected, skipping'
  fi

  if [[ "$lint_passed" != 'true' ]]; then
    swarm::log 'GATE FAIL: Lint failed'
    swarm::log "Lint stderr: $(tail -30 "${LOG_DIR}/iter${iteration_number}-lint-stderr.log" 2>/dev/null || echo 'no output')"
    return 1
  fi

  # D1: Type check (auto-detect)
  local typecheck_passed=true
  if [[ -f 'astro.config.mjs' ]] || [[ -f 'astro.config.ts' ]] || [[ -f 'astro.config.js' ]]; then
    swarm::log 'D1: Running astro check'
    if ! $PKG_MGR exec astro check 2>"${LOG_DIR}/iter${iteration_number}-typecheck-stderr.log"; then
      typecheck_passed=false
    fi
  elif [[ -f 'tsconfig.json' ]]; then
    swarm::log 'D1: Running tsc --noEmit'
    if ! $PKG_MGR exec tsc --noEmit 2>"${LOG_DIR}/iter${iteration_number}-typecheck-stderr.log"; then
      typecheck_passed=false
    fi
  else
    swarm::log 'D1: No type checker detected, skipping'
  fi

  if [[ "$typecheck_passed" != 'true' ]]; then
    swarm::log 'GATE FAIL: Type check failed'
    swarm::log "Typecheck stderr: $(tail -30 "${LOG_DIR}/iter${iteration_number}-typecheck-stderr.log" 2>/dev/null || echo 'no output')"
    return 1
  fi

  # D2: Build
  local build_passed=true
  if jq -e '.scripts.build' package.json >/dev/null 2>&1; then
    swarm::log 'D2: Running build'
    if ! $PKG_MGR run build 2>"${LOG_DIR}/iter${iteration_number}-build-stderr.log"; then
      build_passed=false
    fi
  else
    swarm::log 'D2: No build script, skipping'
  fi

  if [[ "$build_passed" != 'true' ]]; then
    swarm::log 'GATE FAIL: Build failed'
    swarm::log "Build stderr: $(tail -50 "${LOG_DIR}/iter${iteration_number}-build-stderr.log" 2>/dev/null || echo 'no output')"
    return 1
  fi

  # D3: Commit
  swarm::log "D3: Committing iteration $iteration_number"

  git -C "$PROJECT_DIR" add -A

  # Check if there are staged changes
  if git -C "$PROJECT_DIR" diff --cached --quiet; then
    swarm::log 'WARNING: No staged changes to commit'
    echo 'no-commit'
    return 0
  fi

  git -C "$PROJECT_DIR" commit -m "$(cat <<EOF
feat(${SESSION_NAME}): iteration ${iteration_number}

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
EOF
)" >/dev/null

  local commit_sha
  commit_sha=$(git -C "$PROJECT_DIR" rev-parse HEAD)

  swarm::log "Phase D complete: commit $commit_sha"
  echo "$commit_sha"
}

# ============================================================
# swarm::run_iteration — Execute one full Phase A-D cycle
# ============================================================
swarm::run_iteration() {
  local iteration_number="$1"

  swarm::log "=== Starting iteration $iteration_number ==="

  # Read current batch spec items from state
  local batch_json
  batch_json=$(swarm::read_state \
    --argjson n "$iteration_number" \
    '.plannedBatches[] | select(.iteration == $n) | .specItemIds')

  if [[ -z "$batch_json" ]] || [[ "$batch_json" == 'null' ]]; then
    swarm::log "ERROR: No batch found for iteration $iteration_number"
    return 1
  fi

  # Phase A — Plan + Test
  local phase_a_exit=0
  swarm::phase_a "$iteration_number" "$batch_json" || phase_a_exit=$?

  if [[ "$phase_a_exit" -eq 2 ]]; then
    swarm::log "Iteration $iteration_number blocked by human prerequisites"
    return 2
  fi
  if [[ "$phase_a_exit" -ne 0 ]]; then
    swarm::log "Phase A failed for iteration $iteration_number"
    return 1
  fi

  # Phase B — Code + Review + Security
  if ! swarm::phase_b "$iteration_number"; then
    swarm::log "Phase B failed for iteration $iteration_number"
    return 1
  fi

  # Phase C — Escalation handling
  swarm::phase_c "$iteration_number" || true

  # Phase D — Lint + Build + Commit (MANDATORY GATES)
  local commit_result
  commit_result=$(swarm::phase_d "$iteration_number") || {
    swarm::log "Phase D failed for iteration $iteration_number"
    return 1
  }

  # Build iteration summary
  local test_total=0 test_pass=0 test_fail=0
  local review_quick=0 review_sig=0 review_sec=0

  # Aggregate test results from code agent outputs
  if ls "${LOG_DIR}"/iter"${iteration_number}"-code-*-output.json >/dev/null 2>&1; then
    test_total=$(cat "${LOG_DIR}"/iter"${iteration_number}"-code-*-output.json \
      | jq -s '[.[].testResults.total // 0] | add')
    test_pass=$(cat "${LOG_DIR}"/iter"${iteration_number}"-code-*-output.json \
      | jq -s '[.[].testResults.passed // 0] | add')
    test_fail=$(cat "${LOG_DIR}"/iter"${iteration_number}"-code-*-output.json \
      | jq -s '[.[].testResults.failed // 0] | add')
  fi

  # Defensive defaults — prevent empty strings from broken jq aggregation
  test_total=${test_total:-0}
  test_pass=${test_pass:-0}
  test_fail=${test_fail:-0}

  # Aggregate review summary
  if [[ -f "${LOG_DIR}/iter${iteration_number}-review-output.json" ]]; then
    review_quick=$(jq '.summary.quickFixes // 0' "${LOG_DIR}/iter${iteration_number}-review-output.json")
    review_sig=$(jq '.summary.significant // 0' "${LOG_DIR}/iter${iteration_number}-review-output.json")
  fi
  if [[ -f "${LOG_DIR}/iter${iteration_number}-security-output.json" ]]; then
    review_sec=$(jq '.summary.totalIssues // 0' "${LOG_DIR}/iter${iteration_number}-security-output.json")
  fi

  # Collect changed/created files
  local files_changed='[]' files_created='[]'
  if ls "${LOG_DIR}"/iter"${iteration_number}"-code-*-output.json >/dev/null 2>&1; then
    files_changed=$(cat "${LOG_DIR}"/iter"${iteration_number}"-code-*-output.json \
      | jq -s '[.[].filesChanged // []] | flatten | unique')
    files_created=$(cat "${LOG_DIR}"/iter"${iteration_number}"-code-*-output.json \
      | jq -s '[.[].filesCreated // []] | flatten | unique')
  fi

  # Build one-line summary
  local task_count
  task_count=$(jq '.taskList | length' "${LOG_DIR}/iter${iteration_number}-plan-output.json")
  local one_liner="${task_count} tasks done, ${test_pass}/${test_total} tests pass, ${review_quick} quick-fixes, ${review_sig} significant"

  # Update state
  local batch_spec_ids
  batch_spec_ids=$(echo "$batch_json" | jq -c '.')
  local iteration_summary
  iteration_summary=$(jq -n \
    --argjson iter "$iteration_number" \
    --argjson spec_ids "$batch_spec_ids" \
    --argjson tasks "$task_count" \
    --argjson tp "$test_pass" \
    --argjson tf "$test_fail" \
    --argjson rq "$review_quick" \
    --argjson rs "$review_sig" \
    --argjson rc "$review_sec" \
    --arg commit "$commit_result" \
    --arg summary "$one_liner" \
    '{
      iteration: $iter,
      specItemIds: $spec_ids,
      tasksCompleted: $tasks,
      testsPassing: $tp,
      testsFailing: $tf,
      reviewIssues: { quickFix: $rq, significant: $rs, security: $rc },
      lintPassed: true,
      buildPassed: true,
      status: "complete",
      commitSha: $commit,
      oneLineSummary: $summary
    }')

  swarm::update_state --argjson s "$iteration_summary" --argjson fc "$files_changed" --argjson fn "$files_created" \
    '.iterationHistory += [$s] | .filesChanged += $fc | .filesCreated += $fn | .filesChanged |= unique | .filesCreated |= unique'

  # Move batch spec items from pending to completed
  swarm::update_state --argjson ids "$batch_spec_ids" \
    '.completedItems += $ids | .pendingItems -= $ids'

  swarm::log "=== Iteration $iteration_number complete: $one_liner ==="
}

# ============================================================
# swarm::main_loop — Execute all planned batches
# ============================================================
swarm::main_loop() {
  swarm::log 'Starting main loop'

  local batch_count
  batch_count=$(swarm::read_state '.plannedBatches | length')
  swarm::log "Processing $batch_count batches"

  local i
  for ((i = 0; i < batch_count; i++)); do
    local iteration_number=$((i + 1))

    # Check batch status (support resume)
    local batch_status
    batch_status=$(swarm::read_state --argjson n "$iteration_number" \
      '.plannedBatches[] | select(.iteration == $n) | .status')

    if [[ "$batch_status" == 'completed' ]]; then
      swarm::log "Batch $iteration_number already completed, skipping"
      continue
    fi

    # Mark batch as in-progress
    swarm::update_state --argjson n "$iteration_number" \
      '(.plannedBatches[] | select(.iteration == $n)).status = "in-progress"'
    swarm::update_state --argjson n "$iteration_number" \
      '.currentIteration = $n'

    # Run the iteration
    local iter_exit=0
    swarm::run_iteration "$iteration_number" || iter_exit=$?

    if [[ "$iter_exit" -eq 2 ]]; then
      # Human prerequisite blocker
      swarm::log "Iteration $iteration_number blocked on human prerequisite"
      exit 2
    fi

    if [[ "$iter_exit" -ne 0 ]]; then
      # Check retry counter
      local retry_count
      retry_count=$(swarm::read_state --argjson n "$iteration_number" \
        '.retryCounters[($n | tostring)] // 0')

      if [[ "$retry_count" -lt 2 ]]; then
        local new_count=$((retry_count + 1))
        swarm::log "Iteration $iteration_number failed, retry $new_count/2"
        swarm::update_state --argjson n "$iteration_number" --argjson c "$new_count" \
          '.retryCounters[($n | tostring)] = $c'

        # Re-run the iteration (decrement i to repeat this iteration)
        ((i--))
        continue
      fi

      swarm::log "Iteration $iteration_number failed after 2 retries — writing blocker"
      echo "Iteration $iteration_number failed after 2 retries. Check logs at: ${LOG_DIR}" > "$BLOCKER_FILE"
      exit 2
    fi

    # Mark batch as completed
    swarm::update_state --argjson n "$iteration_number" \
      '(.plannedBatches[] | select(.iteration == $n)).status = "completed"'
  done

  swarm::log 'Main loop complete: all batches processed'
}

# ============================================================
# swarm::write_delivery_report — Generate final delivery report
# ============================================================
swarm::write_delivery_report() {
  swarm::log 'Writing delivery report'

  local state
  state=$(cat "$STATE_FILE")

  local iteration_history
  iteration_history=$(echo "$state" | jq -c '.iterationHistory')

  local files_changed
  files_changed=$(echo "$state" | jq -c '.filesChanged')

  local files_created
  files_created=$(echo "$state" | jq -c '.filesCreated')

  local human_prereqs
  human_prereqs=$(echo "$state" | jq -c '.humanPrerequisites')

  # Build prompt for AI to generate human-readable report
  local prompt_file="${LOG_DIR}/delivery-report-prompt.md"
  cat > "$prompt_file" <<PROMPT
# Generate Delivery Report

## Session Name

${SESSION_NAME}

## Iteration History

\`\`\`json
${iteration_history}
\`\`\`

## Files Changed

\`\`\`json
${files_changed}
\`\`\`

## Files Created

\`\`\`json
${files_created}
\`\`\`

## Human Prerequisites (before-deploy)

\`\`\`json
${human_prereqs}
\`\`\`

## Spec Content

$(cat "$SPEC_PATH")

## Instructions

Generate a markdown delivery report with the following sections:
1. "What Was Delivered" — concrete bullet points
2. "Architecture Decisions" — key decisions and why
3. "Per-Iteration Breakdown" — table with: Iter, Spec Items, Tasks, Tests, Review Issues, Status
4. "Manual Follow-Up Actions" — from human prerequisites, or "none"
5. "Known Limitations" — trade-offs, or "none"
6. "Issues Encountered" — problems and resolutions, or "none"

Output ONLY the markdown content, no wrapping JSON.
PROMPT

  local report_content
  report_content=$(swarm::call_agent \
    --prompt-file "$prompt_file" \
    --log-prefix 'delivery-report') || {
    swarm::log 'WARNING: Failed to generate delivery report via AI, writing raw summary'
    report_content="## Session: ${SESSION_NAME}

### Per-Iteration Breakdown

$(echo "$iteration_history" | jq -r '.[] | "- Iteration \(.iteration): \(.oneLineSummary)"')

### Files Changed

$(echo "$files_changed" | jq -r '.[]')
"
  }

  local report_dir="${PROJECT_DIR}/docs/swarm/${SESSION_NAME}"
  mkdir -p "$report_dir"
  echo "$report_content" > "${report_dir}/delivery-report.md"

  swarm::log "Delivery report written to ${report_dir}/delivery-report.md"
}

# ============================================================
# swarm::write_result_json — Write final result JSON
# ============================================================
swarm::write_result_json() {
  local status="$1"

  local state
  state=$(cat "$STATE_FILE")

  if [[ -z "$state" ]] || ! echo "$state" | jq empty 2>/dev/null; then
    swarm::log "ERROR: State file is empty or invalid, writing minimal result"
    jq -n --arg status "$status" --arg session "$SESSION_NAME" \
      '{ status: $status, sessionName: $session, error: "state file corrupted" }' > "$RESULT_FILE"
    swarm::log "Minimal result JSON written to $RESULT_FILE"
    return 0
  fi

  local result
  result=$(jq -n \
    --arg status "$status" \
    --arg session "$SESSION_NAME" \
    --argjson state "$state" \
    '{
      status: $status,
      sessionName: $session,
      completedItems: $state.completedItems,
      pendingItems: $state.pendingItems,
      blockedItems: $state.blockedItems,
      filesChanged: $state.filesChanged,
      filesCreated: $state.filesCreated,
      testsWritten: $state.testsWritten,
      testsPassing: $state.testsPassing,
      iterationHistory: $state.iterationHistory,
      humanPrerequisites: $state.humanPrerequisites,
      deliveryReportPath: "docs/swarm/\($session)/delivery-report.md"
    }')

  echo "$result" > "$RESULT_FILE"
  swarm::log "Result JSON written to $RESULT_FILE"
}

# ============================================================
# swarm::main — Entry point
# ============================================================
swarm::main() {
  # --------------------------------------------------------
  # Parse arguments
  # --------------------------------------------------------
  while [[ $# -gt 0 ]]; do
    case "$1" in
      --session)
        SESSION_NAME="$2"
        shift 2
        ;;
      --spec)
        SPEC_PATH="$2"
        shift 2
        ;;
      --tech-stack)
        TECH_STACK="$2"
        shift 2
        ;;
      --swarm-config)
        SWARM_CONFIG="$2"
        shift 2
        ;;
      --project-dir)
        PROJECT_DIR="$2"
        shift 2
        ;;
      --skills)
        SKILLS_JSON="$2"
        shift 2
        ;;
      --skill-audit)
        SKILL_AUDIT_JSON="$2"
        shift 2
        ;;
      --resume)
        RESUME=true
        shift
        ;;
      *)
        swarm::log "WARNING: Unknown argument: $1"
        shift
        ;;
    esac
  done

  # --------------------------------------------------------
  # Validate required arguments
  # --------------------------------------------------------
  if [[ -z "$SESSION_NAME" ]]; then
    echo 'ERROR: --session is required' >&2
    exit 1
  fi
  if [[ -z "$SPEC_PATH" ]]; then
    echo 'ERROR: --spec is required' >&2
    exit 1
  fi
  if [[ ! -f "$SPEC_PATH" ]]; then
    echo "ERROR: Spec file not found: $SPEC_PATH" >&2
    exit 1
  fi
  if [[ -z "$TECH_STACK" ]]; then
    echo 'ERROR: --tech-stack is required' >&2
    exit 1
  fi
  if [[ -z "$SWARM_CONFIG" ]]; then
    echo 'ERROR: --swarm-config is required' >&2
    exit 1
  fi
  if [[ -z "$PROJECT_DIR" ]]; then
    echo 'ERROR: --project-dir is required' >&2
    exit 1
  fi
  if [[ ! -d "$PROJECT_DIR" ]]; then
    echo "ERROR: Project directory not found: $PROJECT_DIR" >&2
    exit 1
  fi

  # --------------------------------------------------------
  # Derive paths
  # --------------------------------------------------------
  STATE_FILE="${TMPDIR:-/tmp}/swarm-${SESSION_NAME}-state.json"
  LOG_DIR="${TMPDIR:-/tmp}/swarm-${SESSION_NAME}-logs"
  BLOCKER_FILE="${TMPDIR:-/tmp}/swarm-${SESSION_NAME}-blocker.txt"
  RESULT_FILE="${TMPDIR:-/tmp}/swarm-${SESSION_NAME}-result.json"
  DONE_FILE="${TMPDIR:-/tmp}/swarm-${SESSION_NAME}-done"
  SCHEMA_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/swarm-schemas"

  # Validate schema directory
  if [[ ! -d "$SCHEMA_DIR" ]]; then
    echo "ERROR: Schema directory not found: $SCHEMA_DIR" >&2
    exit 1
  fi

  # Create log directory
  mkdir -p "$LOG_DIR"

  # --------------------------------------------------------
  # Set up traps
  # --------------------------------------------------------
  trap swarm::cleanup SIGINT SIGTERM
  trap swarm::write_done_file EXIT

  # --------------------------------------------------------
  # Detect package manager
  # --------------------------------------------------------
  swarm::detect_pkg_mgr

  # Clean stale done marker from previous run
  rm -f "$DONE_FILE"

  swarm::log "=== SWARM START ==="
  swarm::log "Session: $SESSION_NAME"
  swarm::log "Spec: $SPEC_PATH"
  swarm::log "Project: $PROJECT_DIR"
  swarm::log "State: $STATE_FILE"
  swarm::log "Logs: $LOG_DIR"
  swarm::log "Done marker: $DONE_FILE"

  # --------------------------------------------------------
  # Resume or fresh start
  # --------------------------------------------------------
  if [[ "$RESUME" == 'true' ]]; then
    if [[ ! -f "$STATE_FILE" ]]; then
      swarm::log 'ERROR: --resume specified but no state file found'
      exit 1
    fi
    swarm::log 'Resuming from existing state'

    # Verify state has planned batches
    local planned_count
    planned_count=$(swarm::read_state '.plannedBatches | length')
    if [[ "$planned_count" -eq 0 ]]; then
      swarm::log 'ERROR: State has no planned batches to resume'
      exit 1
    fi

    swarm::log "Resuming with $planned_count planned batches"
    swarm::main_loop
  else
    swarm::init
    swarm::decompose_spec
    swarm::main_loop
  fi

  # --------------------------------------------------------
  # Success path
  # --------------------------------------------------------
  swarm::write_delivery_report
  swarm::write_result_json 'completed'

  swarm::log "=== SWARM COMPLETE ==="
  swarm::log "Result: $RESULT_FILE"
  exit 0
}

# ============================================================
# Run main
# ============================================================
swarm::main "$@"
