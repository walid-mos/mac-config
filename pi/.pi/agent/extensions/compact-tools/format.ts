export type CompactToolArgs = {
	path?: string;
	pattern?: string;
	glob?: string;
	command?: string;
	offset?: number;
	limit?: number;
	timeout?: number;
	content?: string;
};

export const MAX_COMMAND_LENGTH = 80;
export const MAX_DISPLAY_PATH = 48;
const PATH_ELLIPSIS = "…";

export function truncate(text: string, max: number): string {
	return text.length > max ? `${text.slice(0, max - 3)}...` : text;
}

export function compactPath(path: string, max: number = MAX_DISPLAY_PATH): string {
	if (path.length <= max) return path;
	const parts = path.split("/").filter((part) => part.length > 0);
	const last = parts[parts.length - 1];
	if (!last) return truncate(path, max);
	let tail = last;
	for (let i = parts.length - 2; i >= 0; i--) {
		const next = `${parts[i]}/${tail}`;
		const candidate = `${PATH_ELLIPSIS}/${next}`;
		if (candidate.length > max) break;
		tail = next;
	}
	const compacted = `${PATH_ELLIPSIS}/${tail}`;
	if (compacted.length <= max) return compacted;
	const prefix = `${PATH_ELLIPSIS}/`;
	if (max <= prefix.length) return prefix.slice(0, max);
	return `${prefix}${last.slice(-(max - prefix.length))}`;
}

export function joinCollapsed(header: string, meta: string): string {
	return `${header} · ${meta}`;
}

export function showCallLine(context: { expanded: boolean; isPartial: boolean }): boolean {
	return context.expanded || context.isPartial;
}

export function readHeader(args: CompactToolArgs, shortenPath: (path: string) => string): string {
	let header = `read ${shortenPath(args.path || "...")}`;
	if (args.offset !== undefined || args.limit !== undefined) {
		const start = args.offset ?? 1;
		const end = args.limit !== undefined ? start + args.limit - 1 : "";
		header += `:${start}${end ? `-${end}` : ""}`;
	}
	return header;
}

export function bashHeader(args: CompactToolArgs): string {
	const singleLineCommand = (args.command || "...").replace(/\s*\r?\n\s*/g, " ↵ ");
	const command = truncate(singleLineCommand, MAX_COMMAND_LENGTH);
	let header = `$ ${command}`;
	if (args.timeout) header += ` (timeout ${args.timeout}s)`;
	return header;
}

export function editHeader(args: CompactToolArgs, shortenPath: (path: string) => string): string {
	return `edit ${shortenPath(args.path || "...")}`;
}

export function writeHeader(args: CompactToolArgs, shortenPath: (path: string) => string): string {
	const lines = args.content ? args.content.split("\n").length : 0;
	let header = `write ${shortenPath(args.path || "...")}`;
	if (lines > 0) header += ` (${lines} lines)`;
	return header;
}

export function grepHeader(args: CompactToolArgs, shortenPath: (path: string) => string): string {
	let header = `grep /${args.pattern || ""}/`;
	header += ` in ${shortenPath(args.path || ".")}`;
	if (args.glob) header += ` (${args.glob})`;
	return header;
}

export function findHeader(args: CompactToolArgs, shortenPath: (path: string) => string): string {
	return `find ${args.pattern || ""} in ${shortenPath(args.path || ".")}`;
}

export function lsHeader(args: CompactToolArgs, shortenPath: (path: string) => string): string {
	return `ls ${shortenPath(args.path || ".")}`;
}
