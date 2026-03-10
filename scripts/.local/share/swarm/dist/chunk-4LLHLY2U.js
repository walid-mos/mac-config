// src/git/git-operations.ts
import { spawn } from "child_process";

// src/phases/code/file-verification.ts
import * as path from "path";
var BLOCKLIST_PATTERNS = [
  /^\.env($|\.)/,
  // .env, .env.local, .env.production, etc.
  /\.pem$/,
  /\.key$/,
  /credential/i,
  /\.secret$/,
  /^id_rsa/,
  /^\.npmrc$/,
  /^\.netrc$/,
  /\.p12$/,
  /\.pfx$/,
  /\.jks$/
];
function checkStagingBlocklist(files) {
  const allowed = [];
  const blocked = [];
  for (const file of files) {
    const basename2 = path.basename(file);
    let isBlocked = false;
    for (const pattern of BLOCKLIST_PATTERNS) {
      if (pattern.test(basename2)) {
        isBlocked = true;
        break;
      }
    }
    if (isBlocked) {
      blocked.push(file);
    } else {
      allowed.push(file);
    }
  }
  return { allowed, blocked };
}

// src/git/git-operations.ts
var SESSION_ID_RE = /^[a-zA-Z0-9_-]{1,64}$/;
var CONTROL_CHARS_RE = /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/g;
var MAX_COMMIT_MSG_LEN = 500;
var FILE_BATCH_SIZE = 100;
function spawnGit(args, cwd) {
  return new Promise((resolve2, reject) => {
    const proc = spawn("git", args, { cwd });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve2({ stdout: stdout.trimEnd(), stderr: stderr.trimEnd() });
      } else {
        reject(new Error(`git ${args[0]} failed (exit ${code}): ${stderr || stdout}`));
      }
    });
    proc.on("error", (err) => {
      reject(new Error(`git spawn error: ${err.message}`));
    });
  });
}
function spawnCommand(cmd, args, cwd) {
  return new Promise((resolve2, reject) => {
    const proc = spawn(cmd, args, { cwd });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });
    proc.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve2({ stdout: stdout.trimEnd(), stderr: stderr.trimEnd() });
      } else {
        reject(new Error(`${cmd} failed (exit ${code}): ${stderr || stdout}`));
      }
    });
    proc.on("error", (err) => {
      reject(new Error(`${cmd} spawn error: ${err.message}`));
    });
  });
}
async function createWorktree(sessionId, projectDir, branch) {
  if (!SESSION_ID_RE.test(sessionId)) {
    throw new Error(`Invalid session ID "${sessionId}": must match /^[a-zA-Z0-9_-]{1,64}$/`);
  }
  const resolvedBranch = branch ?? `swarm/${sessionId}`;
  const binWt = new URL("../bin/wt", import.meta.url).pathname;
  const { stdout } = await spawnCommand("zsh", [binWt, "new", resolvedBranch, "-y"], projectDir);
  const pathMatch = /Path:\s*(.+)/.exec(stdout);
  if (!pathMatch?.[1]) {
    throw new Error(`Failed to parse worktree path from wt output:
${stdout}`);
  }
  const worktreePath = pathMatch[1].trim();
  const { statSync } = await import("fs");
  try {
    const stat = statSync(worktreePath);
    if (!stat.isDirectory()) {
      throw new Error(`Worktree path exists but is not a directory: "${worktreePath}"`);
    }
  } catch (err) {
    if (err.code === "ENOENT") {
      throw new Error(
        `Worktree creation failed: directory "${worktreePath}" does not exist after wt new.
wt output:
${stdout}`
      );
    }
    throw err;
  }
  return { branch: resolvedBranch, worktreePath };
}
async function removeWorktree(branchOrSessionId, projectDir) {
  const branch = branchOrSessionId.includes("/") ? branchOrSessionId : `swarm/${branchOrSessionId}`;
  const binWt = new URL("../bin/wt", import.meta.url).pathname;
  await spawnCommand("zsh", [binWt, "clean", branch, "-y"], projectDir);
}
async function openDraftPr(branch, sessionId, projectDir) {
  await spawnGit(["push", "-u", "origin", branch], projectDir);
  const { stdout } = await spawnCommand(
    "gh",
    [
      "pr",
      "create",
      "--draft",
      "--title",
      `swarm: ${sessionId}`,
      "--body",
      `Automated PR for swarm session \`${sessionId}\``
    ],
    projectDir
  );
  const prUrl = stdout.trim();
  const prNumberMatch = /\/(\d+)\s*$/.exec(prUrl);
  if (!prNumberMatch) {
    throw new Error(`Failed to parse PR number from gh output: ${prUrl}`);
  }
  return {
    prNumber: parseInt(prNumberMatch[1], 10),
    prUrl
  };
}
async function commitSpecItem(projectDir, changedFiles, message) {
  if (changedFiles.length === 0) {
    throw new Error("No files to commit");
  }
  const { blocked } = checkStagingBlocklist(changedFiles);
  if (blocked.length > 0) {
    throw new Error(`Blocked files cannot be committed: ${blocked.join(", ")}`);
  }
  let sanitized = message.replace(CONTROL_CHARS_RE, "");
  if (sanitized.length > MAX_COMMIT_MSG_LEN) {
    sanitized = sanitized.slice(0, MAX_COMMIT_MSG_LEN);
  }
  for (let i = 0; i < changedFiles.length; i += FILE_BATCH_SIZE) {
    const batch = changedFiles.slice(i, i + FILE_BATCH_SIZE);
    await spawnGit(["add", "--", ...batch], projectDir);
  }
  await spawnGit(["commit", "-m", sanitized], projectDir);
  const { stdout } = await spawnGit(["rev-parse", "HEAD"], projectDir);
  return stdout.trim();
}
async function markPrReady(prNumber, projectDir) {
  await spawnCommand("gh", ["pr", "ready", String(prNumber)], projectDir);
}
var IGNORED_PATH_PREFIXES = [
  "node_modules/",
  "node_modules",
  ".pnpm-store/",
  ".pnpm-store",
  ".git/",
  ".git",
  ".swarm/",
  ".swarm"
];
async function getChangedFiles(projectDir) {
  const { stdout } = await spawnGit(["status", "--porcelain"], projectDir);
  return stdout.split("\n").filter(Boolean).map((line) => line.slice(3)).filter((file) => !IGNORED_PATH_PREFIXES.some((prefix) => file === prefix || file.startsWith(prefix)));
}

export {
  createWorktree,
  removeWorktree,
  openDraftPr,
  commitSpecItem,
  markPrReady,
  getChangedFiles
};
