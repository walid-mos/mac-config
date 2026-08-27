/**
 * Vim-style aliases:
 *   :q / :q! → quitter pi (comme /quit)
 *   /clear   → nouvelle session (alias de /new)
 *
 * Note: ctx.newSession() n'existe que dans le contexte des commandes,
 * donc ":new" n'est pas possible depuis le handler input — d'où /clear.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export default function (pi: ExtensionAPI) {
	pi.registerCommand("clear", {
		description: "Start a new session (alias for /new)",
		handler: async (_args, ctx) => {
			await ctx.newSession();
		},
	});

	pi.on("input", async (event, ctx) => {
		if (event.source !== "interactive") return { action: "continue" };

		const text = event.text.trim();
		if (text === ":q" || text === ":q!") {
			// shutdown() waits for idle; abort first so :q during
			// streaming doesn't look like a no-op.
			if (!ctx.isIdle()) ctx.abort();
			ctx.shutdown();
			return { action: "handled" };
		}

		return { action: "continue" };
	});
}
