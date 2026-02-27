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
  const program = new Command().name("swarm").description("AI agent orchestrator for autonomous software development").version("0.1.0");
  program.command("run").description("Execute a swarm session").requiredOption("--session <name>", "Session identifier").requiredOption("--spec <path>", "Path to the spec file").requiredOption("--project-dir <path>", "Target project directory").option("--config <path>", "Explicit config file path").option("--dry-run", "Validate config and print plan without running").action((_options) => {
    console.error("swarm run: not yet implemented");
    process.exit(1);
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
