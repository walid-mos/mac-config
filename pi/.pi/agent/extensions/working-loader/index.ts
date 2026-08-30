/**
 * Working loader: hides the persistent "Thinking..." transcript label and
 * rotates a shuffle-bag word line above the editor while the agent is busy.
 * The line renders through the shared surface registry (ui/surface.ts), so it
 * stacks with the other above-editor surfaces instead of owning a slot.
 *
 * Two states: `✻` (dim) while tools and text stream, `✽` (accent) while
 * thinking blocks stream — driven by the message_update stream events, so the
 * line says *what* the model is doing instead of hiding the pause.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { ABOVE_EDITOR_PRIORITY, setOrderedAboveEditorWidget } from "../ui/ordered-widget-stack.ts";
import { createWordRotation, defaultIntervalScheduler } from "./rotation.ts";
import { createShuffleBag, type ShuffleBag } from "./shuffle-bag.ts";
import { THINKING_WORDS, WORKING_WORDS } from "./words.ts";

const SURFACE_ID = "working-loader";

type LoaderMode = "working" | "thinking";

const MODE_STYLE: Record<LoaderMode, { glyph: string; role: string }> = {
	working: { glyph: "✻", role: "dim" },
	thinking: { glyph: "✽", role: "accent" },
};

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
	const bags: Record<LoaderMode, ShuffleBag<string>> = {
		working: createShuffleBag(WORKING_WORDS),
		thinking: createShuffleBag(THINKING_WORDS),
	};
	let mode: LoaderMode = "working";
	let ui: ExtensionContext["ui"] | undefined;
	let painted = false;
	let word = "";

	function paint(): void {
		if (ui === undefined) return;
		const { glyph, role } = MODE_STYLE[mode];
		setOrderedAboveEditorWidget(ui, SURFACE_ID, {
			priority: ABOVE_EDITOR_PRIORITY.working,
			render: (_width, theme) => [theme.fg(role, `${glyph} ${word}...`)],
		});
		painted = true;
	}

	function unpaint(): void {
		if (ui === undefined || !painted) return;
		setOrderedAboveEditorWidget(ui, SURFACE_ID, undefined);
		painted = false;
	}

	const rotation = createWordRotation({
		scheduler: defaultIntervalScheduler,
		nextWord: () => {
			word = bags[mode].next();
			// Re-registering the same id overwrites the entry and notifies the
			// registry, which asks the mounted host for a single re-render.
			paint();
		},
	});

	/** Flips the loader state; a running line repaints immediately with the
	 * new vocabulary instead of waiting for the next rotation tick. */
	function setMode(next: LoaderMode): void {
		if (mode === next) return;
		mode = next;
		if (!rotation.isRunning()) return;
		word = bags[mode].next();
		paint();
	}

	function show(): void {
		if (ui === undefined) return;
		// One loader line: hide the native spinner status while ours is up.
		ui.setWorkingVisible(false);
		rotation.start();
	}

	function hide(): void {
		rotation.stop();
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

	// Thinking blocks stream through message_update: flip the loader between
	// ✻ (tools/text) and ✽ (reasoning) as the assistant message progresses.
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
