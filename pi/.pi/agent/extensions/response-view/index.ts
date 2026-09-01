import type { ExtensionAPI, ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { frameAssistantMarkdown } from "./frame.ts";
import { softenThinkingMarkdown } from "./thinking.ts";

/**
 * Gives assistant prose a distinct reading surface without changing session
 * content. A single opening rule marks the response without adding a closing
 * rail around the prose.
 */
export default function responseView(pi: ExtensionAPI): void {
	let ui: ExtensionUIContext | undefined;

	pi.on("session_start", (_event, context) => {
		ui = context.ui;
	});

	pi.registerMarkdownTransformer((markdown, context) => {
		if (context.messageType === "assistant-thinking") {
			return softenThinkingMarkdown(markdown);
		}
		if (context.messageType !== "assistant") return markdown;
		if (!ui) throw new Error("response-view requires an active Pi UI session");
		return frameAssistantMarkdown(markdown, {
			width: context.availableWidth,
			theme: ui.theme,
		});
	});

	pi.on("session_shutdown", () => {
		ui = undefined;
	});
}
