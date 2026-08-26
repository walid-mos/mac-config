import type { Theme } from "@earendil-works/pi-coding-agent";

export type SurfacePlacement = "aboveEditor" | "belowEditor";

export type SurfaceRenderContext = {
	width: number;
	theme: Theme | undefined;
};

export type SurfaceEntry = {
	id: string;
	placement: SurfacePlacement;
	priority?: number;
	render: (context: SurfaceRenderContext) => readonly string[];
};

export type SurfaceRegistry = {
	register: (entry: SurfaceEntry) => () => void;
	clear: () => void;
	hasEntries: (placement?: SurfacePlacement) => boolean;
	render: (placement: SurfacePlacement, width: number, theme?: Theme) => string[];
	subscribe: (listener: () => void) => () => void;
};

export function createSurfaceRegistry(): SurfaceRegistry {
	const entries = new Map<string, SurfaceEntry>();
	const listeners = new Set<() => void>();

	function notify(): void {
		for (const listener of listeners) listener();
	}

	function register(entry: SurfaceEntry): () => void {
		entries.set(entry.id, entry);
		notify();
		let registered = true;
		return () => {
			if (!registered) return;
			registered = false;
			if (entries.get(entry.id) !== entry) return;
			entries.delete(entry.id);
			notify();
		};
	}

	function clear(): void {
		if (entries.size === 0) return;
		entries.clear();
		notify();
	}

	function hasEntries(placement?: SurfacePlacement): boolean {
		return [...entries.values()].some((entry) => placement === undefined || entry.placement === placement);
	}

	function render(placement: SurfacePlacement, width: number, theme?: Theme): string[] {
		const safeWidth = Number.isFinite(width) ? Math.max(0, Math.floor(width)) : 0;
		if (safeWidth === 0) return [];
		return [...entries.values()]
			.filter((entry) => entry.placement === placement)
			.sort(compareSurfaceEntries)
			.flatMap((entry) =>
				entry
					.render({ width: safeWidth, theme })
					.map((line) => clipSurfaceLine(line, safeWidth)),
			);
	}

	function subscribe(listener: () => void): () => void {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	return { register, clear, hasEntries, render, subscribe };
}

export const surfaceRegistry = createSurfaceRegistry();

export function subscribeSurfaceChanges(listener: () => void): () => void {
	return surfaceRegistry.subscribe(listener);
}

function compareSurfaceEntries(left: SurfaceEntry, right: SurfaceEntry): number {
	const priority = (left.priority ?? 0) - (right.priority ?? 0);
	return priority === 0 ? left.id.localeCompare(right.id) : priority;
}

function clipSurfaceLine(line: string, width: number): string {
	const firstLine = line.split(/[\r\n]/u, 1)[0] ?? "";
	const tokens = firstLine.match(SURFACE_TOKEN_PATTERN) ?? [];
	const visible = tokens.reduce(
		(total, token) => (isAnsiSequence(token) ? total : total + terminalCharWidth(token)),
		0,
	);
	if (visible <= width) return firstLine;
	const budget = Math.max(0, width - 1);
	let used = 0;
	let clipped = "";
	let hasAnsi = false;
	for (const token of tokens) {
		if (isAnsiSequence(token)) {
			hasAnsi = true;
			clipped += token;
			continue;
		}
		const tokenWidth = terminalCharWidth(token);
		if (used + tokenWidth > budget) break;
		used += tokenWidth;
		clipped += token;
	}
	clipped += "…";
	return hasAnsi ? `${clipped}\u001b[0m` : clipped;
}

const SURFACE_TOKEN_PATTERN = /\u001b\[[0-?]*[ -/]*[@-~]|./gu;
const ANSI_SEQUENCE_PATTERN = /^\u001b\[/u;

function isAnsiSequence(token: string): boolean {
	return ANSI_SEQUENCE_PATTERN.test(token);
}

function terminalCharWidth(token: string): number {
	const codePoint = token.codePointAt(0) ?? 0;
	if (
		(codePoint >= 0x1100 && codePoint <= 0x115f) ||
		(codePoint >= 0x2329 && codePoint <= 0x232a) ||
		(codePoint >= 0x2e80 && codePoint <= 0xa4cf) ||
		(codePoint >= 0xac00 && codePoint <= 0xd7a3) ||
		(codePoint >= 0xf900 && codePoint <= 0xfaff) ||
		(codePoint >= 0xfe10 && codePoint <= 0xfe6f) ||
		(codePoint >= 0xff00 && codePoint <= 0xff60) ||
		(codePoint >= 0xffe0 && codePoint <= 0xffe6) ||
		(codePoint >= 0x1f300 && codePoint <= 0x1faff)
	) {
		return 2;
	}
	return 1;
}
