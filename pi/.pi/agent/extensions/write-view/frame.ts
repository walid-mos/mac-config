import { mutationFrameRows, type FrameTheme, type MutationFrameComponent } from "../mutation-view/frame.ts";
import type { DiffLine } from "../edit-view/diff.ts";

export type { FrameTheme };
export type WriteFrameComponent = MutationFrameComponent;

export interface ParsedWriteArgs {
	path: string;
	content: string;
}

export function parseWriteArgs(args: Record<string, unknown> | undefined): ParsedWriteArgs | undefined {
	if (typeof args !== "object" || args === null || typeof args.content !== "string") return undefined;
	return {
		path: String(args.path ?? args.file_path ?? ""),
		content: args.content,
	};
}

export function writeDiffLines(content: string): DiffLine[] {
	const lines = content.replace(/\r\n?/g, "\n").split("\n");
	while (lines.length > 0 && lines[lines.length - 1] === "") lines.pop();
	return lines.map((text) => ({ kind: "added", text }));
}

export function writeFrameRows(path: string, content: string, width: number, theme: FrameTheme): string[] {
	const diff = writeDiffLines(content);
	const noun = diff.length === 1 ? "ligne" : "lignes";
	return mutationFrameRows(
		{
			tool: "write",
			path,
			meta: `${diff.length} ${noun}`,
			nativeLabel: "contenu natif",
			diffs: [diff],
		},
		width,
		theme,
	);
}
