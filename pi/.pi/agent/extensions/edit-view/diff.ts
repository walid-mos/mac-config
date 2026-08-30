/**
 * Pure line-level diff (LCS) between an edit's oldText and newText.
 * No IO, no theme, no pi imports — fully unit-testable.
 */

export type DiffLineKind = "removed" | "added" | "context";

export interface DiffLine {
	kind: DiffLineKind;
	text: string;
}

/** Upper bound on LCS table cells before falling back to a raw replace-all. */
const MAX_TABLE_CELLS = 4_000_000;

function splitLines(text: string): string[] {
	if (text.length === 0) return [];
	return text.split("\n");
}

/** Backtracks the LCS table into removed/added runs (no context rows). */
function lcsDiff(a: string[], b: string[]): DiffLine[] {
	const rows = a.length;
	const cols = b.length;
	const widths = cols + 1;
	const table = new Uint32Array((rows + 1) * widths);
	for (let i = rows - 1; i >= 0; i--) {
		for (let j = cols - 1; j >= 0; j--) {
			table[i * widths + j] =
				a[i] === b[j]
					? table[(i + 1) * widths + j + 1] + 1
					: Math.max(table[(i + 1) * widths + j], table[i * widths + j + 1]);
		}
	}
	const lines: DiffLine[] = [];
	let i = 0;
	let j = 0;
	while (i < rows && j < cols) {
		if (a[i] === b[j]) {
			lines.push({ kind: "context", text: a[i] });
			i++;
			j++;
		} else if (table[(i + 1) * widths + j] >= table[i * widths + j + 1]) {
			lines.push({ kind: "removed", text: a[i] });
			i++;
		} else {
			lines.push({ kind: "added", text: b[j] });
			j++;
		}
	}
	while (i < rows) lines.push({ kind: "removed", text: a[i++] });
	while (j < cols) lines.push({ kind: "added", text: b[j++] });
	return lines;
}

/** Line diff of one replacement: context rows around removed/added runs. */
export function diffLines(oldText: string, newText: string): DiffLine[] {
	const a = splitLines(oldText);
	const b = splitLines(newText);
	let start = 0;
	while (start < a.length && start < b.length && a[start] === b[start]) start++;
	let endA = a.length;
	let endB = b.length;
	while (endA > start && endB > start && a[endA - 1] === b[endB - 1]) {
		endA--;
		endB--;
	}

	const lines: DiffLine[] = [];
	for (let i = 0; i < start; i++) lines.push({ kind: "context", text: a[i] });
	const midA = a.slice(start, endA);
	const midB = b.slice(start, endB);
	if (midA.length === 0 && midB.length === 0) {
		// Identical texts: the common middle is empty, context already emitted.
	} else if (midA.length * midB.length > MAX_TABLE_CELLS) {
		for (const text of midA) lines.push({ kind: "removed", text });
		for (const text of midB) lines.push({ kind: "added", text });
	} else {
		lines.push(...lcsDiff(midA, midB));
	}
	for (let i = endA; i < a.length; i++) {
		lines.push({ kind: "context", text: a[i] });
	}
	return lines;
}
