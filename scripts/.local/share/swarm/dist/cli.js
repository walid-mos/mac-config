// src/cli.ts
import * as fs from "fs";
import * as path from "path";
var SYSTEM_ROOTS = /* @__PURE__ */ new Set(["/", "/etc", "/var", "/usr"]);
function validateProjectDir(dir) {
  const canonical = fs.realpathSync(dir);
  if (SYSTEM_ROOTS.has(canonical)) {
    throw new Error(
      `Project directory must not be a system root: ${canonical}`
    );
  }
  const stat = fs.statSync(canonical);
  if (!stat.isDirectory()) {
    throw new Error(
      `Project directory is not a directory: ${canonical}`
    );
  }
}
function validateSpecContainment(specPath, projectDir) {
  const canonicalSpec = fs.realpathSync(specPath);
  const canonicalProject = fs.realpathSync(projectDir);
  if (!canonicalSpec.startsWith(canonicalProject + path.sep)) {
    throw new Error(
      `Spec file "${canonicalSpec}" is not under project directory "${canonicalProject}"`
    );
  }
}
var isDirectExecution = process.argv[1] && (process.argv[1].endsWith("cli.js") || process.argv[1].endsWith("cli.ts"));
if (isDirectExecution) {
  const { Command } = await import("commander");
  const { createSessionId } = await import("./types-4HMPQH6G.js");
  const { resolveSwarmConfig } = await import("./config-resolver-4MRGIVDP.js");
  const { createEventEmitter } = await import("./event-emitter-EY2OHEMR.js");
  const { createStateManager } = await import("./state-manager-SW6EK2LR.js");
  const { createDriverRegistry } = await import("./driver-registry-7TEKPYYV.js");
  const { runPlanPhase } = await import("./plan-phase-2U4R7EOX.js");
  const { runCodePhase } = await import("./code-phase-QGPRWZIM.js");
  const { runDocsPhase } = await import("./docs-phase-ZBVEWYDW.js");
  const program = new Command().name("swarm").description("AI agent orchestrator for autonomous software development").version("0.1.0");
  program.command("run").description("Execute a swarm session").requiredOption("--session <name>", "Session identifier").requiredOption("--spec <path>", "Path to the spec file").requiredOption("--project-dir <path>", "Target project directory").option("--config <path>", "Explicit config file path").option("--dry-run", "Validate config and print plan without running").action(async (options) => {
    try {
      const sessionId = createSessionId(options["session"]);
      const specPath = path.resolve(options["spec"]);
      const projectDir = path.resolve(options["projectDir"]);
      const configPath = options["config"];
      const dryRun = options["dryRun"] === true;
      validateProjectDir(projectDir);
      validateSpecContainment(specPath, projectDir);
      const resolvedConfig = resolveSwarmConfig(projectDir, configPath);
      const runtimeDir = path.join(projectDir, ".swarm", "run", sessionId);
      fs.mkdirSync(runtimeDir, { recursive: true });
      process.env.SWARM_DEBUG_DIR = runtimeDir;
      const emitter = createEventEmitter(sessionId);
      const state = createStateManager(sessionId, { tmpDir: runtimeDir });
      state.acquireLock();
      const ctx = {
        sessionId,
        config: resolvedConfig,
        emitter,
        state,
        specPath,
        projectDir,
        dryRun
      };
      const swarmState = {
        schemaVersion: 1,
        sessionId,
        specPath,
        projectDir,
        config: resolvedConfig.config,
        currentPhase: "init",
        currentIteration: 0,
        currentSpecItem: 0,
        totalSpecItems: 1,
        completedPhases: [],
        phaseResults: {},
        errors: [],
        startedAt: (/* @__PURE__ */ new Date()).toISOString(),
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      };
      state.save(swarmState);
      const controller = new AbortController();
      const onSignal = () => {
        controller.abort();
      };
      process.on("SIGINT", onSignal);
      process.on("SIGTERM", onSignal);
      emitter.emit({
        type: "session:start",
        timestamp: (/* @__PURE__ */ new Date()).toISOString(),
        sessionId,
        data: { specPath, projectDir }
      });
      const signal = controller.signal;
      const worktreeBranch = `swarm/${sessionId}`;
      let exitCode = 1;
      let worktreeCreated = false;
      try {
        const specContent = fs.readFileSync(specPath, "utf-8");
        const registry = createDriverRegistry(resolvedConfig.config, emitter);
        const savePhaseResult = (phase, result) => {
          const lr = state.load();
          if (lr.found && "valid" in lr && lr.valid) {
            const s = lr.state;
            s.currentPhase = phase;
            s.completedPhases = [...s.completedPhases, phase];
            s.phaseResults = { ...s.phaseResults, [phase]: result };
            s.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
            state.save(s);
          }
        };
        const planResult = await runPlanPhase(ctx, registry, specContent, signal);
        savePhaseResult("plan", planResult);
        if (dryRun) {
          process.stdout.write(JSON.stringify(planResult, null, 2) + "\n");
          emitter.emit({
            type: "session:end",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            sessionId,
            data: { success: true, durationMs: Date.now() - Date.parse(swarmState.startedAt) }
          });
          return;
        }
        const { createWorktree } = await import("./git-operations-VEKNCA2Y.js");
        const { worktreePath } = await createWorktree(sessionId, projectDir, worktreeBranch);
        worktreeCreated = true;
        ctx.projectDir = worktreePath;
        ctx.specPath = path.join(worktreePath, path.relative(projectDir, specPath));
        ctx.worktreeBranch = worktreeBranch;
        const wtLoadResult = state.load();
        if (wtLoadResult.found && "valid" in wtLoadResult && wtLoadResult.valid) {
          const s = wtLoadResult.state;
          s.worktreePath = worktreePath;
          s.projectDir = worktreePath;
          s.updatedAt = (/* @__PURE__ */ new Date()).toISOString();
          state.save(s);
        }
        const codeResult = await runCodePhase(ctx, registry, planResult, signal);
        savePhaseResult("code", codeResult);
        await runDocsPhase(ctx, registry, signal);
        try {
          const { spawn: spawnChild } = await import("child_process");
          await new Promise((resolve2, reject) => {
            const proc = spawnChild("git", ["push"], { cwd: ctx.projectDir });
            let stderr = "";
            proc.stderr.on("data", (chunk) => {
              stderr += chunk.toString();
            });
            proc.on("close", (code) => {
              if (code === 0) resolve2();
              else reject(new Error(stderr));
            });
            proc.on("error", (err) => reject(err));
          });
        } catch (err) {
          process.stderr.write(`WARNING: git push skipped (no remote?): ${err.message}
`);
        }
        emitter.emit({
          type: "session:end",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          sessionId,
          data: { success: codeResult.success, durationMs: Date.now() - Date.parse(swarmState.startedAt) }
        });
        exitCode = codeResult.success ? 0 : 1;
      } catch (err) {
        emitter.emit({
          type: "session:error",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          sessionId,
          data: { reason: err.message }
        });
        process.stderr.write(`Error: ${err.message}
`);
        exitCode = 1;
      } finally {
        if (worktreeCreated) {
          const CLEANUP_TIMEOUT_MS = 15e3;
          try {
            const { removeWorktree } = await import("./git-operations-VEKNCA2Y.js");
            await Promise.race([
              removeWorktree(worktreeBranch, projectDir),
              new Promise(
                (_, reject) => setTimeout(() => reject(new Error("Worktree cleanup timed out")), CLEANUP_TIMEOUT_MS)
              )
            ]);
          } catch (err) {
            process.stderr.write(`WARNING: Worktree cleanup failed: ${err.message}
`);
          }
        }
        if (exitCode === 0) {
          try {
            const entries = fs.readdirSync(runtimeDir);
            for (const entry of entries) {
              if (entry.startsWith("swarm-agent-") && entry.endsWith(".ndjson")) {
                fs.unlinkSync(path.join(runtimeDir, entry));
              }
            }
          } catch (err) {
            process.stderr.write(`WARNING: NDJSON cleanup failed: ${err.message}
`);
          }
        }
        process.off("SIGINT", onSignal);
        process.off("SIGTERM", onSignal);
        state.releaseLock();
      }
      process.exit(exitCode);
    } catch (err) {
      process.stderr.write(`Error: ${err.message}
`);
      process.exit(1);
    }
  });
  program.command("resume").description("Resume an interrupted session").requiredOption("--session <name>", "Session identifier").requiredOption("--project-dir <path>", "Target project directory").action((_options) => {
    console.error("swarm resume: not yet implemented");
    process.exit(1);
  });
  program.command("status").description("Show status of a session").requiredOption("--session <name>", "Session identifier").action((_options) => {
    console.error("swarm status: not yet implemented");
    process.exit(1);
  });
  program.command("config").description("Print resolved configuration").requiredOption("--project-dir <path>", "Target project directory").action((_options) => {
    console.error("swarm config: not yet implemented");
    process.exit(1);
  });
  program.parse();
}
export {
  validateProjectDir,
  validateSpecContainment
};
