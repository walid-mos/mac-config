import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

type InputEvent = {
	text: string;
	source: "interactive" | "rpc" | "extension";
};

export type QuitIntent = "graceful" | "force";

/** Parse Vim quit aliases only for text entered directly in the TUI. */
export function quitIntent(event: InputEvent): QuitIntent | undefined {
	if (event.source !== "interactive") return undefined;

	switch (event.text.trim()) {
		case ":q":
			return "graceful";
		case ":q!":
			return "force";
		default:
			return undefined;
	}
}

export default function sessionShortcuts(pi: ExtensionAPI): void {
	pi.registerCommand("clear", {
		description: "Start a new session",
		handler: async (_args, ctx) => {
			await ctx.newSession();
		},
	});

	pi.on("input", (event, ctx) => {
		const intent = quitIntent(event);
		if (!intent) return { action: "continue" };

		if (intent === "force" && !ctx.isIdle()) ctx.abort();
		ctx.shutdown();
		return { action: "handled" };
	});
}
