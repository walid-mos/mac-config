import {
  parseStructuredOutput
} from "./chunk-ELEMRGRH.js";

// src/phases/tdd/test-prompt.ts
function buildTestPrompt(plannerOutput, tasks, techStack, testConventions) {
  const lines = [];
  lines.push("# Role");
  lines.push("");
  lines.push("You are a TDD test engineer. Your single purpose is to write **failing tests** (RED phase) that define expected behavior for each task. Tests must be syntactically valid, compile successfully, and **fail for the right reason** \u2014 they fail because the implementation does not exist yet, not because the test is broken.");
  lines.push("");
  lines.push("# Tech Stack");
  lines.push("");
  lines.push(`- **Test Runner**: ${techStack.testRunner ?? "not detected"}`);
  lines.push(`- **Languages**: ${techStack.languages.join(", ") || "none"}`);
  lines.push(`- **Frameworks**: ${techStack.frameworks.join(", ") || "none"}`);
  lines.push(`- **Test Command**: ${techStack.testCommand}`);
  lines.push("");
  lines.push("# Planner Output");
  lines.push("");
  lines.push(plannerOutput.trim());
  lines.push("");
  lines.push("# Tasks to Test");
  lines.push("");
  for (const task of tasks) {
    lines.push(`## ${task.id}: ${task.title}`);
    lines.push(`- **Tag**: ${task.tag}`);
    lines.push(`- **Description**: ${task.description}`);
    lines.push(`- **Test hints**: ${task.testHints.join(", ")}`);
    lines.push("");
  }
  lines.push("# Testing Conventions");
  lines.push("");
  for (const convention of testConventions) {
    lines.push(`- ${convention}`);
  }
  lines.push("");
  lines.push("# What to Test");
  lines.push("");
  lines.push("For each task, test the following behaviors:");
  lines.push("");
  lines.push("## Happy Path");
  lines.push("- Expected inputs produce expected outputs");
  lines.push("- Core business logic behaves correctly");
  lines.push("- Return types and shapes are correct");
  lines.push("");
  lines.push("## Edge Cases");
  lines.push("- Empty inputs (null, undefined, empty string, empty array, empty object)");
  lines.push("- Boundary values (min, max, zero, negative, overflow)");
  lines.push("- Single-element vs multi-element collections");
  lines.push("- Unicode / special characters in string inputs");
  lines.push("");
  lines.push("## Error Handling");
  lines.push("- Invalid inputs throw or return appropriate errors");
  lines.push("- Missing required parameters are rejected");
  lines.push("- Malformed data is handled gracefully");
  lines.push("- Async operations that fail are caught and propagated");
  lines.push("");
  lines.push("## Security");
  lines.push("- Input validation rejects injection attempts (SQL, XSS, command injection)");
  lines.push("- Authentication/authorization checks are enforced");
  lines.push("- Sensitive data is not leaked in error messages or logs");
  lines.push("- Path traversal attempts are blocked");
  lines.push("- Rate limiting / resource limits are enforced where applicable");
  lines.push("");
  lines.push("## Functional Behavior");
  lines.push("- If the spec describes user-facing features (navigation, forms, interactions), tests must verify the BEHAVIOR works \u2014 not just that markup exists");
  lines.push('- For links: verify both the link AND its target exist (e.g., an anchor `href="#X"` is useless without a matching `id="X"`)');
  lines.push("- For components that compose into pages: verify the composition works (imports resolve, slots/props are passed)");
  lines.push("- For external resources: verify URLs are well-formed and use HTTPS");
  lines.push("");
  lines.push("IMPORTANT: Tests must verify BEHAVIOR, not just structure.");
  lines.push("- BAD:  `expect(content).toContain('href=\"#features\"')`  \u2014 only checks string presence");
  lines.push('- GOOD: also verify `id="features"` exists on the target element');
  lines.push("- BAD:  `expect(existsSync('Component.astro')).toBe(true)` \u2014 only checks file exists");
  lines.push("- GOOD: read the file and verify it contains the spec-required content/structure");
  lines.push("");
  lines.push("# Test Writing Guidelines");
  lines.push("");
  lines.push("## Naming Convention \u2014 MANDATORY");
  lines.push("");
  lines.push("`describe` blocks and `it` names MUST use functional, user-facing language. NEVER use technical file names, component names, or task IDs.");
  lines.push("- BAD:  `describe('BaseLayout.astro')`, `it('creates Header component')`");
  lines.push("- GOOD: `describe('Base page layout')`, `it('includes site metadata and viewport settings')`");
  lines.push("- BAD:  `describe('TASK-1')`, `it('renders FeaturesSection')`");
  lines.push("- GOOD: `describe('Features showcase')`, `it('displays feature cards with icons and descriptions')`");
  lines.push("");
  lines.push("## DO");
  lines.push("- Test public API / exported functions only");
  lines.push('- Test behavior: "given X input, expect Y output"');
  lines.push('- Test error conditions: "given invalid input, expect specific error"');
  lines.push("- Use descriptive `describe` blocks that read like documentation");
  lines.push("- Use factory functions or builders for test data");
  lines.push("- Mock external dependencies (DB, HTTP, file system) at module boundaries");
  lines.push("- Keep each test focused on one behavior");
  lines.push("- Use clear test names: `it('returns empty array when no items match filter')`");
  lines.push("");
  lines.push("## DON'T");
  lines.push("- Don't test private/internal functions directly");
  lines.push("- Don't use snapshot tests");
  lines.push("- Don't test framework internals");
  lines.push("- Don't write tests that depend on execution order");
  lines.push("- Don't duplicate assertions across tests");
  lines.push("- Don't mock the module under test");
  lines.push("- Don't write overly specific assertions that break on irrelevant changes");
  lines.push("");
  lines.push("## Mock Strategy");
  lines.push("- **External services**: Always mock (DB, HTTP, file system, third-party APIs)");
  lines.push("- **Internal modules**: Mock only at architectural boundaries (e.g., mock the repository when testing the service)");
  lines.push("- **Utilities**: Don't mock pure utility functions \u2014 use them directly");
  lines.push("");
  lines.push("# Constraints");
  lines.push("");
  lines.push("1. All tests MUST fail in the RED phase \u2014 they fail because implementation doesn't exist, not because the test is broken.");
  lines.push("2. Tests MUST be syntactically valid \u2014 they must compile and be parseable by the test runner.");
  lines.push("3. Write one test file per task. Follow project directory conventions.");
  lines.push("4. Use describe/it/expect patterns appropriate for the test runner.");
  lines.push("5. Test file paths must be relative to the project root.");
  lines.push("6. Minimum 3 tests per task: happy path + edge case + error case.");
  lines.push("7. NEVER write implementation code \u2014 tests only.");
  lines.push("8. Tests MUST verify that the implementation WORKS, not just that files exist or strings are present. If the spec describes linked elements (nav \u2192 sections, form \u2192 endpoint, button \u2192 action), test BOTH sides of the link.");
  lines.push('9. NEVER write a test that passes when implementation is broken. If a test checks `href="#X"` exists, it MUST also check that an element with `id="X"` exists \u2014 otherwise the test gives false confidence.');
  lines.push("10. NEVER write tests that pass before implementation \u2014 if a test passes, it tests nothing useful.");
  lines.push("");
  lines.push("# Execution");
  lines.push("");
  lines.push("After writing tests, run them to verify they fail (red phase):");
  lines.push(`- Command: ${techStack.testCommand}`);
  lines.push("- Tests MUST fail (red) since no implementation exists yet");
  lines.push("- If tests pass, they are wrong \u2014 tests that pass without implementation are useless");
  lines.push("");
  lines.push("# Output");
  lines.push("");
  lines.push("After running tests, output a JSON block:");
  lines.push("```json");
  lines.push('{ "testFiles": ["path/to/test.ts"], "testResult": { "totalTests": 0, "passingTests": 0, "failingTests": 0 }, "isRed": true }');
  lines.push("```");
  return lines.join("\n");
}

// src/phases/tdd/tdd-phase.ts
var MAX_RETRIES = 2;
function isRetryableErrorCode(code) {
  return code === "timeout" || code === "crash" || code === "empty_output" || code === "invalid_json";
}
function isImmediateFailErrorCode(code) {
  return code === "aborted" || code === "spawn_error";
}
function extractTddAgentOutput(output) {
  const parsed = parseStructuredOutput(output);
  if (!parsed.ok) return null;
  try {
    const json = JSON.parse(parsed.output);
    if (!json.testFiles || !Array.isArray(json.testFiles)) return null;
    return {
      testFiles: json.testFiles,
      testResult: {
        totalTests: json.testResult?.totalTests ?? 0,
        passingTests: json.testResult?.passingTests ?? 0,
        failingTests: json.testResult?.failingTests ?? 0,
        durationMs: json.testResult?.durationMs ?? 0
      },
      isRed: json.isRed ?? false
    };
  } catch {
    return null;
  }
}
var DEFAULT_AGENT_OUTPUT = {
  testFiles: ["tests/feature.test.ts"],
  testResult: { totalTests: 0, passingTests: 0, failingTests: 0, durationMs: 0 },
  isRed: false
};
async function runTddPhase(ctx, registry, plan, signal) {
  const startTime = Date.now();
  if (signal?.aborted) {
    ctx.emitter.emit({
      type: "phase:error",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      sessionId: ctx.sessionId,
      data: { phase: "tdd", reason: "Aborted" }
    });
    throw new Error("TDD phase aborted");
  }
  ctx.emitter.emit({
    type: "phase:start",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: "tdd" }
  });
  const testConventions = [
    "tests/**/*.test.ts",
    `Use ${plan.techStack.testRunner ?? "default"} test runner`
  ];
  const prompt = buildTestPrompt(plan.plannerOutput, plan.tasks, plan.techStack, testConventions);
  const { driver, model, agent } = registry.getDriver("test");
  let currentPrompt = prompt;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (signal?.aborted) {
      ctx.emitter.emit({
        type: "phase:error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: { phase: "tdd", reason: "Aborted" }
      });
      throw new Error("TDD phase aborted");
    }
    const agentResult = await driver.invoke({
      prompt: currentPrompt,
      role: "test",
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
          data: { phase: "tdd", reason: `${agentResult.errorCode}: ${agentResult.error}` }
        });
        throw new Error(`TDD phase failed: ${agentResult.errorCode}: ${agentResult.error}`);
      }
      if (isRetryableErrorCode(agentResult.errorCode) && attempt < MAX_RETRIES) {
        const reason = agentResult.errorCode === "timeout" && agentResult.stderr ? `${agentResult.errorCode}: ${agentResult.error} \u2014 stderr: ${agentResult.stderr.slice(0, 300)}` : `${agentResult.errorCode}: ${agentResult.error}`;
        ctx.emitter.emit({
          type: "agent:error",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          sessionId: ctx.sessionId,
          data: { role: "test", reason }
        });
        continue;
      }
      ctx.emitter.emit({
        type: "phase:error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: { phase: "tdd", reason: `All retries exhausted: ${agentResult.errorCode}` }
      });
      throw new Error(`TDD phase failed after ${attempt + 1} attempts: ${agentResult.errorCode}`);
    }
    const agentOutput = extractTddAgentOutput(agentResult.output) ?? DEFAULT_AGENT_OUTPUT;
    if (agentOutput.testResult.totalTests === 0) {
      if (attempt < MAX_RETRIES) {
        currentPrompt = `${prompt}

# Previous Attempt Failed \u2014 Zero Tests

Your previous attempt produced zero compilable tests. Please produce compilable, failing test files. Remember to run the tests and include the JSON output block.`;
        ctx.emitter.emit({
          type: "agent:error",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          sessionId: ctx.sessionId,
          data: { role: "test", reason: "Zero tests produced" }
        });
        continue;
      }
      ctx.emitter.emit({
        type: "test:fail",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: { totalTests: 0, failingTests: 0, reason: "Test agent produced zero tests" }
      });
      ctx.emitter.emit({
        type: "phase:end",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: { phase: "tdd", durationMs: Date.now() - startTime }
      });
      return { testFiles: agentOutput.testFiles, agentReport: agentOutput };
    }
    if (!agentOutput.isRed && attempt < MAX_RETRIES) {
      currentPrompt = `${prompt}

# Previous Attempt Failed \u2014 Tests Not Red

Your tests passed without implementation. Tests that pass before implementation are useless. Rewrite tests that properly fail.`;
      ctx.emitter.emit({
        type: "agent:error",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: { role: "test", reason: "Tests not red \u2014 passed without implementation" }
      });
      continue;
    }
    if (agentOutput.isRed) {
      ctx.emitter.emit({
        type: "test:red",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: {
          totalTests: agentOutput.testResult.totalTests,
          passingTests: agentOutput.testResult.passingTests,
          failingTests: agentOutput.testResult.failingTests
        }
      });
    } else {
      ctx.emitter.emit({
        type: "test:green",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId: ctx.sessionId,
        data: {
          totalTests: agentOutput.testResult.totalTests,
          passingTests: agentOutput.testResult.passingTests
        }
      });
    }
    ctx.emitter.emit({
      type: "phase:end",
      timestamp: (/* @__PURE__ */ new Date()).toISOString(),
      sessionId: ctx.sessionId,
      data: { phase: "tdd", durationMs: Date.now() - startTime }
    });
    return {
      testFiles: agentOutput.testFiles,
      agentReport: agentOutput
    };
  }
  ctx.emitter.emit({
    type: "phase:error",
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    sessionId: ctx.sessionId,
    data: { phase: "tdd", reason: "Unknown error" }
  });
  throw new Error("TDD phase failed");
}
export {
  runTddPhase
};
