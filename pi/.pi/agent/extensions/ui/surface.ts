import type { Theme } from "@earendil-works/pi-coding-agent";
import { terminalLineWidth, truncateTerminalLine } from "./terminal-text.ts";

export type SurfacePlacement = "aboveEditor" | "belowEditor";

export type SurfaceRenderContext = {
	width: number;
	theme: Theme | undefined;
};

export type SurfaceEntry = {
	id: string;
	placement: SurfacePlacement;
	priority?: number;
	/** Maximum rendered lines kept for this entry; extra lines collapse into a truncation marker. */
	maxLines?: number;
	render: (context: SurfaceRenderContext) => readonly string[];
};

export const DEFAULT_MAX_SURFACE_LINES = 10;

export type SurfaceRegistry = {
	register: (entry: SurfaceEntry) => () => void;
	unregister: (id: string) => boolean;
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

	function unregister(id: string): boolean {
		if (!entries.has(id)) return false;
		entries.delete(id);
		notify();
		return true;
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
			.flatMap((entry) => renderSurfaceEntry(entry, safeWidth, theme));
	}

	function subscribe(listener: () => void): () => void {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	return { register, unregister, clear, hasEntries, render, subscribe };
}

export const surfaceRegistry = createSurfaceRegistry();

export function subscribeSurfaceChanges(listener: () => void): () => void {
	return surfaceRegistry.subscribe(listener);
}

function renderSurfaceEntry(entry: SurfaceEntry, width: number, theme: Theme | undefined): string[] {
	let lines: readonly string[];
	try {
		lines = entry.render({ width, theme });
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : String(error);
		return [`[surface] ${entry.id}: render failed (${message})`].map((line) => clipSurfaceLine(line, width));
	}
	const maxLines = entry.maxLines ?? DEFAULT_MAX_SURFACE_LINES;
	const visible = lines.slice(0, maxLines).map((line) => clipSurfaceLine(line, width));
	if (lines.length <= maxLines) return visible;
	return [...visible, `… (+${String(lines.length - maxLines)} lines)`];
}

function compareSurfaceEntries(left: SurfaceEntry, right: SurfaceEntry): number {
	const priority = (left.priority ?? 0) - (right.priority ?? 0);
	return priority === 0 ? left.id.localeCompare(right.id) : priority;
}

/** Compatibility alias for existing surface clients and tests. */
export const surfaceLineWidth = terminalLineWidth;

function clipSurfaceLine(line: string, width: number): string {
	const firstLine = line.split(/[\r\n]/u, 1)[0] ?? "";
	return truncateTerminalLine(firstLine, width, "…");
}
