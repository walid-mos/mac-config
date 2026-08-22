import { spawn } from "node:child_process";

export interface CritExecutionResult {
	stdout: string;
	stderr: string;
	code: number;
	killed: boolean;
}

export type CritProgressHandler = (result: CritExecutionResult) => void;

export function runCritProcess(
	command: string,
	arguments_: string[],
	cwd: string,
	signal: AbortSignal | undefined,
	onProgress: CritProgressHandler | undefined,
): Promise<CritExecutionResult> {
	return new Promise((resolve) => {
		let stdout = "";
		let stderr = "";
		let settled = false;
		const child = spawn(command, arguments_, { cwd, stdio: ["ignore", "pipe", "pipe"] });

		const snapshot = (code = 0, killed = false): CritExecutionResult => ({ stdout, stderr, code, killed });
		const finish = (result: CritExecutionResult): void => {
			if (settled) return;
			settled = true;
			signal?.removeEventListener("abort", abort);
			resolve(result);
		};
		const abort = (): void => {
			if (!settled) child.kill("SIGTERM");
		};
		const publish = (): void => onProgress?.(snapshot());

		child.stdout.on("data", (chunk: Buffer) => {
			stdout += chunk.toString();
			publish();
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
			publish();
		});
		child.on("error", (error) => {
			stderr += `${stderr ? "\n" : ""}${error.message}`;
			finish(snapshot(1, signal?.aborted ?? false));
		});
		child.on("close", (code, terminationSignal) => {
			const killed = signal?.aborted === true || terminationSignal !== null;
			finish(snapshot(code ?? (killed ? 130 : 1), killed));
		});

		if (signal?.aborted) abort();
		else signal?.addEventListener("abort", abort, { once: true });
	});
}
