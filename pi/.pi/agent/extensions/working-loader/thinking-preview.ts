import { terminalLineWidth } from "../ui/terminal-text.ts";

export const THINKING_ICON = "\u{f09d1}";
export const MIN_THINKING_REGION_COLUMNS = 32;
export const THINKING_REGION_RATIO = 0.5;
export const THINKING_INITIAL_PREVIEW_DELAY_MS = 800;
export const THINKING_PREVIEW_INTERVAL_MS = 2500;
export const THINKING_EXIT_GRACE_MS = 1000;
export const MAX_THINKING_BUFFER_LENGTH = 8192;

/**
 * Keep the preview in a right-hand region: half the terminal when possible,
 * never compressed below its minimum. Returning zero means the region should
 * be hidden because the loader leaves too little room.
 */
export function thinkingRegionWidth(totalWidth: number, availableWidth: number): number {
	const safeTotal = Number.isFinite(totalWidth) ? Math.max(0, Math.floor(totalWidth)) : 0;
	const safeAvailable = Number.isFinite(availableWidth)
		? Math.max(0, Math.floor(availableWidth))
		: 0;
	if (safeAvailable < MIN_THINKING_REGION_COLUMNS) return 0;
	const target = Math.max(
		MIN_THINKING_REGION_COLUMNS,
		Math.floor(safeTotal * THINKING_REGION_RATIO),
	);
	return Math.min(target, safeAvailable);
}

/** Keep only a bounded tail: the preview cares about the current thought. */
export function appendThinkingDelta(buffer: string, delta: string): string {
	const combined = `${buffer}${delta}`;
	return combined.length <= MAX_THINKING_BUFFER_LENGTH
		? combined
		: combined.slice(-MAX_THINKING_BUFFER_LENGTH);
}

export type ThinkingPreviewTimeline = {
	enter: (now: number) => boolean;
	append: (delta: string, now: number) => boolean;
	requestExit: (now: number) => boolean;
	tick: (now: number) => boolean;
	reset: () => void;
	isVisible: () => boolean;
	visibleBuffer: () => string;
};

/**
 * Decouples streamed deltas from the 80 ms spinner. Text snapshots remain
 * stable for a minimum interval, and brief non-thinking spans get a grace
 * period so adjacent reasoning blocks do not blink on and off.
 */
export function createThinkingPreviewTimeline(): ThinkingPreviewTimeline {
	let buffer = "";
	let displayed = "";
	let visible = false;
	let exiting = false;
	let nextSnapshotAt = 0;
	let exitAt: number | undefined;

	function reset(): void {
		buffer = "";
		displayed = "";
		visible = false;
		exiting = false;
		nextSnapshotAt = 0;
		exitAt = undefined;
	}

	function enter(now: number): boolean {
		const changed = !visible;
		if (changed) {
			buffer = "";
			displayed = "";
			visible = true;
			nextSnapshotAt = now + THINKING_INITIAL_PREVIEW_DELAY_MS;
		}
		exiting = false;
		exitAt = undefined;
		return changed;
	}

	function publish(now: number): boolean {
		if (buffer === displayed) return false;
		displayed = buffer;
		nextSnapshotAt = now + THINKING_PREVIEW_INTERVAL_MS;
		return true;
	}

	return {
		enter,
		append(delta, now) {
			const changed = enter(now);
			const startsPendingSnapshot = buffer === displayed;
			buffer = appendThinkingDelta(buffer, delta);
			if (startsPendingSnapshot) {
				const delay = displayed === ""
					? THINKING_INITIAL_PREVIEW_DELAY_MS
					: THINKING_PREVIEW_INTERVAL_MS;
				nextSnapshotAt = now + delay;
			}
			return changed;
		},
		requestExit(now) {
			if (!visible) return false;
			exiting = true;
			if (displayed === "" && buffer !== "") {
				const changed = publish(now);
				exitAt = nextSnapshotAt;
				return changed;
			}
			if (buffer === displayed) {
				exitAt ??= Math.max(now + THINKING_EXIT_GRACE_MS, nextSnapshotAt);
				return false;
			}
			if (now < nextSnapshotAt) {
				exitAt = undefined;
				return false;
			}
			const changed = publish(now);
			exitAt = nextSnapshotAt;
			return changed;
		},
		tick(now) {
			if (!visible) return false;
			if (exitAt !== undefined && now >= exitAt) {
				reset();
				return true;
			}
			if (now < nextSnapshotAt) return false;
			const changed = publish(now);
			if (exiting && changed) exitAt = nextSnapshotAt;
			return changed;
		},
		reset,
		isVisible: () => visible,
		visibleBuffer: () => displayed,
	};
}

/**
 * Converts streamed reasoning into a safe single-line tail window. This is an
 * ephemeral excerpt, not a second-model semantic summary.
 */
export function rollingThinkingPreview(buffer: string, width: number): string {
	const safeWidth = Number.isFinite(width) ? Math.max(0, Math.floor(width)) : 0;
	if (safeWidth === 0) return "";
	const latestBlock = buffer.trim().split(/\n{2,}/u).at(-1) ?? "";
	const normalized = normalizeThinkingText(latestBlock);
	if (normalized === "") return "";
	if (terminalLineWidth(normalized) <= safeWidth) return normalized;
	if (safeWidth === 1) return "…";

	const marker = "…";
	const budget = safeWidth - terminalLineWidth(marker);
	const reversed: string[] = [];
	let used = 0;
	for (const character of Array.from(normalized).reverse()) {
		const characterWidth = terminalLineWidth(character);
		if (used + characterWidth > budget) break;
		reversed.push(character);
		used += characterWidth;
	}
	return `${marker}${reversed.reverse().join("").trimStart()}`;
}

export function normalizeThinkingText(buffer: string): string {
	return buffer
		.replace(/\u001B\][^\u0007]*(?:\u0007|\u001B\\)/gu, "")
		.replace(/\u001B\[[0-?]*[ -/]*[@-~]/gu, "")
		.replace(/\u001B[_^P].*?(?:\u001B\\|\u0007)/gsu, "")
		.replace(/\u001B[^\s]*$/gu, "")
		.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F]/gu, "")
		.replace(/^\s{0,3}(?:#{1,6}|[-+*>])\s+/gmu, "")
		.replace(/[`*_~]/gu, "")
		.replace(/\s+/gu, " ")
		.trim();
}
