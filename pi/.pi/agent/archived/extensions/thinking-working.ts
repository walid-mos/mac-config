/**
 * Hide persistent "Thinking..." from the transcript and rotate a Claude-like
 * working-loader line below the chat while the agent is busy.
 */
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { createWorkingRotation, defaultIntervalScheduler } from "./thinking-working/rotation.ts";
import { createShuffleBag, workingMessage } from "./thinking-working/shuffle-bag.ts";
import { THINKING_WORKING_WORDS } from "./thinking-working/words.ts";

export default function thinkingWorking(pi: ExtensionAPI): void {
	const bag = createShuffleBag(THINKING_WORKING_WORDS);
	let ui: ExtensionContext["ui"] | undefined;

	const rotation = createWorkingRotation({
		scheduler: defaultIntervalScheduler,
		hideTranscriptThinking() {
			ui?.setHiddenThinkingLabel("");
		},
		rotate() {
			ui?.setWorkingMessage(workingMessage(bag.next()));
		},
		restoreWorkingMessage() {
			ui?.setWorkingMessage();
		},
		restoreDefaults() {
			ui?.setHiddenThinkingLabel();
			ui?.setWorkingMessage();
		},
	});

	function bindUi(ctx: ExtensionContext): void {
		ui = ctx.ui;
	}

	pi.on("session_start", async (_event, ctx) => {
		bindUi(ctx);
		ctx.ui.setHiddenThinkingLabel("");
	});

	pi.on("agent_start", async (_event, ctx) => {
		bindUi(ctx);
		rotation.start();
	});

	pi.on("agent_end", async (_event, ctx) => {
		bindUi(ctx);
		rotation.stop();
	});

	// This tool replaces the editor with a questionnaire and waits for the user.
	// A rotating “working” indicator is misleading during that pause.
	pi.on("tool_execution_start", async (event, ctx) => {
		if (event.toolName !== "ask_user_question") return;
		bindUi(ctx);
		rotation.stop();
	});

	pi.on("tool_execution_end", async (event, ctx) => {
		if (event.toolName !== "ask_user_question") return;
		bindUi(ctx);
		rotation.start();
	});

	pi.on("session_shutdown", async (_event, ctx) => {
		bindUi(ctx);
		rotation.shutdown();
	});
}
