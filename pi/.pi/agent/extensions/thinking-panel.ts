/**
 * Thinking Panel Extension
 *
 * Streams the model's live reasoning into a passive, right-anchored side
 * panel, freeing the main transcript from thinking blocks.
 *
 * Features:
 *   - Non-capturing overlay: does not steal keyboard focus from the editor.
 *   - Live reasoning feed during streaming (tail-visible, auto-scroll to latest).
 *   - Mouse wheel over the panel scrolls the thinking history (SGR mouse
 *     tracking, coordinates-filtered so events elsewhere pass through to the
 *     chat/terminal). User scroll is paused while the pointer is over the
 *     panel, and auto-resumed at the bottom.
 *   - Strips thinking blocks from the persisted message at message_end so
 *     reasoning lives only in the panel (no duplicate in the transcript).
 *   - Border color matches the active thinking level via pi's semantic tokens.
 *   - Lazy-open on first thinking token; hidden when thinking is off.
 *   - Auto-hidden on terminals narrower than 110 columns.
 *
 * Usage:
 *   Auto-discovered from ~/.pi/agent/extensions/. Restart pi, then any prompt
 *   with thinking enabled will show the panel on the right side.
 *
 * Commands:
 *   /thinking-panel          Toggle panel visibility
 *   /thinking-panel-mouse    Toggle wheel scrolling over the panel
 *   /thinking-panel-debug    Show the debug log path
 *
 * Debug: PI_THINKING_PANEL_DEBUG=1 enables verbose logging to the debug log
 * (256 KB cap, truncated on session start).
 *
 * Shortcuts:
 *   Ctrl+Shift+T             Toggle panel visibility
 *
 * Mouse-mode ownership: while this extension is loaded, it claims the
 * terminal mouse modes (globalThis.__piThinkingPanelMouseOwner = true) and
 * pi-claude-style-scroll defers its own mouse/keyboard scroll mode writes.
 * Out-of-panel wheel events are forwarded to pi-claude-style-scroll's chat
 * viewport via globalThis.__piClaudeStyleScrollViewport.
 *
 * For the best experience, also set in ~/.pi/agent/settings.json:
 *   { "hideThinkingBlock": true }
 * This hides thinking blocks from the transcript entirely during streaming
 * (the panel already strips them from the final message).
 *
 * Note: Ctrl+T (pi's built-in thinking toggle) may not work in some terminals
 * that intercept that key. If needed, rebind it in your terminal profile or
 * via ~/.pi/agent/keybindings.json:
 *   { "app.thinking.toggle": ["ctrl+shift+o"] }
 *
 * Mouse coexistence: the panel enables SGR any-event tracking (1003+1006),
 * which reports hover motion and wheel events without breaking native
 * drag-to-select or the terminal's native scrollback outside the panel.
 * Wheel/press events landing on the panel are consumed to scroll the
 * thinking history; everything else passes through untouched. This is
 * compatible with pi-claude-style-scroll's default alternate-scroll mode
 * (that mode keeps the wheel outside the panel, so an out-of-panel wheel
 * may also scroll pi's message viewport — a benign, documented trade-off).
 * See /thinking-panel-mouse to disable.
 */

import { appendFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";

import type { ExtensionAPI, ExtensionContext, Theme } from "@earendil-works/pi-coding-agent";
import { type OverlayHandle, type TUI, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";

const MIN_TERMINAL_WIDTH = 110;
const PANEL_WIDTH = "40%";
const PANEL_WIDTH_PERCENT = 40; // must match PANEL_WIDTH; kept numeric for hit-testing
const BOTTOM_RESERVED_ROWS = 8; // keep editor + recent chat visible below the panel
const MIN_BODY_LINES = 6;
const MARGIN_TOP_ROWS = 1; // must match overlayOptions.margin
const MARGIN_RIGHT_COLS = 1; // must match overlayOptions.margin
const WHEEL_SCROLL_ROWS = 3;
const FOLLOW_SCROLLBACK = 0; // user is pinned to the latest output
const DEBUG_LOG = `${homedir()}/.pi/agent/thinking-panel-debug.log`;
const DEBUG_ENABLED = process.env.PI_THINKING_PANEL_DEBUG === "1";
const DEBUG_LOG_MAX_BYTES = 256 * 1024;

const ENABLE_MOUSE_TRACKING = "\x1b[?1003h\x1b[?1006h";
const DISABLE_MOUSE_TRACKING = "\x1b[?1006l\x1b[?1003l";
const DISABLE_ALTERNATE_SCROLL = "\x1b[?1007l"; // conflicts with SGR: wheel must reach us as SGR, not cursor keys
const SGR_MOUSE_PATTERN = /\x1b\[<(\d+);(\d+);(\d+)([mM])/g;
const MOUSE_MODIFIER_MASK = 4 | 8 | 16; // shift | alt | ctrl
const MOTION_FLAG = 32;
const PRIMARY_BUTTON = 0;
const HOVER_BUTTON = 3; // button|motion with no button = pure mouse move
const WHEEL_UP_BUTTON = 64;
const WHEEL_DOWN_BUTTON = 65;

/** pi-claude-style-scroll exposes its chat viewport scroller here (we patch it to do so). */
declare global {
	// eslint-disable-next-line no-var
	var __piClaudeStyleScrollViewport:
		| ((tui: TUI | undefined, deltaRows: number) => { handled: boolean; changed: boolean })
		| undefined;
	/** Mouse-mode ownership flag read by pi-claude-style-scroll (we patch it to do so). */
	// eslint-disable-next-line no-var
	var __piThinkingPanelMouseOwner: boolean | undefined;
}

// Last terminal size reported by the overlay's visible() callback; shared with
// ThinkingPanel for width-independent hit-testing.
let lastTermWidth = 160;
let lastTermHeight = 40;

/** Scroll pi's chat viewport via pi-claude-style-scroll; returns false when it is absent. */
function scrollChatViewport(tui: TUI | null, deltaRows: number): boolean {
	const scroller = globalThis.__piClaudeStyleScrollViewport;
	if (typeof scroller !== "function") return false;
	debugLog(`scrollChatViewport delta=${deltaRows}`);
	const result = scroller(tui ?? undefined, deltaRows);
	debugLog(`  result=${JSON.stringify(result)}`);
	return result.handled;
}

/** Truncate the debug log when it grows past DEBUG_LOG_MAX_BYTES (keeps the tail). */
function truncateDebugLog(): void {
	try {
		if (statSync(DEBUG_LOG).size <= DEBUG_LOG_MAX_BYTES) return;
		writeFileSync(DEBUG_LOG, "");
		appendFileSync(DEBUG_LOG, `${new Date().toISOString()} --- log truncated (size cap) ---\n`);
	} catch {
		// never let debugging break the extension
	}
}

/** Append a line to the debug log (opt-in via PI_THINKING_PANEL_DEBUG=1). */
function debugLog(line: string): void {
	if (!DEBUG_ENABLED) return;
	try {
		appendFileSync(DEBUG_LOG, `${new Date().toISOString()} ${line}\n`);
	} catch {
		// never let debugging break the extension
	}
}

type ThinkingLevel = ReturnType<ExtensionAPI["getThinkingLevel"]>;

type ScrollState =
	| { mode: "follow" }
	| { mode: "pinned"; scrollback: number };

type MouseEvent =
	| { kind: "hover"; col: number; row: number }
	| { kind: "wheel"; direction: "up" | "down"; col: number; row: number }
	| { kind: "press" | "drag" | "release"; col: number; row: number };

const LEVEL_BORDER_TOKENS = {
	off: "thinkingOff",
	minimal: "thinkingMinimal",
	low: "thinkingLow",
	medium: "thinkingMedium",
	high: "thinkingHigh",
	xhigh: "thinkingXhigh",
	max: "thinkingMax",
} as const satisfies Record<ThinkingLevel, string>;

/** Extract the most recent thinking block from assistant message content. */
function latestThinking(content: readonly { type: string }[]): string {
	for (let index = content.length - 1; index >= 0; index--) {
		const block = content[index];
		if (!block) continue;
		if (block.type === "thinking" && "thinking" in block && typeof block.thinking === "string") {
			return block.thinking;
		}
	}
	return "";
}

/** Parse the first SGR mouse event in `data`. Releases ('m') report the press button; drags report button|32. */
function parseMouseEvent(data: string): MouseEvent | undefined {
	SGR_MOUSE_PATTERN.lastIndex = 0;
	const match = SGR_MOUSE_PATTERN.exec(data);
	if (!match) return undefined;

	const rawButton = Number.parseInt(match[1] ?? "", 10);
	const col = Number.parseInt(match[2] ?? "", 10);
	const row = Number.parseInt(match[3] ?? "", 10);
	if (!Number.isFinite(rawButton) || !Number.isFinite(col) || !Number.isFinite(row)) return undefined;

	const press = match[4] === "M";
	const motion = (rawButton & MOTION_FLAG) !== 0;
	const button = rawButton & ~(MOUSE_MODIFIER_MASK | MOTION_FLAG);

	if (button === HOVER_BUTTON) return { kind: "hover", col, row };
	if (button === WHEEL_UP_BUTTON && press) return { kind: "wheel", direction: "up", col, row };
	if (button === WHEEL_DOWN_BUTTON && press) return { kind: "wheel", direction: "down", col, row };
	if (button === PRIMARY_BUTTON) return { kind: motion ? "drag" : press ? "press" : "release", col, row };
	return undefined;
}

/** Adjust a scrollback offset by `delta`, dropping back to follow mode at the bottom. */
function applyScrollDelta(scrollback: number, delta: number, maxScrollback: number): ScrollState {
	const next = Math.min(Math.max(scrollback + delta, FOLLOW_SCROLLBACK), maxScrollback);
	if (next <= FOLLOW_SCROLLBACK) return { mode: "follow" };
	return { mode: "pinned", scrollback: next };
}

/** Structural equality between two scroll states. */
function scrollStatesEqual(a: ScrollState, b: ScrollState): boolean {
	if (a.mode !== b.mode) return false;
	return a.mode === "follow" || (b.mode === "pinned" && a.scrollback === b.scrollback);
}

class ThinkingPanel {
	private thinkingText = "";
	private streaming = false;
	private level: ThinkingLevel;
	private scroll: ScrollState = { mode: "follow" };
	private cachedWidth: number | undefined;
	private cachedLines: string[] | undefined;

	constructor(
		private theme: Theme,
		initialLevel: ThinkingLevel,
		private getMaxBodyLines: () => number,
	) {
		this.level = initialLevel;
	}

	updateThinking(text: string, streaming: boolean): void {
		if (text === this.thinkingText && streaming === this.streaming) return;
		this.thinkingText = text;
		this.streaming = streaming;
		this.invalidate();
	}

	setStreaming(streaming: boolean): void {
		if (streaming === this.streaming) return;
		this.streaming = streaming;
		this.invalidate();
	}

	updateLevel(level: ThinkingLevel): void {
		if (level === this.level) return;
		this.level = level;
		this.invalidate();
	}

	get isFollowing(): boolean {
		return this.scroll.mode === "follow";
	}

	/** Body rows currently occupied by the panel (borders included), independent of render cache. */
	get renderedHeight(): number {
		if (!this.thinkingText) return 3; // title + "waiting…" row + bottom border
		const width = this.cachedWidth ?? 0;
		const wrapped = this.wrappedBodyLines(width);
		return Math.min(wrapped.length, this.getMaxBodyLines()) + 2;
	}

	/** Scroll the body viewport by `delta` body rows (positive = toward older content). */
	scrollBy(delta: number): void {
		const current = this.scroll.mode === "pinned" ? this.scroll.scrollback : FOLLOW_SCROLLBACK;
		const next = applyScrollDelta(current, delta, this.maxScrollback());
		if (scrollStatesEqual(this.scroll, next)) return;
		this.scroll = next;
		this.invalidate();
	}

	private maxScrollback(): number {
		return Math.max(0, this.wrappedBodyLines(this.cachedWidth ?? 0).length - this.getMaxBodyLines());
	}

	private panelWidthCols(): number {
		return Math.floor((lastTermWidth * PANEL_WIDTH_PERCENT) / 100);
	}

	render(width: number): string[] {
		if (this.cachedLines && this.cachedWidth === width) return this.cachedLines;
		const lines = this.buildLines(width);
		this.cachedWidth = width;
		this.cachedLines = lines;
		return lines;
	}

	invalidate(): void {
		this.cachedWidth = undefined;
		this.cachedLines = undefined;
	}

	private buildLines(width: number): string[] {
		const innerWidth = Math.max(8, width - 2);
		return [this.titleLine(innerWidth), ...this.bodyLines(innerWidth), this.border(`╰${"─".repeat(innerWidth)}╯`)];
	}

	private titleLine(innerWidth: number): string {
		const dot = this.streaming ? this.theme.fg("accent", "●") : this.theme.fg("dim", "○");
		const title = ` ${dot} ${this.theme.bold("Thinking")} `;
		const scrollInfo = this.scroll.mode === "pinned" ? this.theme.fg("dim", `[${this.scroll.scrollback}↑]`) : "";
		const scrollWarning =
			typeof globalThis.__piClaudeStyleScrollViewport !== "function" ? this.theme.fg("dim", " [chat scroll off]") : "";
		const suffix = scrollInfo + scrollWarning;
		const fill = "─".repeat(Math.max(0, innerWidth - 1 - visibleWidth(title) - visibleWidth(suffix)));
		return this.border("╭─") + title + this.border(fill) + suffix + this.border("╮");
	}

	private wrappedBodyLines(panelWidth: number): string[] {
		const effectiveWidth = panelWidth > 0 ? panelWidth : this.panelWidthCols();
		const contentWidth = Math.max(4, Math.max(8, effectiveWidth - 2) - 2);
		if (!this.thinkingText) return [];
		return wrapTextWithAnsi(this.theme.fg("thinkingText", this.thinkingText), contentWidth);
	}

	private bodyLines(innerWidth: number): string[] {
		const maxRows = this.getMaxBodyLines();
		if (!this.thinkingText) {
			return [this.row(` ${this.theme.fg("dim", "waiting for reasoning…")}`, innerWidth)];
		}

		const wrapped = this.wrappedBodyLines(innerWidth + 2);
		const scrollback = this.scroll.mode === "pinned" ? this.scroll.scrollback : FOLLOW_SCROLLBACK;
		const end = wrapped.length - scrollback;
		const start = Math.max(0, end - maxRows);
		return wrapped.slice(start, end).map((row) => this.row(` ${row}`, innerWidth));
	}

	private row(content: string, innerWidth: number): string {
		const padding = " ".repeat(Math.max(0, innerWidth - visibleWidth(content)));
		return this.border("│") + content + padding + this.border("│");
	}

	private border(text: string): string {
		return this.theme.fg(LEVEL_BORDER_TOKENS[this.level], text);
	}
}

export default function (pi: ExtensionAPI) {
	// Session-scoped panel state, owned by this extension.
	let panel: ThinkingPanel | null = null;
	let panelHandle: OverlayHandle | null = null;
	let panelTui: TUI | null = null;
	let panelHidden = false;
	let opening = false;

	// Mouse tracking state.
	let mouseEnabled = true;
	let trackingActive = false;
	let trackingOwnedByUs = false;
	let stopPatched = false;
	let removeInputListener: (() => void) | null = null;
	let pressStartedOnPanel = false;
	// Set at openPanel call time so the component factory can read it (the
	// factory runs synchronously inside ctx.ui.custom, before openPanel returns).
	let openCtx: ExtensionContext | null = null;

	const maxBodyLines = () => Math.max(MIN_BODY_LINES, lastTermHeight - BOTTOM_RESERVED_ROWS);

	const panelWidthCols = () => Math.floor((lastTermWidth * PANEL_WIDTH_PERCENT) / 100);

	const isOverPanel = (coords: { col: number; row: number }): boolean => {
		if (!panel || !panelTui || panelHidden) return false;
		if (lastTermWidth < MIN_TERMINAL_WIDTH) return false;
		const panelHeight = panel.renderedHeight;
		const colStart = lastTermWidth - MARGIN_RIGHT_COLS - panelWidthCols() + 1;
		return (
			coords.col >= colStart &&
			coords.col <= lastTermWidth - MARGIN_RIGHT_COLS &&
			coords.row >= MARGIN_TOP_ROWS + 1 &&
			coords.row <= MARGIN_TOP_ROWS + panelHeight
		);
	};

	/** Highest SGR mode either extension may have enabled; must match pi-claude-style-scroll's SGR disable sequence. */
	const FULL_SGR_MOUSE_DISABLE = "\x1b[?1006l\x1b[?1003l\x1b[?1002l\x1b[?1000l";

	/** pi-claude-style-scroll restores these modes on deactivation; reset the shared flag to what it will re-enable. */
	const syncMouseOwnerFlag = (): void => {
		globalThis.__piThinkingPanelMouseOwner = trackingActive || mouseEnabled;
	};

	const enableTracking = (): void => {
		if (trackingActive || !panelTui) return;
		// Alternate-scroll (1007) would encode wheel as cursor keys before SGR
		// reaches us; claude-style-scroll enables it by default. We own the
		// wheel now and forward out-of-panel events to its viewport ourselves.
		panelTui.terminal.write(DISABLE_ALTERNATE_SCROLL + ENABLE_MOUSE_TRACKING);
		trackingActive = true;
		trackingOwnedByUs = true;
		syncMouseOwnerFlag();
		debugLog(`tracking enabled, scroller=${typeof globalThis.__piClaudeStyleScrollViewport}`);
		patchStop();
	};

	const disableTracking = (): void => {
		if (!trackingActive || !trackingOwnedByUs || !panelTui) return;
		panelTui.terminal.write(FULL_SGR_MOUSE_DISABLE);
		trackingActive = false;
		trackingOwnedByUs = false;
		pressStartedOnPanel = false;
		syncMouseOwnerFlag();
	};

	/** Ensure mouse tracking is restored if pi stops while the panel holds it. */
	const patchStop = (): void => {
		if (stopPatched || !panelTui) return;
		const tui = panelTui;
		const originalStop = tui.stop.bind(tui);
		tui.stop = () => {
			if (trackingActive && trackingOwnedByUs) {
				tui.terminal.write(DISABLE_MOUSE_TRACKING);
				trackingActive = false;
				trackingOwnedByUs = false;
			}
			originalStop();
		};
		stopPatched = true;
	};

	const handleTerminalInput = (data: string): { consume: true } | undefined => {
		const event = parseMouseEvent(data);
		if (!event) return undefined;
		if (event.kind === "hover") return handleHover(event);
		if (event.kind === "wheel") return handleWheel(event);
		return handleClick(event);
	};

	const handleHover = (event: { col: number; row: number }): { consume: true } | undefined => {
		if (!isOverPanel(event)) return undefined;
		return { consume: true }; // cheap drop: hover events carry no value
	};

	const handleWheel = (event: { direction: "up" | "down"; col: number; row: number }): { consume: true } | undefined => {
		const over = isOverPanel(event);
		debugLog(`wheel ${event.direction} @${event.col},${event.row} overPanel=${over} panel=${!!panel} tracking=${trackingActive}`);
		if (!over) {
			// Outside the panel: SGR tracking has killed native scrollback, so we
			// drive pi-claude-style-scroll's chat viewport ourselves. When it is
			// absent, fall back to re-enabling alternate-scroll so the terminal's
			// native scroll handling (or a cursor-key scroll extension) works.
			const delta = event.direction === "up" ? -WHEEL_SCROLL_ROWS : WHEEL_SCROLL_ROWS;
			if (!scrollChatViewport(panelTui, delta)) {
				debugLog("wheel outside panel: no chat viewport scroller, enabling alternate-scroll fallback");
				panelTui?.terminal.write("\x1b[?1007h");
			}
			return { consume: true };
		}
		if (!panel) return { consume: true };
		if (event.direction === "up") {
			panel.scrollBy(WHEEL_SCROLL_ROWS);
		} else if (panel.isFollowing) {
			return { consume: true }; // already at the bottom; keep the event from leaking
		} else {
			panel.scrollBy(-WHEEL_SCROLL_ROWS);
		}
		refreshPanel();
		return { consume: true };
	};

	/** Only drags starting on the panel are eaten (text selection elsewhere stays native). */
	const handleClick = (event: { kind: string; col: number; row: number }): { consume: true } | undefined => {
		if (event.kind === "press") {
			pressStartedOnPanel = isOverPanel(event);
			return pressStartedOnPanel ? { consume: true } : undefined;
		}
		if (event.kind === "drag") return pressStartedOnPanel ? { consume: true } : undefined;
		const wasOnPanel = pressStartedOnPanel;
		pressStartedOnPanel = false;
		return wasOnPanel ? { consume: true } : undefined;
	};

	const installMouseCapture = (ctx: ExtensionContext): void => {
		if (removeInputListener || !ctx.hasUI) return;
		removeInputListener = ctx.ui.onTerminalInput(handleTerminalInput);
		// Tracking is enabled lazily in onHandle, once the panel exists.
	};

	const uninstallMouseCapture = (): void => {
		removeInputListener?.();
		removeInputListener = null;
		disableTracking();
	};

	const openPanel = (ctx: ExtensionContext): void => {
		if (panel || opening || !ctx.hasUI) return;
		// Don't open below the minimum width: pi's showOverlay never resolves its
		// promise for invisible overlays, which would strand `opening = true` and
		// permanently block any later retry (the "no thinking box" bug).
		if (lastTermWidth < MIN_TERMINAL_WIDTH) {
			debugLog(`openPanel skipped: termWidth=${lastTermWidth} < ${MIN_TERMINAL_WIDTH}`);
			return;
		}
		opening = true;
		openCtx = ctx;
		debugLog(`openPanel: opening overlay (termWidth=${lastTermWidth})`);
		ctx.ui
			.custom<void>(
				(tui, theme) => {
					panelTui = tui;
					panel = new ThinkingPanel(theme, pi.getThinkingLevel(), maxBodyLines);
					debugLog("openPanel: factory called, panel created");
					return panel;
				},
				{
					overlay: true,
					overlayOptions: {
						anchor: "top-right",
						width: PANEL_WIDTH,
						nonCapturing: true,
						margin: { top: MARGIN_TOP_ROWS, right: MARGIN_RIGHT_COLS },
						visible: (termWidth, termHeight) => {
							lastTermWidth = termWidth;
							lastTermHeight = termHeight;
							return termWidth >= MIN_TERMINAL_WIDTH;
						},
					},
					onHandle: (handle) => {
						panelHandle = handle;
						handle.setHidden(panelHidden);
						opening = false;
						debugLog("openPanel: handle received, overlay live");
						if (mouseEnabled) enableTracking();
						const latestCtx = openCtx;
						if (latestCtx?.hasUI) installMouseCapture(latestCtx);
					},
				},
			)
			.then(
				() => {
					// Resolves only via done()/hideOverlay(). If the overlay never
					// surfaced (showOverlay threw, ...), release `opening` so the next
					// message_update can retry instead of staying blocked forever.
					if (!panelHandle) {
						opening = false;
						debugLog("openPanel: resolved without handle; releasing opening");
					}
				},
				(error: unknown) => {
					opening = false;
					debugLog(`openPanel FAILED: ${error instanceof Error ? error.message : String(error)}`);
				},
			);
	};

	const refreshPanel = (): void => {
		if (!panel || !panelTui) return;
		panelTui.requestRender();
	};

	let lastLoggedThinkingLength = -1;

	pi.on("message_update", (event, ctx) => {
		if (event.message.role !== "assistant") return;
		const thinking = latestThinking(event.message.content);
		if (thinking.length !== lastLoggedThinkingLength) {
			lastLoggedThinkingLength = thinking.length;
			debugLog(`message_update: thinking=${thinking.length}chars panel=${!!panel} opening=${opening}`);
		}
		if (!thinking && pi.getThinkingLevel() === "off") return;
		openPanel(ctx);
		if (!panel) return;
		panel.updateThinking(thinking, true);
		refreshPanel();
	});

	pi.on("message_end", (event) => {
		if (event.message.role !== "assistant") return;
		// Update panel with final thinking, mark streaming done.
		const thinking = latestThinking(event.message.content);
		if (thinking) {
			panel?.updateThinking(thinking, false);
		} else {
			panel?.setStreaming(false);
		}
		refreshPanel();

		// Strip thinking blocks from the persisted message so reasoning
		// lives only in the side panel — no duplicate in the transcript.
		return {
			message: {
				...event.message,
				content: event.message.content.filter((block) => block.type !== "thinking"),
			},
		};
	});

	pi.on("thinking_level_select", (event) => {
		if (!panel) return;
		panel.updateLevel(event.level);
		refreshPanel();
	});

	pi.on("session_start", (_event, ctx) => {
		installMouseCapture(ctx);
	});

	// Ownership flag for the shared mouse modes: true while this extension may
	// have SGR tracking enabled. pi-claude-style-scroll checks this before
	// writing its own mouse modes so the two extensions never fight over the
	// terminal. See the header comment "Mouse coexistence".
	globalThis.__piThinkingPanelMouseOwner = true;
	if (DEBUG_ENABLED) truncateDebugLog();

	pi.on("session_shutdown", () => {
		uninstallMouseCapture();
		globalThis.__piThinkingPanelMouseOwner = false;
		panel = null;
		panelHandle = null;
		panelTui = null;
		openCtx = null;
		opening = false;
		stopPatched = false;
	});

	const togglePanel = (ui: ExtensionContext["ui"]): void => {
		if (!panelHandle) {
			ui.notify("Thinking panel not active yet — run a prompt with thinking enabled.", "info");
			return;
		}
		panelHidden = !panelHidden;
		panelHandle.setHidden(panelHidden);
		ui.notify(`Thinking panel ${panelHidden ? "hidden" : "shown"}`, "info");
	};

	const toggleMouse = (ui: ExtensionContext["ui"]): void => {
		mouseEnabled = !mouseEnabled;
		if (mouseEnabled) {
			enableTracking();
		} else {
			disableTracking();
		}
		ui.notify(
			`Thinking panel wheel scroll ${mouseEnabled ? "enabled" : "disabled"}`,
			"info",
		);
	};

	pi.registerCommand("thinking-panel", {
		description: "Toggle the thinking side panel",
		handler: async (_args, ctx) => {
			togglePanel(ctx.ui);
		},
	});

	pi.registerCommand("thinking-panel-mouse", {
		description: "Toggle wheel scrolling over the thinking panel",
		handler: async (_args, ctx) => {
			toggleMouse(ctx.ui);
		},
	});

	pi.registerCommand("thinking-panel-debug", {
		description: "Show the thinking panel debug log path and tail",
		handler: async (_args, ctx) => {
			ctx.ui.notify(`Debug log: ${DEBUG_LOG}`, "info");
		},
	});

	pi.registerShortcut("ctrl+shift+t", {
		description: "Toggle thinking panel",
		handler: async (ctx) => {
			togglePanel(ctx.ui);
		},
	});
}
