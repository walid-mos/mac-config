import type { CritExecutionResult } from "./process.ts";

export function formatCritProgress(result: CritExecutionResult): string {
	const output = [result.stdout.trim(), result.stderr.trim()].filter(Boolean).join("\n");
	return output || "Starting Crit review…";
}

export function formatCritOutput(result: CritExecutionResult): string {
	const sections: string[] = [];
	if (result.stdout.trim()) sections.push(`Crit instructions (stdout):\n${result.stdout.trim()}`);
	if (result.stderr.trim()) sections.push(`Crit status (stderr):\n${result.stderr.trim()}`);
	if (sections.length === 0) sections.push("Crit finished without emitting instructions.");
	sections.push(`Crit exited with code ${result.code}${result.killed ? " (cancelled)" : ""}.`);
	return sections.join("\n\n");
}
