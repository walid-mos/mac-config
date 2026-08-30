import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { compactRowStack, type StackMessage } from "./stack.ts";

interface MessageEntry {
	type?: string;
	message?: StackMessage;
}

function branchMessages(entries: ReadonlyArray<unknown>): StackMessage[] {
	const messages: StackMessage[] = [];
	for (const entry of entries) {
		if (typeof entry !== "object" || entry === null) continue;
		const candidate = entry as MessageEntry;
		if (candidate.type === "message" && candidate.message) messages.push(candidate.message);
	}
	return messages;
}

export function registerCompactStackLifecycle(pi: ExtensionAPI): void {
	pi.on("session_start", (_event, ctx) => {
		compactRowStack.rebuild(branchMessages(ctx.sessionManager.getBranch()));
	});
	pi.on("message_start", (event) => {
		compactRowStack.beginMessage(event.message as StackMessage);
	});
	pi.on("message_update", (event) => {
		compactRowStack.updateMessage(event.message as StackMessage);
	});
	pi.on("message_end", (event) => {
		compactRowStack.endMessage(event.message as StackMessage);
	});
	pi.on("session_shutdown", () => {
		compactRowStack.reset();
		compactRowStack.clearRegisteredTools();
	});
}
