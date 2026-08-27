const SKILL_CONTEXT_RE = /(?:^|\s)\/skill:[a-z0-9-]*$/;

export type AppliedCompletion = {
	lines: string[];
	cursorLine: number;
	cursorCol: number;
};

export type CompletionItem = {
	value: string;
};

export function isSkillCompletionContext(textBeforeCursor: string): boolean {
	return SKILL_CONTEXT_RE.test(textBeforeCursor);
}

export function applySkillChainingCompletion(
	delegate: (
		lines: string[],
		cursorLine: number,
		cursorCol: number,
		item: CompletionItem,
		prefix: string,
	) => AppliedCompletion,
	lines: string[],
	cursorLine: number,
	cursorCol: number,
	item: CompletionItem,
	prefix: string,
): AppliedCompletion {
	const currentLine = lines[cursorLine] ?? "";
	const textBefore = currentLine.slice(0, cursorCol);
	if (!isSkillCompletionContext(textBefore)) {
		return delegate(lines, cursorLine, cursorCol, item, prefix);
	}

	const before = currentLine.slice(0, cursorCol - prefix.length);
	const after = currentLine.slice(cursorCol);
	const newLine = before + "/" + item.value + " " + after;
	const newLines = [...lines];
	newLines[cursorLine] = newLine;

	return {
		lines: newLines,
		cursorLine,
		cursorCol: before.length + item.value.length + 2,
	};
}
