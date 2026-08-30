/**
 * Component wrapper around the edit frame: computes the per-edit diffs once,
 * then assembles rows per render width.
 */

import { diffLines, type DiffLine } from "./diff.ts";
import { editFrameRows, type EditFrameComponent, type FrameTheme } from "./frame.ts";

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
