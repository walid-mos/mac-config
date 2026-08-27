import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isRecord } from "./value.ts";
import type { GitPr, GitStatus } from "./types.ts";

const execFileAsync = promisify(execFile);

export async function fetchGitStatus(cwd: string): Promise<GitStatus | null> {
	try {
		const [{ stdout }, { stdout: stashOut }] = await Promise.all([
			execFileAsync("git", ["status", "--porcelain=v2", "--branch"], {
				cwd,
				timeout: 5000,
			}),
			execFileAsync("git", ["stash", "list"], { cwd, timeout: 5000 }),
		]);
		const status: GitStatus = {
			modified: 0,
			staged: 0,
			deleted: 0,
			untracked: 0,
			stash: stashOut.trim() === "" ? 0 : stashOut.trim().split("\n").length,
			ahead: 0,
			behind: 0,
		};
		for (const line of stdout.split("\n")) {
			if (line.startsWith("# branch.ab")) {
				const m = line.match(/\+(\d+)\s+-(\d+)/);
				if (m) {
		status.ahead = Number(m[1]);
		status.behind = Number(m[2]);
				}
				continue;
			}
			if (line.startsWith("? ")) {
				status.untracked++;
				continue;
			}
			// Ordinary entries: `1 <XY> ...`, renamed: `2 <XY> ...`
			if (line.startsWith("1 ") || line.startsWith("2 ")) {
				const xy = line.slice(2, 4);
				const x = xy[0]!; // staged
				const y = xy[1]!; // unstaged
				if (x !== "." && x !== " ") status.staged++;
				if (y === "M") status.modified++;
				else if (y === "D") status.deleted++;
			}
		}
		return status;
	} catch {
		return null;
	}
}


function isGitPr(value: unknown): value is GitPr {
	if (!isRecord(value)) return false;
	const number = value.number;
	const url = value.url;
	return (
		typeof number === "number" &&
		Number.isInteger(number) &&
		number > 0 &&
		typeof url === "string" &&
		url.startsWith("https://")
	);
}

/** Resolve the PR attached to the current branch via `gh`. Null if none / not GitHub. */
export async function fetchCurrentPr(cwd: string): Promise<GitPr | null> {
	try {
		const { stdout } = await execFileAsync("gh", ["pr", "view", "--json", "number,url"], {
			cwd,
			timeout: 8000,
		});
		const parsed: unknown = JSON.parse(stdout);
		return isGitPr(parsed) ? parsed : null;
	} catch {
		return null;
	}
}
