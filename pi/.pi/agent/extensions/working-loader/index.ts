/**
 * Working loader: hides the persistent "Thinking..." transcript label and
 * animates a sand spinner beside a shuffle-bag word line while the agent is busy.
 * The line renders through the shared surface registry (ui/surface.ts), so it
 * stacks with the other above-editor surfaces instead of owning a slot.
 *
 * While thinking blocks stream, a `✽ raisonnement` marker is appended at the
 * far right of the same line: the working words keep rotating on the left,
 * the right edge says what the model is doing.
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
import { WORKING_WORDS } from "./words.ts";

const SURFACE_ID = "working-loader";
const THINKING_MARKER = "✽ raisonnement";
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
	let word = "";

	function paint(): void {
		if (ui === undefined) return;
		setOrderedAboveEditorWidget(ui, SURFACE_ID, {
			priority: ABOVE_EDITOR_PRIORITY.working,
			render: (width, theme) => {
				const left = theme.fg("dim", `${spinnerFrame} ${word}...`);
				if (mode !== "thinking") return [left];
				const right = theme.fg("accent", THINKING_MARKER);
				const gap = width - terminalLineWidth(left) - terminalLineWidth(right);
				if (gap < MIN_GAP) return [left];
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
		show();
	});

	pi.on("agent_end", async (_event, ctx) => {
		bindUi(ctx);
		hide();
	});

	// Thinking blocks stream through message_update: show or hide the right
	// marker as the assistant message progresses.
	pi.on("message_update", async (event, ctx) => {
		bindUi(ctx);
		const eventType = event.assistantMessageEvent?.type;
		if (isThinkingStreamEvent(eventType)) setMode("thinking");
		else if (isWorkingStreamEvent(eventType)) setMode("working");
	});

	pi.on("message_end", async (_event, ctx) => {
		bindUi(ctx);
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
