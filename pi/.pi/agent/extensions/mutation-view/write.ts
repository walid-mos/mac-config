import type {
	CompactComponent,
	CompactRenderContext,
	CompactTheme,
	CompactToolResult,
} from "../compact-tools/types.ts";
import type { DiffLine } from "./diff.ts";
import { mutationFrameRows, type FrameTheme, type MutationFrameComponent } from "./frame.ts";

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
	return lines.map((text, index) => ({ kind: "added", text, lineNumber: index + 1 }));
}

export function writeFrameRows(
	path: string,
	content: string,
	width: number,
	theme: FrameTheme,
	expanded = false,
): string[] {
	const diff = writeDiffLines(content);
	const noun = diff.length === 1 ? "ligne" : "lignes";
	return mutationFrameRows(
		{
			tool: "write",
			path,
			stats: [{ text: `+${diff.length} ${noun}`, role: "toolDiffAdded" }],
			nativeLabel: "contenu complet",
			expanded,
			diffs: [diff],
		},
		width,
		theme,
	);
}

export function createWriteFrameComponent(
	path: string,
	content: string,
	theme: FrameTheme,
	expanded = false,
): WriteFrameComponent {
	return {
		render(width: number): string[] {
			return writeFrameRows(path, content, width, theme, expanded);
		},
		invalidate(): void {},
	};
}

export function writeCollapsedBody(
	result: CompactToolResult,
	options: { expanded?: boolean; isPartial?: boolean },
	theme: CompactTheme,
	context: CompactRenderContext,
): CompactComponent {
	const parsed = parseWriteArgs(context.args as Record<string, unknown> | undefined);
	if (!parsed || result.isError) return { render: () => [], invalidate: () => {} };
	return createWriteFrameComponent(parsed.path, parsed.content, theme, options.expanded === true);
}
