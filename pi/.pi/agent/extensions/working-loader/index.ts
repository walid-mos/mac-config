/**
 * Working loader: hides the persistent "Thinking..." transcript label and
 * rotates a shuffle-bag word line above the editor while the agent is busy.
 * The line renders through the shared surface registry (ui/surface.ts), so it
 * stacks with the other above-editor surfaces instead of owning a slot.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { ABOVE_EDITOR_PRIORITY, setOrderedAboveEditorWidget } from "../ui/ordered-widget-stack.ts";
import { createWordRotation, defaultIntervalScheduler } from "./rotation.ts";
import { createShuffleBag } from "./shuffle-bag.ts";
import { WORKING_WORDS } from "./words.ts";

const SURFACE_ID = "working-loader";

export default function workingLoader(pi: ExtensionAPI): void {
	const bag = createShuffleBag(WORKING_WORDS);
	let ui: ExtensionContext["ui"] | undefined;
	let painted = false;
	let word = "";

	function paint(): void {
		if (ui === undefined) return;
		setOrderedAboveEditorWidget(ui, SURFACE_ID, {
			priority: ABOVE_EDITOR_PRIORITY.working,
			render: (_width, theme) => [theme.fg("dim", `✻ ${word}...`)],
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
			word = bag.next();
			// Re-registering the same id overwrites the entry and notifies the
			// registry, which asks the mounted host for a single re-render.
			paint();
		},
	});

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
		show();
	});

	pi.on("agent_end", async (_event, ctx) => {
		bindUi(ctx);
		hide();
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
