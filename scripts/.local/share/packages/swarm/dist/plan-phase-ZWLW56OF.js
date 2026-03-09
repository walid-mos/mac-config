import {
  buildPlannerPrompt,
  parseTaskDecomposition,
  parseTechStack
} from "./chunk-LAECH3RL.js";

// src/phases/plan/plan-phase.ts
import { readdirSync } from "fs";
var MAX_PLANNER_OUTPUT_BYTES = 256 * 1024;
var MAX_RETRIES = 2;
function getProjectStructure(projectDir) {
  try {
    return readdirSync(projectDir).map((entry) => entry + (entry.includes(".") ? "" : "/"));
  } catch {
    return [];
  }
}
function truncateOutput(output) {
  if (output.length <= MAX_PLANNER_OUTPUT_BYTES) return output;
  return output.slice(0, MAX_PLANNER_OUTPUT_BYTES);
}
function isRetryableErrorCode(code) {
  return code === "timeout" || code === "crash" || code === "empty_output" || code === "invalid_json";
}
function isImmediateFailErrorCode(code) {
  return code === "aborted" || code === "spawn_error";
}
async function runPlanPhase(ctx, registry, specItemContent, signal) {
  const startTime = Date.now();
  if (signal?.aborted) {
    ctx.emitter.emit({
      type: "phase:error",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      sessionId: ctx.sessionId,
      data: { phase: "plan", reason: "Aborted" }
    });
    throw new Error("Plan phase aborted");
  }
  ctx.emitter.emit({
    type: "phase:start",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: "plan" }
  });
  const projectStructure = getProjectStructure(ctx.projectDir);
  const prompt = buildPlannerPrompt(specItemContent, projectStructure);
  const { driver, model, agent } = registry.getDriver("plan");
  let lastError;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) {
      ctx.emitter.emit({
        type: "phase:error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: { phase: "plan", reason: "Aborted" }
      });
      throw new Error("Plan phase aborted");
    }
    const agentResult = await driver.invoke({
      prompt,
      role: "plan",
      agent,
      model,
      projectDir: ctx.projectDir
    });
    if (!agentResult.success) {
      if (isImmediateFailErrorCode(agentResult.errorCode)) {
        ctx.emitter.emit({
          type: "phase:error",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          sessionId: ctx.sessionId,
          data: { phase: "plan", reason: `${agentResult.errorCode}: ${agentResult.error}` }
        });
        throw new Error(`Plan phase failed: ${agentResult.errorCode}: ${agentResult.error}`);
      }
      if (isRetryableErrorCode(agentResult.errorCode) && attempt < MAX_RETRIES) {
        ctx.emitter.emit({
          type: "agent:error",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          sessionId: ctx.sessionId,
          data: { role: "plan", reason: `${agentResult.errorCode}: ${agentResult.error}` }
        });
        continue;
      }
      ctx.emitter.emit({
        type: "phase:error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: { phase: "plan", reason: `All retries exhausted: ${agentResult.errorCode}: ${agentResult.error}` }
      });
      throw new Error(`Plan phase failed after ${attempt + 1} attempts: ${agentResult.errorCode}`);
    }
    const plannerOutput = truncateOutput(agentResult.output);
    try {
      const { tasks } = parseTaskDecomposition(plannerOutput, ctx.projectDir);
      const techStack = parseTechStack(plannerOutput);
      const tags = {};
      for (const task of tasks) {
        tags[task.tag] = (tags[task.tag] ?? 0) + 1;
      }
      const result = {
        plannerOutput,
        tasks,
        techStack,
        taskCount: tasks.length,
        tags
      };
      ctx.emitter.emit({
        type: "phase:end",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: { phase: "plan", durationMs: Date.now() - startTime, taskCount: tasks.length }
      });
      return result;
    } catch (parseError) {
      lastError = parseError instanceof Error ? parseError : new Error(String(parseError));
      if (attempt < MAX_RETRIES) {
        ctx.emitter.emit({
          type: "agent:error",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          sessionId: ctx.sessionId,
          data: { role: "plan", reason: lastError.message }
        });
        continue;
      }
    }
  }
  ctx.emitter.emit({
    type: "phase:error",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: "plan", reason: lastError?.message ?? "Unknown error" }
  });
  throw lastError ?? new Error("Plan phase failed");
}
export {
  runPlanPhase
};
