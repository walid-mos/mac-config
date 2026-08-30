import type {
	CompactComponent,
	CompactRenderContext,
	CompactTheme,
	CompactToolResult,
} from "../compact-tools/types.ts";
import { diffLines, type DiffLine } from "./diff.ts";
import { mutationFrameRows, type FrameTheme, type MutationFrameComponent } from "./frame.ts";

export type EditFrameComponent = MutationFrameComponent;

export function parseEditArgs(
	args: Record<string, unknown> | undefined,
): { path: string; edits: Array<{ oldText: string; newText: string }> } | undefined {
	if (typeof args !== "object" || args === null) return undefined;
	const path = String(args.path ?? args.file_path ?? "");
	let rawEdits: unknown = args.edits;
	if (typeof rawEdits === "string") {
		try {
			rawEdits = JSON.parse(rawEdits);
		} catch {
			return undefined;
		}
	}
	const edits: Array<{ oldText: string; newText: string }> = [];
	if (Array.isArray(rawEdits)) {
		for (const entry of rawEdits) {
			if (typeof entry !== "object" || entry === null) return undefined;
			const record = entry as Record<string, unknown>;
			edits.push({
				oldText: String(record.oldText ?? ""),
				newText: String(record.newText ?? ""),
			});
		}
	} else if ("oldText" in args || "newText" in args) {
		edits.push({
			oldText: String(args.oldText ?? ""),
			newText: String(args.newText ?? ""),
		});
	} else {
		return undefined;
	}
	if (edits.length === 0) return undefined;
	return { path, edits };
}

export function editFrameRows(
	path: string,
	edits: ReadonlyArray<{ oldText: string; newText: string }>,
	diffs: ReadonlyArray<ReadonlyArray<DiffLine>>,
	width: number,
	theme: FrameTheme,
): string[] {
	const noun = edits.length === 1 ? "édition" : "éditions";
	return mutationFrameRows(
		{
			tool: "edit",
			path,
			meta: `${edits.length} ${noun}`,
			nativeLabel: "diff natif",
			diffs,
		},
		width,
		theme,
	);
}

export function createEditFrameComponent(
	path: string,
	edits: ReadonlyArray<{ oldText: string; newText: string }>,
	theme: FrameTheme,
): EditFrameComponent {
	let diffs: DiffLine[][] | undefined;
	const compute = (): DiffLine[][] =>
		(diffs ??= edits.map((edit) => diffLines(edit.oldText, edit.newText)));
	return {
		render(width: number): string[] {
			return editFrameRows(path, edits, compute(), width, theme);
		},
		invalidate(): void {},
	};
}

export function editCollapsedBody(
	result: CompactToolResult,
	_options: { expanded?: boolean; isPartial?: boolean },
	theme: CompactTheme,
	context: CompactRenderContext,
): CompactComponent {
	const parsed = parseEditArgs(context.args as Record<string, unknown> | undefined);
	if (!parsed || result.isError) return { render: () => [], invalidate: () => {} };
	return createEditFrameComponent(parsed.path, parsed.edits, theme);
}
