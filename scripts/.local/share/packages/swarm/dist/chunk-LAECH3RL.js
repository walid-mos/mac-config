// src/phases/plan/planner-prompt.ts
function buildPlannerPrompt(specItemContent, projectStructure) {
  const lines = [];
  lines.push("# Role");
  lines.push("");
  lines.push("You are a senior software architect and planner. Your task is to decompose a feature specification into an ordered set of implementation tasks.");
  lines.push("");
  lines.push("# Specification");
  lines.push("");
  lines.push(specItemContent.trim());
  lines.push("");
  lines.push("# Project Structure");
  lines.push("");
  for (const entry of projectStructure) {
    lines.push(`- ${entry}`);
  }
  lines.push("");
  lines.push("# Constraints");
  lines.push("");
  lines.push("1. Each task MUST have a tag: `backend`, `frontend`, or `fullstack`.");
  lines.push("2. Tasks MUST form a valid DAG \u2014 no circular dependencies allowed.");
  lines.push("3. Each task ID must follow the format `TASK-N` where N is a positive integer.");
  lines.push("4. Each task should cover a distinct domain/concern \u2014 parallel tasks should NOT need to modify the same files.");
  lines.push("5. Task titles MUST be functional, user-facing descriptions of WHAT the feature does \u2014 NOT technical file names or component names.");
  lines.push('   - BAD:  "Create BaseLayout.astro", "Add Header component", "Implement UserService.ts"');
  lines.push('   - GOOD: "Set up base page layout with metadata", "Add site navigation with responsive menu", "Handle user authentication and sessions"');
  lines.push("");
  lines.push("# Output Format");
  lines.push("");
  lines.push("You MUST produce output in this exact rigid markdown template format.");
  lines.push("First, analyze the project to detect its tech stack, then decompose the spec into tasks.");
  lines.push("");
  lines.push("```markdown");
  lines.push("## Tech Stack");
  lines.push("- **Package Manager**: <detect from lockfile: pnpm-lock.yaml \u2192 pnpm, yarn.lock \u2192 yarn, bun.lock \u2192 bun, package-lock.json \u2192 npm>");
  lines.push('- **Test Command**: <full command to run tests, e.g., "pnpm test" or "pnpm exec vitest run">');
  lines.push('- **Build Command**: <full command to build, or "none">');
  lines.push('- **Typecheck Command**: <full command to type-check, e.g. "pnpm exec tsc --noEmit", or "none">');
  lines.push('- **Lint Command**: <full command to lint, e.g. "pnpm exec eslint .", or "none">');
  lines.push("- **Languages**: <comma-separated>");
  lines.push('- **Frameworks**: <comma-separated or "none">');
  lines.push('- **Test Runner**: <name or "none">');
  lines.push('- **Build Tool**: <name or "none">');
  lines.push("- **Config Files**: <comma-separated list of detected config files>");
  lines.push("");
  lines.push("## Task Decomposition");
  lines.push("");
  lines.push("### TASK-1: <title>");
  lines.push("- **Tag**: backend | frontend | fullstack");
  lines.push("- **Dependencies**: none | TASK-X, TASK-Y");
  lines.push("- **Description**: <detailed description of what to implement>");
  lines.push("- **Test hints**: <what tests should verify>");
  lines.push("");
  lines.push("  Test hints MUST describe BEHAVIOR to verify, not just existence checks:");
  lines.push('  - BAD:  "Test that component exists"');
  lines.push('  - GOOD: "Test that nav contains links to all spec-defined sections; verify each anchor target has a matching id"');
  lines.push('  - BAD:  "Test that CSS is loaded"');
  lines.push('  - GOOD: "Test that no inline style attributes are used; verify external stylesheet URL is HTTPS"');
  lines.push("```");
  lines.push("");
  lines.push("Repeat the `### TASK-N` block for each task.");
  lines.push("");
  lines.push("## Command Format Rules");
  lines.push("");
  lines.push("- testCommand, buildCommand, typecheckCommand, and lintCommand must be plain shell commands \u2014 NO markdown, NO backticks, NO parenthetical explanations");
  lines.push('- GOOD: "pnpm test", "pnpm build"');
  lines.push('- BAD: "`pnpm test` (runs `vitest run`)", "pnpm build -- builds the project"');
  return lines.join("\n");
}

// src/phases/plan/task-parser.ts
var TASK_ID_RE = /^TASK-\d+$/;
var VALID_TAGS = /* @__PURE__ */ new Set(["backend", "frontend", "fullstack"]);
var TASK_HEADER_RE = /^###\s+(\S+):\s*(.+)$/;
function validateTaskId(id) {
  if (!TASK_ID_RE.test(id)) {
    throw new Error(`Invalid task ID "${id}": must match TASK-N format`);
  }
}
function validateTag(tag) {
  if (!VALID_TAGS.has(tag)) {
    throw new Error(`Invalid tag "${tag}": must be backend, frontend, or fullstack`);
  }
}
function extractField(lines, prefix) {
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith(`- **${prefix}**:`)) {
      return trimmed.slice(`- **${prefix}**: `.length).trim();
    }
  }
  return "";
}
function parseTaskBlock(headerLine, bodyLines) {
  const headerMatch = TASK_HEADER_RE.exec(headerLine);
  if (!headerMatch) {
    throw new Error(`Invalid task header: ${headerLine}`);
  }
  const id = headerMatch[1];
  const title = headerMatch[2].trim();
  validateTaskId(id);
  const tagRaw = extractField(bodyLines, "Tag");
  validateTag(tagRaw);
  const depsRaw = extractField(bodyLines, "Dependencies");
  const dependencies = [];
  if (depsRaw && depsRaw !== "none") {
    for (const dep of depsRaw.split(",").map((d) => d.trim()).filter((d) => d.length > 0)) {
      validateTaskId(dep);
      dependencies.push(dep);
    }
  }
  const description = extractField(bodyLines, "Description");
  const testHintsRaw = extractField(bodyLines, "Test hints");
  const testHints = testHintsRaw ? testHintsRaw.split(",").map((h) => h.trim()).filter((h) => h.length > 0) : [];
  return {
    id,
    title,
    description,
    tag: tagRaw,
    dependencies,
    testHints
  };
}
function validateDag(tasks) {
  const taskIds = new Set(tasks.map((t) => t.id));
  const inDegree = /* @__PURE__ */ new Map();
  const adjacency = /* @__PURE__ */ new Map();
  for (const task of tasks) {
    inDegree.set(task.id, 0);
    adjacency.set(task.id, []);
  }
  for (const task of tasks) {
    for (const dep of task.dependencies) {
      if (!taskIds.has(dep)) continue;
      adjacency.get(dep).push(task.id);
      inDegree.set(task.id, (inDegree.get(task.id) ?? 0) + 1);
    }
  }
  const queue = [];
  for (const [id, degree] of inDegree) {
    if (degree === 0) {
      queue.push(id);
    }
  }
  let processed = 0;
  while (queue.length > 0) {
    const current = queue.shift();
    processed++;
    for (const neighbor of adjacency.get(current) ?? []) {
      const newDegree = (inDegree.get(neighbor) ?? 1) - 1;
      inDegree.set(neighbor, newDegree);
      if (newDegree === 0) {
        queue.push(neighbor);
      }
    }
  }
  if (processed < tasks.length) {
    const cycleParticipants = [...inDegree.entries()].filter(([, degree]) => degree > 0).map(([id]) => id);
    throw new Error(`Circular dependency detected among tasks: ${cycleParticipants.join(", ")}`);
  }
}
function parseTechStack(plannerOutput) {
  const lines = plannerOutput.split("\n");
  let inSection = false;
  const sectionLines = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^##\s+Tech Stack/i.test(trimmed)) {
      inSection = true;
      continue;
    }
    if (inSection && /^##\s/.test(trimmed)) break;
    if (inSection) sectionLines.push(line);
  }
  const field = (prefix) => extractField(sectionLines, prefix);
  const packageManager = field("Package Manager") || "npm";
  const testCommand = field("Test Command") || `${packageManager} test`;
  const buildCommandRaw = field("Build Command");
  const buildCommand = buildCommandRaw && buildCommandRaw !== "none" ? buildCommandRaw : null;
  const typecheckCommandRaw = field("Typecheck Command");
  const typecheckCommand = typecheckCommandRaw && typecheckCommandRaw !== "none" ? typecheckCommandRaw : null;
  const lintCommandRaw = field("Lint Command");
  const lintCommand = lintCommandRaw && lintCommandRaw !== "none" ? lintCommandRaw : null;
  const languagesRaw = field("Languages");
  const languages = languagesRaw ? languagesRaw.split(",").map((l) => l.trim()).filter((l) => l.length > 0 && l !== "none") : [];
  const frameworksRaw = field("Frameworks");
  const frameworks = frameworksRaw ? frameworksRaw.split(",").map((f) => f.trim()).filter((f) => f.length > 0 && f !== "none") : [];
  const testRunnerRaw = field("Test Runner");
  const testRunner = testRunnerRaw && testRunnerRaw !== "none" ? testRunnerRaw : null;
  const buildToolRaw = field("Build Tool");
  const buildTool = buildToolRaw && buildToolRaw !== "none" ? buildToolRaw : null;
  const configFilesRaw = field("Config Files");
  const configFiles = configFilesRaw ? configFilesRaw.split(",").map((c) => c.trim()).filter((c) => c.length > 0 && c !== "none") : [];
  return {
    languages,
    frameworks,
    testRunner,
    packageManager,
    buildTool,
    configFiles,
    testCommand,
    buildCommand,
    typecheckCommand,
    lintCommand
  };
}
function parseTaskDecomposition(plannerOutput, _projectDir) {
  const lines = plannerOutput.split("\n");
  const tasks = [];
  let currentHeader = null;
  let currentBody = [];
  for (const line of lines) {
    const headerMatch = TASK_HEADER_RE.exec(line.trim());
    if (headerMatch) {
      if (currentHeader !== null) {
        tasks.push(parseTaskBlock(currentHeader, currentBody));
      }
      currentHeader = line.trim();
      currentBody = [];
    } else if (currentHeader !== null) {
      currentBody.push(line);
    }
  }
  if (currentHeader !== null) {
    tasks.push(parseTaskBlock(currentHeader, currentBody));
  }
  validateDag(tasks);
  return { tasks, warnings: [] };
}

export {
  buildPlannerPrompt,
  parseTechStack,
  parseTaskDecomposition
};
