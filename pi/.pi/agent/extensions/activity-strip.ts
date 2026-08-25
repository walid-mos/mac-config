import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import {
	clipToTerminalWidth,
	countTool,
	countTurn,
	emptyActivityStrip,
	formatActivityLine,
	settleStrip,
	startPrompt,
	tickElapsed,
	type ActivityStripState,
} from "./activity-strip/state.ts";
import { ABOVE_EDITOR_PRIORITY, setOrderedAboveEditorWidget } from "./ui/ordered-widget-stack.ts";

const WIDGET_ID = "activity-strip";
const TICK_MS = 1000;

export default function activityStripExtension(pi: ExtensionAPI): void {
	let state = emptyActivityStrip();
	let widgetRegistered = false;
	let tick: ReturnType<typeof setInterval> | null = null;
	let ui: ExtensionContext["ui"] | undefined;

	function paint(): void {
		if (!widgetRegistered || ui === undefined) return;
		const line = formatActivityLine(state);
		setOrderedAboveEditorWidget(ui, WIDGET_ID, {
			priority: ABOVE_EDITOR_PRIORITY.activity,
			active: state.promptStarted && !state.frozen,
			render: (width, theme) => [theme.fg("dim", clipToTerminalWidth(line, width))],
		});
	}

	function stopTick(): void {
		if (tick === null) return;
		clearInterval(tick);
		tick = null;
	}

	function startTick(): void {
		stopTick();
		tick = setInterval(() => {
			state = tickElapsed(state, Date.now());
			paint();
		}, TICK_MS);
		tick.unref?.();
	}

	function rememberUi(ctx: ExtensionContext): void {
		ui = ctx.ui;
	}

	function registerWidget(): void {
		if (widgetRegistered) return;
		widgetRegistered = true;
		paint();
	}


	pi.on("session_start", (_event, ctx) => {
		rememberUi(ctx);
		registerWidget();
		paint();
	});

	pi.on("before_agent_start", (_event, ctx) => {
		rememberUi(ctx);
		state = startPrompt(Date.now());
		registerWidget();
		startTick();
		paint();
	});

	pi.on("turn_start", (_event, ctx) => {
		rememberUi(ctx);
		state = countTurn(state);
		paint();
	});

	pi.on("tool_execution_start", (event, ctx) => {
		rememberUi(ctx);
		state = countTool(state);
		paint();
	});


	pi.on("agent_settled", (_event, ctx) => {
		rememberUi(ctx);
		state = settleStrip(state, Date.now());
		stopTick();
		paint();
	});


	pi.on("session_shutdown", async (_event, ctx) => {
		rememberUi(ctx);
		stopTick();
		widgetRegistered = false;
		state = emptyActivityStrip();
		if (ui !== undefined) setOrderedAboveEditorWidget(ui, WIDGET_ID, undefined);
	});
}

export type { ActivityStripState };
