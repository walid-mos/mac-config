/**
 * Working loader: hides the persistent "Thinking..." transcript label and
 * animates a sand spinner beside a shuffle-bag word line while the agent is busy.
 * The line renders through the shared surface registry (ui/surface.ts), so it
 * stacks with the other above-editor surfaces instead of owning a slot.
 *
 * While thinking blocks stream, a Nerd Font brain and a bounded rolling
 * excerpt are appended at the far right: working words keep rotating on the
 * left while the current reasoning remains visible but ephemeral.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { ABOVE_EDITOR_PRIORITY, setOrderedAboveEditorWidget } from "../ui/ordered-widget-stack.ts";
import { terminalLineWidth } from "../ui/terminal-text.ts";
import {
	createRotation,
	defaultIntervalScheduler,
	WORD_ROTATION_INTERVAL_MS,
} from "./rotation.ts";
import { createShuffleBag } from "./shuffle-bag.ts";
import { createSpinnerRotation, SAND_SPINNER } from "./spinner.ts";
import {
	appendThinkingDelta,
	MAX_THINKING_PREVIEW_COLUMNS,
	rollingThinkingPreview,
	THINKING_FALLBACK_LABEL,
	THINKING_ICON,
} from "./thinking-preview.ts";
import { WORKING_WORDS } from "./words.ts";

const SURFACE_ID = "working-loader";
const MIN_GAP = 2;

type LoaderMode = "working" | "thinking";

/** Whether an assistant stream event flips the loader into thinking mode. */
export function isThinkingStreamEvent(eventType: string | undefined): boolean {
	return eventType === "thinking_start" || eventType === "thinking_delta";
}

/** Whether an assistant stream event returns the loader to working mode. */
export function isWorkingStreamEvent(eventType: string | undefined): boolean {
	return (
		eventType === "text_start" ||
		eventType === "text_delta" ||
		eventType === "thinking_end" ||
		eventType === "toolcall_start"
	);
}

export default function workingLoader(pi: ExtensionAPI): void {
	const bag = createShuffleBag(WORKING_WORDS);
	let mode: LoaderMode = "working";
	let ui: ExtensionContext["ui"] | undefined;
	let painted = false;
	let spinnerFrame = SAND_SPINNER.frames[0];
	let thinkingBuffer = "";
	let word = "";

	function paint(): void {
		if (ui === undefined) return;
		setOrderedAboveEditorWidget(ui, SURFACE_ID, {
			priority: ABOVE_EDITOR_PRIORITY.working,
			render: (width, theme) => {
				const left = theme.fg("dim", `${spinnerFrame} ${word}...`);
				if (mode !== "thinking") return [left];

				const rightBudget = width - terminalLineWidth(left) - MIN_GAP;
				const fallbackWidth = terminalLineWidth(`${THINKING_ICON} ${THINKING_FALLBACK_LABEL}`);
				if (rightBudget < fallbackWidth) return [left];
				const previewWidth = Math.min(
					MAX_THINKING_PREVIEW_COLUMNS,
					rightBudget - terminalLineWidth(THINKING_ICON) - 1,
				);
				const preview = rollingThinkingPreview(thinkingBuffer, previewWidth) || THINKING_FALLBACK_LABEL;
				const right = `${theme.fg("accent", THINKING_ICON)} ${theme.fg("muted", preview)}`;
				const gap = width - terminalLineWidth(left) - terminalLineWidth(right);
				return [`${left}${" ".repeat(gap)}${right}`];
			},
		});
		painted = true;
	}

	function unpaint(): void {
		if (ui === undefined || !painted) return;
		setOrderedAboveEditorWidget(ui, SURFACE_ID, undefined);
		painted = false;
	}

	const wordRotation = createRotation({
		scheduler: defaultIntervalScheduler,
		intervalMs: WORD_ROTATION_INTERVAL_MS,
		advance: () => {
			word = bag.next();
			// Re-registering the same id overwrites the entry and notifies the
			// registry, which asks the mounted host for a single re-render.
			paint();
		},
	});
	const spinnerRotation = createSpinnerRotation({
		scheduler: defaultIntervalScheduler,
		spinner: SAND_SPINNER,
		onFrame: (frame) => {
			spinnerFrame = frame;
			paint();
		},
	});

	/** Flips the thinking marker; a running line repaints immediately. */
	function setMode(next: LoaderMode): void {
		if (mode === next) return;
		mode = next;
		if (painted) paint();
	}

	function show(): void {
		if (ui === undefined) return;
		// One loader line: hide the native spinner status while ours is up.
		ui.setWorkingVisible(false);
		wordRotation.start();
		spinnerRotation.start();
	}

	function hide(): void {
		wordRotation.stop();
		spinnerRotation.stop();
		unpaint();
		ui?.setWorkingVisible(true);
	}

	function bindUi(ctx: ExtensionContext): void {
		ui = ctx.ui;
	}

	pi.on("session_start", async (_event, ctx) => {
		bindUi(ctx);
		ctx.ui.setHiddenThinkingLabel("");
	});

	pi.on("agent_start", async (_event, ctx) => {
		bindUi(ctx);
		mode = "working";
		thinkingBuffer = "";
		show();
	});

	pi.on("agent_end", async (_event, ctx) => {
		bindUi(ctx);
		hide();
	});

	// Thinking deltas update the rolling buffer. The 80ms sand tick repaints it,
	// naturally capping preview refreshes without another timer.
	pi.on("message_update", async (event, ctx) => {
		bindUi(ctx);
		const assistantEvent = event.assistantMessageEvent;
		if (assistantEvent?.type === "thinking_start") {
			thinkingBuffer = "";
			setMode("thinking");
		} else if (assistantEvent?.type === "thinking_delta") {
			thinkingBuffer = appendThinkingDelta(thinkingBuffer, assistantEvent.delta);
			setMode("thinking");
		} else if (isWorkingStreamEvent(assistantEvent?.type)) {
			thinkingBuffer = "";
			setMode("working");
		}
	});

	pi.on("message_end", async (_event, ctx) => {
		bindUi(ctx);
		thinkingBuffer = "";
		setMode("working");
	});

	// The questionnaire replaces the editor and waits for the user: a rotating
	// "working" line is misleading during that pause.
	pi.on("tool_execution_start", async (event, ctx) => {
		if (event.toolName !== "ask_user_question") return;
		bindUi(ctx);
		hide();
	});

	pi.on("tool_execution_end", async (event, ctx) => {
		if (event.toolName !== "ask_user_question") return;
		bindUi(ctx);
		show();
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		bindUi(ctx);
		hide();
		ctx.ui.setHiddenThinkingLabel();
	});
}
