import type { ExtensionAPI, ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { frameAssistantMarkdown, type ResponseTheme } from "./frame.ts";
import { softenThinkingMarkdown } from "./thinking.ts";

const PLAIN_THEME: ResponseTheme = {
	fg: (_role, text) => text,
	bold: (text) => text,
};

/**
 * Gives assistant prose a distinct reading surface without changing session
 * content. The opening rule is present while streaming; the closing rule only
 * appears once the response has settled.
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
		return frameAssistantMarkdown(markdown, {
			width: context.availableWidth,
			isStreaming: context.isStreaming,
			theme: ui?.theme ?? PLAIN_THEME,
		});
	});

	pi.on("session_shutdown", () => {
		ui = undefined;
	});
}
