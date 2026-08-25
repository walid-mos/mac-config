import type { Theme } from "@earendil-works/pi-coding-agent";

export type SurfacePlacement = "aboveEditor" | "belowEditor" | "footer";
export type SurfacePreset = "compact" | "default" | "full";
export type SurfaceMode = "auto" | "manual";
export type SurfaceDensity = "compact" | "detailed";

export const SURFACE_PRESETS: readonly SurfacePreset[] = ["compact", "default", "full"];
export const DEFAULT_SURFACE_PREFERENCES: SurfacePreferences = {
	version: 1,
	mode: "auto",
	preset: "default",
};

export type SurfacePreferences = {
	version: 1;
	mode: SurfaceMode;
	preset: SurfacePreset;
};

export type SurfaceRenderContext = {
	width: number;
	theme: Theme | undefined;
	preset: SurfacePreset;
	density: SurfaceDensity;
};

export type SurfaceEntry = {
	id: string;
	placement: SurfacePlacement;
	priority?: number;
	active?: boolean;
	render: (context: SurfaceRenderContext) => readonly string[];
};

export type SurfaceRegistry = {
	register: (entry: SurfaceEntry) => () => void;
	clear: () => void;
	hasEntries: (placement?: SurfacePlacement) => boolean;
	hasActive: (placement?: SurfacePlacement) => boolean;
	render: (
		placement: SurfacePlacement,
		width: number,
		theme?: Theme,
		preferences?: SurfacePreferences,
	) => string[];
	subscribe: (listener: () => void) => () => void;
};

export function isSurfacePreset(value: unknown): value is SurfacePreset {
	return typeof value === "string" && SURFACE_PRESETS.some((preset) => preset === value);
}

export function isSurfaceMode(value: unknown): value is SurfaceMode {
	return value === "auto" || value === "manual";
}

export function resolveSurfaceDensity(
	preferences: SurfacePreferences = DEFAULT_SURFACE_PREFERENCES,
	active = false,
): SurfaceDensity {
	if (preferences.mode === "auto") return active ? "detailed" : "compact";
	return preferences.preset === "compact" ? "compact" : "detailed";
}

export function nextSurfacePreferences(
	preferences: SurfacePreferences,
): SurfacePreferences {
	if (preferences.mode === "auto") {
		return { version: 1, mode: "manual", preset: "compact" };
	}
	const index = SURFACE_PRESETS.indexOf(preferences.preset);
	const next = SURFACE_PRESETS[(index + 1) % SURFACE_PRESETS.length];
	if (next === undefined) return DEFAULT_SURFACE_PREFERENCES;
	if (preferences.preset === "full") return { version: 1, mode: "auto", preset: "default" };
	return { version: 1, mode: "manual", preset: next };
}

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

	function hasActive(placement?: SurfacePlacement): boolean {
		return [...entries.values()].some(
			(entry) => entry.active === true && (placement === undefined || entry.placement === placement),
		);
	}

	function render(
		placement: SurfacePlacement,
		width: number,
		theme: Theme | undefined,
		preferences: SurfacePreferences = DEFAULT_SURFACE_PREFERENCES,
	): string[] {
		const safeWidth = Number.isFinite(width) ? Math.max(0, Math.floor(width)) : 0;
		if (safeWidth === 0) return [];
		const density = resolveSurfaceDensity(preferences, hasActive(placement));
		return [...entries.values()]
			.filter((entry) => entry.placement === placement)
			.sort(compareSurfaceEntries)
			.flatMap((entry) => {
				const lines = entry.render({
					width: safeWidth,
					theme,
					preset: preferences.preset,
					density,
				});
				const maxLines = density === "compact" ? 1 : preferences.preset === "default" ? 2 : lines.length;
				return lines.slice(0, maxLines).map((line) => clipSurfaceLine(line, safeWidth));
			});
	}

	function subscribe(listener: () => void): () => void {
		listeners.add(listener);
		return () => listeners.delete(listener);
	}

	return { register, clear, hasEntries, hasActive, render, subscribe };
}

export const surfaceRegistry = createSurfaceRegistry();
let surfacePreferences = DEFAULT_SURFACE_PREFERENCES;

export function getSurfacePreferences(): SurfacePreferences {
	return surfacePreferences;
}

export function setSurfacePreferences(preferences: SurfacePreferences): void {
	surfacePreferences = preferences;
	for (const listener of surfacePreferenceListeners) listener();
}

export function getSurfaceDensity(): SurfaceDensity {
	return resolveSurfaceDensity(surfacePreferences, surfaceRegistry.hasActive());
}

export function subscribeSurfaceChanges(listener: () => void): () => void {
	const unsubscribeRegistry = surfaceRegistry.subscribe(listener);
	surfacePreferenceListeners.add(listener);
	return () => {
		unsubscribeRegistry();
		surfacePreferenceListeners.delete(listener);
	};
}

const surfacePreferenceListeners = new Set<() => void>();

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
