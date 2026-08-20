/**
 * Incremental Review — Plannotator extension
 *
 * After each review decision (feedback or approve), snapshot the working
 * tree as a dangling commit (no branch commit). The next review opens a
 * `commit:<delta>` diff against that snapshot, so only later changes show —
 * committed or not.
 *
 * State: ~/.plannotator/review-state.json
 * GC pin: tag `_incremental/last-review`
 *
 * Commands:
 *   /incremental-review             — Open review (first=full, then=delta)
 *   /incremental-review-checkpoint  — Mark current working tree as reviewed
 *   /incremental-review-reset       — Clear state for current project
 *   /incremental-review-status      — Show current state
 */

import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  renameSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { join } from "node:path";
import { homedir, tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";

// ── Constants ────────────────────────────────────────────────────────────

const STATE_DIR = join(homedir(), ".plannotator");
const STATE_FILE = join(STATE_DIR, "review-state.json");
const PLANNOTATOR_REQUEST_CHANNEL = "plannotator:request";
const REF_NAME = "_incremental/last-review";
const SNAPSHOT_MESSAGE = "incremental-review snapshot";
const DELTA_MESSAGE = "Changes since last review";
const REVIEW_FIX_COMMIT_INSTRUCTIONS =
  "\n\nApply every actionable review fix. Before reporting completion, inspect `git status`, " +
  "group the fixes by independent domain, and create one atomic commit per domain. " +
  "Stage only the files for that domain; never mix independent domains in a commit. " +
  "Do not leave review-fix files unstaged or untracked; leave pre-existing unrelated changes untouched.";

// ── Types ────────────────────────────────────────────────────────────────

type ProjectState = {
  lastReviewedSha: string;
  lastReviewedAt: number;
};

type State = Record<string, ProjectState>;

type CodeReviewResult = {
  approved: boolean;
  feedback?: string;
  annotations?: unknown[];
  agentSwitch?: string;
  exit?: boolean;
};

type PlannotatorHandledResponse = {
  status: "handled";
  result: CodeReviewResult;
};

type PlannotatorErrorResponse = {
  status: "error";
  error: string;
};

type PlannotatorResponse = PlannotatorHandledResponse | PlannotatorErrorResponse;

// ── Git helpers ──────────────────────────────────────────────────────────

function git(args: string[], cwd: string, extraEnv?: NodeJS.ProcessEnv): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf-8",
    stdio: ["ignore", "pipe", "pipe"],
    env: extraEnv ? { ...process.env, ...extraEnv } : undefined,
  }).trim();
}

function repoRoot(cwd: string): string {
  try {
    return git(["rev-parse", "--show-toplevel"], cwd);
  } catch {
    return cwd;
  }
}

function headSha(cwd: string): string {
  return git(["rev-parse", "HEAD"], cwd);
}

function commitExists(sha: string, cwd: string): boolean {
  try {
    git(["cat-file", "-e", `${sha}^{commit}`], cwd);
    return true;
  } catch {
    return false;
  }
}

function treeSha(rev: string, cwd: string): string {
  return git(["rev-parse", `${rev}^{tree}`], cwd);
}

function pinReviewRef(sha: string, cwd: string): void {
  try {
    git(["tag", "-f", REF_NAME, sha], cwd);
  } catch {
    // Not in a git repo — silently degrade
  }
}

function deleteReviewRef(cwd: string): void {
  try {
    git(["tag", "-d", REF_NAME], cwd);
  } catch {
    // Ignore if tag doesn't exist
  }
}

// ── Working-tree snapshot (no branch commit) ─────────────────────────────

function writeWorkingTree(cwd: string): string {
  const indexDir = mkdtempSync(join(tmpdir(), "incr-review-"));
  try {
    const extraEnv = { GIT_INDEX_FILE: join(indexDir, "index") };
    try {
      git(["read-tree", "HEAD"], cwd, extraEnv);
    } catch {
      // Empty repo: start from an empty index
    }
    git(["add", "-A"], cwd, extraEnv);
    return git(["write-tree"], cwd, extraEnv);
  } finally {
    rmSync(indexDir, { recursive: true, force: true });
  }
}

function commitTree(tree: string, cwd: string, message: string, parent?: string): string {
  const args = ["commit-tree", tree];
  if (parent) args.push("-p", parent);
  args.push("-m", message);
  return git(args, cwd);
}

function snapshotWorkingTree(cwd: string, parent?: string): string {
  const tree = writeWorkingTree(cwd);
  if (parent) return commitTree(tree, cwd, SNAPSHOT_MESSAGE, parent);
  try {
    return commitTree(tree, cwd, SNAPSHOT_MESSAGE, headSha(cwd));
  } catch {
    return commitTree(tree, cwd, SNAPSHOT_MESSAGE);
  }
}

function workingTreeMatches(sha: string, cwd: string): boolean {
  try {
    return writeWorkingTree(cwd) === treeSha(sha, cwd);
  } catch {
    return false;
  }
}

function describeChangesSince(baseSha: string, cwd: string): string {
  try {
    const stats = git(["diff", "--stat", `${baseSha}^{tree}`, writeWorkingTree(cwd)], cwd);
    return stats || "No changes since last review.";
  } catch {
    return "Could not compute diff.";
  }
}

// ── State helpers ────────────────────────────────────────────────────────

function isProjectState(value: unknown): value is ProjectState {
  if (typeof value !== "object" || value === null) return false;
  if (!("lastReviewedSha" in value) || !("lastReviewedAt" in value)) return false;
  return (
    typeof value.lastReviewedSha === "string" &&
    typeof value.lastReviewedAt === "number"
  );
}

function loadState(): State {
  try {
    const parsed: unknown = JSON.parse(readFileSync(STATE_FILE, "utf-8"));
    if (typeof parsed !== "object" || parsed === null) return {};
    const state: State = {};
    for (const [key, value] of Object.entries(parsed)) {
      if (isProjectState(value)) state[key] = value;
    }
    return state;
  } catch {
    return {};
  }
}

function saveState(state: State): void {
  if (!existsSync(STATE_DIR)) mkdirSync(STATE_DIR, { recursive: true });
  const tmpFile = STATE_FILE + ".tmp";
  const body = JSON.stringify(state, null, 2);
  writeFileSync(tmpFile, body);
  try {
    renameSync(tmpFile, STATE_FILE);
  } catch {
    writeFileSync(STATE_FILE, body);
  }
}

function getProjectState(state: State, cwd: string): ProjectState | undefined {
  return state[repoRoot(cwd)];
}

function setProjectState(state: State, cwd: string, project: ProjectState): void {
  state[repoRoot(cwd)] = project;
}

function deleteProjectState(state: State, cwd: string): void {
  delete state[repoRoot(cwd)];
}

function advanceCheckpoint(cwd: string, parent?: string): string {
  const sha = snapshotWorkingTree(cwd, parent);
  const state = loadState();
  setProjectState(state, cwd, { lastReviewedSha: sha, lastReviewedAt: Date.now() });
  saveState(state);
  pinReviewRef(sha, cwd);
  return sha;
}

// ── Feedback forwarding ──────────────────────────────────────────────────

function safeSendMessage(pi: ExtensionAPI, text: string, label: string): void {
  try {
    pi.sendUserMessage(text, { deliverAs: "followUp" });
  } catch (err) {
    const detail = err instanceof Error ? err.message : String(err);
    console.error(`[incremental-review] ${label}: ${detail}`);
  }
}

function isReviewDecision(result: CodeReviewResult): boolean {
  return !result.exit && (result.approved || Boolean(result.feedback));
}

function forwardReviewFeedback(pi: ExtensionAPI, result: CodeReviewResult): void {
  if (result.exit) return;

  if (result.approved) {
    safeSendMessage(pi, `**Review approved.** Continue with the current task.`, "forward approval");
    return;
  }

  if (!result.feedback) return;

  let feedback = result.feedback;
  if ((result.annotations?.length ?? 0) > 0) {
    feedback +=
      "\n\n> Verify that your changes address each annotation before " +
      "marking the review as resolved.";
  }
  safeSendMessage(pi, feedback + REVIEW_FIX_COMMIT_INSTRUCTIONS, "forward review feedback");
}

function onReviewDone(
  pi: ExtensionAPI,
  cwd: string,
): (response: PlannotatorResponse) => void {
  return (response) => {
    if (response.status === "error") {
      safeSendMessage(pi, `⚠️ Review failed: ${response.error}`, "review error");
      return;
    }
    if (!response.result) return;

    if (isReviewDecision(response.result)) {
      try {
        advanceCheckpoint(cwd);
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        console.error(`[incremental-review] snapshot failed: ${detail}`);
      }
    }

    forwardReviewFeedback(pi, response.result);
  };
}

// ── Plannotator ──────────────────────────────────────────────────────────

function openCodeReview(
  pi: ExtensionAPI,
  cwd: string,
  payload: { defaultBranch?: string; diffType?: string } = {},
): void {
  pi.events.emit(PLANNOTATOR_REQUEST_CHANNEL, {
    requestId: randomUUID(),
    action: "code-review",
    payload: { cwd, ...payload },
    respond: onReviewDone(pi, cwd),
  });
}

function openIncrementalReview(pi: ExtensionAPI, cwd: string, baseSha: string): void {
  const deltaSha = commitTree(writeWorkingTree(cwd), cwd, DELTA_MESSAGE, baseSha);
  openCodeReview(pi, cwd, {
    defaultBranch: baseSha,
    diffType: `commit:${deltaSha}`,
  });
}

// ── Extension ────────────────────────────────────────────────────────────

export default function incrementalReview(pi: ExtensionAPI): void {
  pi.registerCommand("incremental-review", {
    description:
      "Open a Plannotator review. First call is a full review. After you " +
      "send feedback or approve, the next call shows only changes since then " +
      "(including uncommitted). /incremental-review-reset clears the base.",
    handler: async (_args, ctx) => {
      const cwd = ctx.cwd;
      const state = loadState();
      const project = getProjectState(state, cwd);
      const savedSha = project?.lastReviewedSha;
      const hasBase = Boolean(savedSha && commitExists(savedSha, cwd));

      if (!hasBase || !savedSha) {
        ctx.ui.notify(
          "📋 Full review. After you send feedback, the next review will only show new changes.",
          "info",
        );
        openCodeReview(pi, cwd);
        return;
      }

      if (workingTreeMatches(savedSha, cwd)) {
        ctx.ui.notify(
          "ℹ️  No new changes since last review. " +
          "Reset with /incremental-review-reset to review everything again.",
          "info",
        );
        return;
      }

      ctx.ui.notify(
        `📋 Changes since last review:\n${describeChangesSince(savedSha, cwd)}`,
        "info",
      );
      openIncrementalReview(pi, cwd, savedSha);
    },
  });

  pi.registerCommand("incremental-review-checkpoint", {
    description:
      "Mark the current working tree as reviewed, without committing. " +
      "Next /incremental-review will only show later changes.",
    handler: async (_args, ctx) => {
      try {
        const sha = advanceCheckpoint(ctx.cwd);
        ctx.ui.notify(
          `✅ Working tree marked as reviewed (${sha.slice(0, 8)}). ` +
          `Next /incremental-review will only show later changes.`,
          "info",
        );
      } catch (err) {
        const detail = err instanceof Error ? err.message : String(err);
        ctx.ui.notify(`Checkpoint failed: ${detail}`, "error");
      }
    },
  });

  pi.registerCommand("incremental-review-reset", {
    description: "Clear incremental review state for the current project",
    handler: async (_args, ctx) => {
      const state = loadState();
      deleteProjectState(state, ctx.cwd);
      saveState(state);
      deleteReviewRef(ctx.cwd);
      ctx.ui.notify("🔄 Incremental review state reset. Next review will be full.", "info");
    },
  });

  pi.registerCommand("incremental-review-status", {
    description: "Show current incremental review state",
    handler: async (_args, ctx: ExtensionContext) => {
      const project = getProjectState(loadState(), ctx.cwd);
      if (!project) {
        ctx.ui.notify("ℹ️  No saved review state for this project.", "info");
        return;
      }

      const sha = project.lastReviewedSha;
      const reachable = commitExists(sha, ctx.cwd);
      const changeLine = !reachable
        ? "saved snapshot is missing (git gc?)"
        : workingTreeMatches(sha, ctx.cwd)
          ? "none"
          : describeChangesSince(sha, ctx.cwd).split("\n")[0] ?? "changed";

      ctx.ui.notify(
        `📋 Incremental review state:\n` +
        `  Last reviewed: ${sha.slice(0, 8)} ` +
        `at ${new Date(project.lastReviewedAt).toLocaleString()}\n` +
        `  Tag: ${REF_NAME}\n` +
        `  Changes: ${changeLine}`,
        "info",
      );
    },
  });
}
