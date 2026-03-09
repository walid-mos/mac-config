import {
  commitSpecItem,
  markPrReady
} from "./chunk-ZZ4OW3NJ.js";

// src/phases/docs/docs-phase.ts
import * as fs from "fs";
import * as path from "path";
import { spawn } from "child_process";

// src/phases/phase-results.ts
import { z } from "zod";
var techStackSchema = z.object({
  languages: z.array(z.string()),
  frameworks: z.array(z.string()),
  testRunner: z.string().nullable(),
  packageManager: z.string(),
  buildTool: z.string().nullable(),
  configFiles: z.array(z.string()),
  testCommand: z.string(),
  buildCommand: z.string().nullable(),
  typecheckCommand: z.string().nullable(),
  lintCommand: z.string().nullable()
});
var plannerTaskSchema = z.object({
  id: z.string().regex(/^TASK-\d+$/),
  title: z.string(),
  description: z.string(),
  tag: z.union([z.literal("backend"), z.literal("frontend"), z.literal("fullstack")]),
  dependencies: z.array(z.string().regex(/^TASK-\d+$/)),
  testHints: z.array(z.string())
});
var planPhaseResultSchema = z.object({
  plannerOutput: z.string(),
  tasks: z.array(plannerTaskSchema),
  techStack: techStackSchema,
  taskCount: z.number(),
  tags: z.record(z.number())
});
var tddAgentOutputSchema = z.object({
  testFiles: z.array(z.string()),
  testResult: z.object({
    totalTests: z.number(),
    passingTests: z.number(),
    failingTests: z.number(),
    durationMs: z.number().optional().default(0)
  }),
  isRed: z.boolean()
});
var tddPhaseResultSchema = z.object({
  testFiles: z.array(z.string()),
  agentReport: tddAgentOutputSchema
});
var testResultSchema = z.object({
  totalTests: z.number(),
  passingTests: z.number(),
  failingTests: z.number(),
  durationMs: z.number().optional().default(0)
});
var reviewFindingSchema = z.object({
  file: z.string(),
  line: z.number().nullish(),
  severity: z.union([z.literal("critical"), z.literal("important"), z.literal("suggestion")]),
  category: z.union([
    z.literal("bug"),
    z.literal("security"),
    z.literal("quality"),
    z.literal("performance"),
    z.literal("dry-violation"),
    z.literal("dead-code"),
    z.literal("spec-compliance")
  ]),
  description: z.string(),
  suggestedFix: z.string().optional()
});
var mergedReviewSchema = z.object({
  findings: z.array(reviewFindingSchema),
  criticalCount: z.number(),
  importantCount: z.number(),
  suggestionCount: z.number()
});
var iterationOutcomeSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("green"), testResult: testResultSchema, review: mergedReviewSchema }),
  z.object({ status: z.literal("needs-iteration"), testResult: testResultSchema, review: mergedReviewSchema, reason: z.literal("review-findings") }),
  z.object({ status: z.literal("max-iterations"), testResult: testResultSchema, review: mergedReviewSchema.optional() }),
  z.object({ status: z.literal("timeout"), testResult: testResultSchema.optional(), review: mergedReviewSchema.optional() })
]);
var iterationStateSchema = z.object({
  iteration: z.number(),
  outcome: iterationOutcomeSchema,
  changedFiles: z.array(z.string())
});
var taskBatchSchema = z.object({
  batchIndex: z.number(),
  tasks: z.array(plannerTaskSchema)
});
var commitRecordSchema = z.object({
  hash: z.string(),
  message: z.string(),
  specItem: z.string(),
  iteration: z.number()
});
var gitStateSchema = z.object({
  branch: z.string(),
  worktreePath: z.string().optional(),
  prNumber: z.number().optional(),
  prUrl: z.string().optional(),
  commits: z.array(commitRecordSchema)
});
var taskCompletionRecordSchema = z.object({
  taskId: z.string(),
  title: z.string(),
  status: z.union([z.literal("green"), z.literal("failed")]),
  attempts: z.number(),
  commitHash: z.string().optional()
});
var codePhaseResultSchema = z.object({
  batches: z.array(taskBatchSchema),
  iterations: z.array(iterationStateSchema),
  finalTestResult: testResultSchema,
  finalReview: mergedReviewSchema.optional(),
  gitState: gitStateSchema,
  changedFiles: z.array(z.string()),
  success: z.boolean(),
  codePhaseTimeoutMs: z.number().optional(),
  taskCompletions: z.array(taskCompletionRecordSchema).optional()
});
function readPlanPhaseResult(state) {
  const raw = state.phaseResults.plan;
  if (raw === void 0) return null;
  const parsed = planPhaseResultSchema.parse(raw);
  return parsed;
}
function readTddPhaseResult(state) {
  const raw = state.phaseResults.tdd;
  if (raw === void 0) return null;
  const parsed = tddPhaseResultSchema.parse(raw);
  return parsed;
}
function readCodePhaseResult(state) {
  const raw = state.phaseResults.code;
  if (raw === void 0) return null;
  const parsed = codePhaseResultSchema.parse(raw);
  return parsed;
}
var tokenUsageSchema = z.object({
  input: z.number(),
  output: z.number(),
  cacheCreation: z.number(),
  cacheRead: z.number()
});
var agentInvocationRecordSchema = z.object({
  role: z.union([
    z.literal("plan"),
    z.literal("test"),
    z.literal("code"),
    z.literal("review"),
    z.literal("security"),
    z.literal("consistency"),
    z.literal("merge"),
    z.literal("docs")
  ]),
  model: z.string(),
  durationMs: z.number(),
  tokenUsage: tokenUsageSchema.optional()
});
var reviewFindingSummarySchema = z.object({
  severity: z.union([z.literal("critical"), z.literal("important"), z.literal("suggestion")]),
  category: z.union([
    z.literal("bug"),
    z.literal("security"),
    z.literal("quality"),
    z.literal("performance"),
    z.literal("dry-violation"),
    z.literal("dead-code"),
    z.literal("spec-compliance")
  ]),
  description: z.string(),
  resolved: z.boolean(),
  resolution: z.string().optional()
});
var taskSummarySchema = z.object({
  id: z.string().regex(/^TASK-\d+$/),
  title: z.string(),
  tag: z.union([z.literal("backend"), z.literal("frontend"), z.literal("fullstack")]),
  filesModified: z.array(z.string())
});
var specItemSummarySchema = z.object({
  title: z.string(),
  iterationCount: z.number(),
  success: z.boolean(),
  tasks: z.array(taskSummarySchema),
  testResult: testResultSchema,
  reviewFindings: z.array(reviewFindingSummarySchema),
  commitHash: z.string().optional()
});
var deliveryReportInputSchema = z.object({
  sessionId: z.string(),
  specPath: z.string(),
  specItems: z.array(specItemSummarySchema),
  totalDuration: z.number(),
  startedAt: z.string(),
  completedAt: z.string()
});
var iterationLogEntrySchema = z.object({
  specItem: z.string(),
  iterationIndex: z.number(),
  agentsInvoked: z.array(agentInvocationRecordSchema),
  testResult: testResultSchema.optional(),
  reviewFindingCount: z.number(),
  filesChanged: z.array(z.string())
});
var docsPhaseResultSchema = z.object({
  deliveryReportPath: z.string(),
  iterationsLogPath: z.string(),
  commitHash: z.string().optional(),
  prUpdated: z.boolean(),
  prMarkedReady: z.boolean(),
  usedFallbackReport: z.boolean(),
  success: z.boolean()
});

// src/phases/docs/report-builder.ts
function normalizeWhitespace(s) {
  return s.replace(/\s+/g, " ").trim();
}
function findingKey(f) {
  return `${f.file}::${f.category}::${normalizeWhitespace(f.description)}`;
}
function hasReview(outcome) {
  return outcome.status === "green" || outcome.status === "needs-iteration";
}
function buildDeliveryReportInput(ctx, planResult, _tddResult, codeResult) {
  const completedAt = (/* @__PURE__ */ new Date()).toISOString();
  let startedAt;
  const loadResult = ctx.state.load();
  if (loadResult && typeof loadResult === "object" && "found" in loadResult && loadResult.found && "valid" in loadResult && loadResult.valid && "state" in loadResult) {
    startedAt = loadResult.state.startedAt;
  } else {
    startedAt = completedAt;
  }
  const totalDuration = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const reviewFindings = classifyFindingResolutions(codeResult.iterations);
  const tasks = planResult.tasks.map((t) => ({
    id: t.id,
    title: t.title,
    tag: t.tag,
    filesModified: codeResult.changedFiles
  }));
  const specItem = {
    title: planResult.tasks.map((t) => t.title).join(", "),
    iterationCount: codeResult.iterations.length,
    success: codeResult.success,
    tasks,
    testResult: codeResult.finalTestResult,
    reviewFindings,
    commitHash: codeResult.gitState.commits[0]?.hash
  };
  return {
    sessionId: ctx.sessionId,
    specPath: ctx.specPath,
    specItems: [specItem],
    totalDuration,
    startedAt,
    completedAt
  };
}
function classifyFindingResolutions(iterations) {
  if (iterations.length === 0) return [];
  const reviewableIterations = iterations.filter((it) => hasReview(it.outcome));
  if (reviewableIterations.length === 0) return [];
  const allFindingKeys = /* @__PURE__ */ new Map();
  for (let i = 0; i < reviewableIterations.length; i++) {
    const current = reviewableIterations[i];
    const next = reviewableIterations[i + 1];
    const currentFindings = current.outcome.review.findings;
    const nextFindingKeys = next ? new Set(next.outcome.review.findings.map((f) => findingKey(f))) : void 0;
    for (const finding of currentFindings) {
      const key = findingKey(finding);
      if (allFindingKeys.has(key)) continue;
      const resolved = nextFindingKeys !== void 0 && !nextFindingKeys.has(key);
      allFindingKeys.set(key, {
        severity: finding.severity,
        category: finding.category,
        description: finding.description,
        resolved,
        resolution: resolved ? `Resolved in iteration ${reviewableIterations[i + 1].iteration}` : void 0
      });
    }
  }
  return Array.from(allFindingKeys.values());
}

// src/phases/docs/iteration-log-builder.ts
function buildIterationLog(events, codeResult) {
  const iterationGroups = /* @__PURE__ */ new Map();
  let currentIteration = null;
  for (const event of events) {
    if (event.type === "iteration:start") {
      currentIteration = event.data.iteration;
      if (!iterationGroups.has(currentIteration)) {
        iterationGroups.set(currentIteration, []);
      }
    } else if (event.type === "iteration:end") {
      currentIteration = null;
    } else if (currentIteration !== null) {
      iterationGroups.get(currentIteration).push(event);
    }
  }
  const entries = [];
  for (const [iterationIndex, groupEvents] of iterationGroups) {
    const invokesByRole = /* @__PURE__ */ new Map();
    const resultsByRole = /* @__PURE__ */ new Map();
    for (const event of groupEvents) {
      if (event.type === "agent:invoke") {
        invokesByRole.set(event.data.role, { model: event.data.model });
      } else if (event.type === "agent:result") {
        resultsByRole.set(event.data.role, { durationMs: event.data.durationMs, tokenUsage: event.data.tokenUsage });
      }
    }
    const agentsInvoked = [];
    for (const [role, invoke] of invokesByRole) {
      const result = resultsByRole.get(role);
      const record = {
        role,
        model: invoke.model,
        durationMs: result?.durationMs ?? 0
      };
      if (result?.tokenUsage) {
        record.tokenUsage = result.tokenUsage;
      }
      agentsInvoked.push(record);
    }
    let testResult;
    for (const event of groupEvents) {
      if (event.type === "test:green") {
        testResult = {
          totalTests: event.data.totalTests,
          passingTests: event.data.passingTests,
          failingTests: 0,
          durationMs: 0
        };
      } else if (event.type === "test:fail") {
        testResult = {
          totalTests: event.data.totalTests,
          passingTests: event.data.totalTests - event.data.failingTests,
          failingTests: event.data.failingTests,
          durationMs: 0
        };
      }
    }
    let reviewFindingCount = 0;
    for (const event of groupEvents) {
      if (event.type === "review:findings") {
        reviewFindingCount += event.data.critical + event.data.important + event.data.suggestion;
      }
    }
    const filesChanged = [];
    for (const event of groupEvents) {
      if (event.type === "file:changed") {
        filesChanged.push(event.data.path);
      }
    }
    const iterState = codeResult.iterations.find((it) => it.iteration === iterationIndex);
    let specItem = `Iteration ${iterationIndex}`;
    if (codeResult.batches.length > 0) {
      const firstBatch = codeResult.batches[0];
      if (firstBatch.tasks.length > 0) {
        specItem = firstBatch.tasks[0].title;
      }
    }
    if (iterState) {
      const commit = codeResult.gitState.commits.find((c) => c.iteration === iterationIndex);
      if (commit) {
        specItem = commit.specItem;
      }
    }
    entries.push({
      specItem,
      iterationIndex,
      agentsInvoked,
      testResult,
      reviewFindingCount,
      filesChanged
    });
  }
  return entries;
}
function renderIterationLog(entries) {
  if (entries.length === 0) {
    return "# Iterations\n\nNo iterations recorded.\n";
  }
  const lines = ["# Iterations", ""];
  for (const entry of entries) {
    lines.push(`## Iteration ${entry.iterationIndex}: ${entry.specItem}`);
    lines.push("");
    if (entry.agentsInvoked.length > 0) {
      lines.push("### Agents");
      lines.push("");
      for (const agent of entry.agentsInvoked) {
        let line = `- **${agent.role}** (${agent.model}): ${agent.durationMs}ms`;
        if (agent.tokenUsage) {
          const t = agent.tokenUsage;
          line += ` \u2014 ${t.input.toLocaleString()} in / ${t.output.toLocaleString()} out / ${t.cacheCreation.toLocaleString()} cache_w / ${t.cacheRead.toLocaleString()} cache_r`;
        }
        lines.push(line);
      }
      lines.push("");
    }
    if (entry.testResult) {
      lines.push("### Test Results");
      lines.push("");
      lines.push(`- Total: ${entry.testResult.totalTests}`);
      lines.push(`- Passing: ${entry.testResult.passingTests}`);
      lines.push(`- Failing: ${entry.testResult.failingTests}`);
      lines.push("");
    }
    if (entry.reviewFindingCount > 0) {
      lines.push(`### Review Findings: ${entry.reviewFindingCount}`);
      lines.push("");
    }
    if (entry.filesChanged.length > 0) {
      lines.push("### Files Changed");
      lines.push("");
      for (const file of entry.filesChanged) {
        lines.push(`- ${file}`);
      }
      lines.push("");
    }
  }
  return lines.join("\n");
}

// src/phases/docs/fallback-report.ts
function generateFallbackReport(input) {
  const lines = [];
  lines.push(`# Delivery Report: ${input.sessionId}`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Session**: ${input.sessionId}`);
  lines.push(`- **Spec**: ${input.specPath}`);
  lines.push(`- **Started**: ${input.startedAt}`);
  lines.push(`- **Completed**: ${input.completedAt}`);
  lines.push(`- **Duration**: ${formatDuration(input.totalDuration)}`);
  lines.push(`- **Spec Items**: ${input.specItems.length}`);
  lines.push("");
  lines.push("## Changes");
  lines.push("");
  if (input.specItems.length === 0) {
    lines.push("No spec items were processed.");
  } else {
    for (const item of input.specItems) {
      const status = item.success ? "SUCCESS" : "FAILED";
      lines.push(`### ${item.title} [${status}]`);
      lines.push("");
      lines.push(`- Iterations: ${item.iterationCount}`);
      if (item.commitHash) {
        lines.push(`- Commit: ${item.commitHash}`);
      }
      lines.push("");
      if (item.tasks.length > 0) {
        lines.push("#### Tasks");
        lines.push("");
        for (const task of item.tasks) {
          lines.push(`- **${task.id}**: ${task.title} (${task.tag})`);
          if (task.filesModified.length > 0) {
            for (const file of task.filesModified) {
              lines.push(`  - ${file}`);
            }
          }
        }
        lines.push("");
      }
    }
  }
  lines.push("## Testing");
  lines.push("");
  if (input.specItems.length === 0) {
    lines.push("No test results available.");
  } else {
    for (const item of input.specItems) {
      lines.push(`### ${item.title}`);
      lines.push("");
      lines.push(`- Total: ${item.testResult.totalTests}`);
      lines.push(`- Passing: ${item.testResult.passingTests}`);
      lines.push(`- Failing: ${item.testResult.failingTests}`);
      lines.push(`- Duration: ${item.testResult.durationMs}ms`);
      lines.push("");
    }
  }
  lines.push("## Review");
  lines.push("");
  const allFindings = input.specItems.flatMap((si) => si.reviewFindings);
  if (allFindings.length === 0) {
    lines.push("No issues detected during code review.");
  } else {
    for (const finding of allFindings) {
      const resolvedTag = finding.resolved ? "RESOLVED" : "OPEN";
      lines.push(`- **[${finding.severity}]** ${finding.description} [${resolvedTag}]`);
      if (finding.resolution) {
        lines.push(`  - Resolution: ${finding.resolution}`);
      }
    }
  }
  lines.push("");
  lines.push("## Metrics");
  lines.push("");
  const totalTests = input.specItems.reduce((acc, si) => acc + si.testResult.totalTests, 0);
  const totalPassing = input.specItems.reduce((acc, si) => acc + si.testResult.passingTests, 0);
  const totalFailing = input.specItems.reduce((acc, si) => acc + si.testResult.failingTests, 0);
  const totalIterations = input.specItems.reduce((acc, si) => acc + si.iterationCount, 0);
  const successCount = input.specItems.filter((si) => si.success).length;
  lines.push(`- **Total Tests**: ${totalTests}`);
  lines.push(`- **Passing**: ${totalPassing}`);
  lines.push(`- **Failing**: ${totalFailing}`);
  lines.push(`- **Iterations**: ${totalIterations}`);
  lines.push(`- **Success Rate**: ${input.specItems.length > 0 ? Math.round(successCount / input.specItems.length * 100) : 0}%`);
  lines.push(`- **Duration**: ${formatDuration(input.totalDuration)}`);
  lines.push("");
  return lines.join("\n");
}
function formatDuration(ms) {
  const seconds = Math.floor(ms / 1e3);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes > 0) {
    return `${minutes}m ${remainingSeconds}s`;
  }
  return `${remainingSeconds}s`;
}

// src/phases/docs/docs-prompt.ts
var MAX_FINDING_DESCRIPTION_BYTES = 2048;
var MAX_PROMPT_BYTES = 256 * 1024;
function buildDocWriterPrompt(input) {
  const sections = [];
  sections.push(
    "You are a technical writer. Your task is to produce a delivery report in markdown format."
  );
  sections.push("");
  sections.push("## Session Context");
  sections.push("");
  sections.push(`- **Session ID**: ${input.sessionId}`);
  sections.push(`- **Spec Path**: ${input.specPath}`);
  sections.push(`- **Started**: ${input.startedAt}`);
  sections.push(`- **Completed**: ${input.completedAt}`);
  sections.push(`- **Duration**: ${input.totalDuration}ms`);
  sections.push("");
  sections.push("## Spec Items");
  sections.push("");
  for (const item of input.specItems) {
    const status = item.success ? "SUCCESS" : "FAILED";
    sections.push(`### ${item.title} [${status}]`);
    sections.push("");
    sections.push(`- Iterations: ${item.iterationCount}`);
    if (item.commitHash) {
      sections.push(`- Commit: ${item.commitHash}`);
    }
    sections.push("");
    if (item.tasks.length > 0) {
      sections.push("#### Tasks");
      for (const task of item.tasks) {
        sections.push(`- ${task.id}: ${task.title} (${task.tag})`);
      }
      sections.push("");
    }
    sections.push("#### Test Results");
    sections.push(`- Total: ${item.testResult.totalTests}`);
    sections.push(`- Passing: ${item.testResult.passingTests}`);
    sections.push(`- Failing: ${item.testResult.failingTests}`);
    sections.push(`- Duration: ${item.testResult.durationMs}ms`);
    sections.push("");
    if (item.reviewFindings.length > 0) {
      sections.push("#### Review Findings");
      for (const finding of item.reviewFindings) {
        const description = truncateToBytes(finding.description, MAX_FINDING_DESCRIPTION_BYTES);
        const resolvedTag = finding.resolved ? "RESOLVED" : "OPEN";
        sections.push(`- **[${finding.severity}]** ${description} [${resolvedTag}]`);
        if (finding.resolution) {
          sections.push(`  - Resolution: ${finding.resolution}`);
        }
      }
      sections.push("");
    }
  }
  sections.push("## Output Format Instructions");
  sections.push("");
  sections.push("Produce a markdown document with the following sections:");
  sections.push("1. **Summary** - Overview of the session and outcome");
  sections.push("2. **Changes** - What was implemented, files modified");
  sections.push("3. **Testing** - Test results, pass/fail counts");
  sections.push("4. **Review** - Code review findings and resolutions");
  sections.push("5. **Metrics** - Duration, iteration counts, success rates");
  sections.push("");
  sections.push("Use proper markdown formatting with headers, lists, and tables where appropriate.");
  sections.push("");
  let prompt = sections.join("\n");
  const byteLength = Buffer.byteLength(prompt, "utf8");
  if (byteLength > MAX_PROMPT_BYTES) {
    prompt = truncateToBytes(prompt, MAX_PROMPT_BYTES);
  }
  return prompt;
}
function truncateToBytes(str, maxBytes) {
  const buf = Buffer.from(str, "utf8");
  if (buf.length <= maxBytes) return str;
  const truncated = buf.subarray(0, maxBytes);
  return truncated.toString("utf8").replace(/\uFFFD$/, "");
}

// src/phases/docs/docs-phase.ts
var MAX_RETRIES = 2;
var CONTROL_CHARS_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;
var MAX_PR_BODY_CHARS = 6e4;
function isRetryableErrorCode(code) {
  return code === "timeout" || code === "crash" || code === "empty_output" || code === "invalid_json";
}
function isImmediateFailErrorCode(code) {
  return code === "aborted" || code === "spawn_error";
}
function sanitizeOutput(text) {
  return text.replace(CONTROL_CHARS_RE, "");
}
function verifyPathUnderProject(filePath, projectDir) {
  const resolved = path.resolve(projectDir, filePath);
  if (!resolved.startsWith(path.resolve(projectDir) + path.sep)) {
    throw new Error(`Output path "${filePath}" is outside project directory`);
  }
}
function spawnWithTimeout(cmd, args, cwd, timeoutMs, stdin) {
  return new Promise((resolve2, reject) => {
    const proc = spawn(cmd, args, { cwd });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      proc.kill("SIGTERM");
    }, timeoutMs);
    if (stdin !== void 0 && proc.stdin) {
      proc.stdin.write(stdin);
      proc.stdin.end();
    }
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      clearTimeout(timer);
      if (timedOut) {
        reject(new Error(`${cmd} timed out after ${timeoutMs}ms`));
      } else if (code === 0) {
        resolve2({ stdout, stderr });
      } else {
        reject(new Error(`${cmd} failed (exit ${code}): ${stderr || stdout}`));
      }
    });
    proc.on("error", (err) => {
      clearTimeout(timer);
      reject(new Error(`${cmd} spawn error: ${err.message}`));
    });
  });
}
async function runDocsPhase(ctx, registry, signal) {
  const startTime = Date.now();
  if (signal?.aborted) {
    ctx.emitter.emit({
      type: "phase:error",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      sessionId: ctx.sessionId,
      data: { phase: "docs", reason: "Aborted" }
    });
    throw new Error("Docs phase aborted");
  }
  ctx.emitter.emit({
    type: "phase:start",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: "docs" }
  });
  const loadResult = ctx.state.load();
  if (!loadResult.found || !("valid" in loadResult) || !loadResult.valid) {
    throw new Error("Cannot load state for docs phase");
  }
  const state = loadResult.state;
  const planResult = readPlanPhaseResult(state);
  const tddResult = readTddPhaseResult(state);
  const codeResult = readCodePhaseResult(state);
  if (!codeResult) {
    throw new Error("Missing code phase result \u2014 cannot generate docs");
  }
  const reportInput = buildDeliveryReportInput(ctx, planResult, tddResult, codeResult);
  let reportContent;
  let usedFallback = false;
  const { driver, model, agent } = registry.getDriver("docs");
  const prompt = buildDocWriterPrompt(reportInput);
  let agentSucceeded = false;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) {
      throw new Error("Docs phase aborted");
    }
    const result2 = await driver.invoke({
      prompt,
      role: "docs",
      agent,
      model,
      projectDir: ctx.projectDir,
      signal
    });
    if (result2.success) {
      reportContent = sanitizeOutput(result2.output);
      agentSucceeded = true;
      break;
    }
    if (isImmediateFailErrorCode(result2.errorCode)) {
      break;
    }
    if (result2.errorCode === "aborted") {
      throw new Error("Docs phase aborted");
    }
    if (isRetryableErrorCode(result2.errorCode) && attempt < MAX_RETRIES) {
      ctx.emitter.emit({
        type: "agent:error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: { role: "docs", reason: `${result2.errorCode}: ${result2.error}` }
      });
      continue;
    }
    break;
  }
  if (!agentSucceeded) {
    reportContent = generateFallbackReport(reportInput);
    usedFallback = true;
  }
  const events = ctx.emitter.getEvents();
  const iterationEntries = buildIterationLog(events, codeResult);
  const iterationContent = renderIterationLog(iterationEntries);
  const deliveryReportPath = "delivery-report.md";
  const iterationsLogPath = "iterations.md";
  verifyPathUnderProject(deliveryReportPath, ctx.projectDir);
  verifyPathUnderProject(iterationsLogPath, ctx.projectDir);
  const absDeliveryPath = path.join(ctx.projectDir, deliveryReportPath);
  const absIterationsPath = path.join(ctx.projectDir, iterationsLogPath);
  fs.writeFileSync(absDeliveryPath, reportContent, "utf-8");
  fs.writeFileSync(absIterationsPath, iterationContent, "utf-8");
  let commitHash;
  try {
    commitHash = await commitSpecItem(ctx.projectDir, [deliveryReportPath, iterationsLogPath], "docs(swarm): add delivery report and iteration log");
  } catch (err) {
    process.stderr.write(`Warning: doc commit failed: ${err.message}
`);
  }
  let prUpdated = false;
  let prMarkedReady = false;
  if (codeResult.gitState.prNumber) {
    const prNumber = codeResult.gitState.prNumber;
    try {
      let prBody = reportContent;
      if (prBody.length > MAX_PR_BODY_CHARS) {
        prBody = prBody.slice(0, MAX_PR_BODY_CHARS) + "\n\n...(truncated)";
      }
      await spawnWithTimeout(
        "gh",
        ["pr", "edit", String(prNumber), "--body-file", "-"],
        ctx.projectDir,
        3e4,
        prBody
      );
      prUpdated = true;
    } catch (err) {
      process.stderr.write(`Warning: PR body update failed: ${err.message}
`);
    }
    try {
      await markPrReady(prNumber, ctx.projectDir);
      prMarkedReady = true;
    } catch (err) {
      process.stderr.write(`Warning: mark PR ready failed: ${err.message}
`);
    }
  }
  const result = {
    deliveryReportPath: absDeliveryPath,
    iterationsLogPath: absIterationsPath,
    commitHash,
    prUpdated,
    prMarkedReady,
    usedFallbackReport: usedFallback,
    success: true
  };
  try {
    state.currentPhase = "docs";
    state.completedPhases = [...state.completedPhases, "docs"];
    state.phaseResults = { ...state.phaseResults, docs: result };
    state.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
    ctx.state.save(state);
  } catch (err) {
    process.stderr.write(`Warning: state save failed: ${err.message}
`);
  }
  ctx.emitter.emit({
    type: "phase:end",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: "docs", durationMs: Date.now() - startTime }
  });
  return result;
}
export {
  runDocsPhase
};
