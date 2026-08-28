/** Enregistrement de l'extension : transformateur markdown + commande /json. */

import type { ExtensionAPI, ExtensionUIContext } from "@earendil-works/pi-coding-agent";
import { blobByRecency, persistJson, recentBlobs, type JsonBlob } from "./blob-store.ts";
import { formatJsonBytes, transformMarkdown } from "./render.ts";

function blobTitle(blob: JsonBlob): string {
	return `json · ${formatJsonBytes(blob.bytes)} · ${blob.pretty.split("\n").length} lignes`;
}

const USAGE = "Usage : /json (plier/déplier) · /json open [n] (n = n-ième JSON le plus récent)";

export function registerJsonViewExtension(pi: ExtensionAPI): void {
	// Le transformateur ne reçoit pas de ctx : on capture le ui complet au démarrage de session.
	let ui: ExtensionUIContext | undefined;
	pi.on("session_start", (_event, ctx) => {
		ui = ctx.ui;
	});

	pi.registerMarkdownTransformer((markdown, context) => {
		if (context.messageType === "assistant-thinking") return markdown;
		return transformMarkdown(markdown, {
			expanded: ui?.getToolsExpanded() ?? false,
			width: context.availableWidth,
			persist: persistJson,
		});
	});

	pi.registerCommand("json", {
		description: "Blocs JSON : replier/déplier, ouvrir le n-ième blob dans l'éditeur (Ctrl+G → $EDITOR)",
		getArgumentCompletions: (prefix) => {
			const query = prefix.trim();
			const items = ["toggle", "open"]
				.filter((sub) => sub.startsWith(query))
				.map((sub) => ({ value: sub, label: sub, description: `/json ${sub}` }));
			return items.length > 0 ? items : null;
		},
		handler: async (args, ctx) => {
			const [sub, rest] = args.trim().split(/\s+/).filter(Boolean);

			if (sub === undefined || sub === "toggle") {
				const next = !ctx.ui.getToolsExpanded();
				ctx.ui.setToolsExpanded(next);
				ctx.ui.notify(
					next
						? "JSON déplié — les blocs déjà affichés se redessinent au prochain rendu"
						: "JSON replié (aperçus minifiés au-delà du seuil)",
					"info",
				);
				return;
			}

			if (sub === "open") {
				const index = rest === undefined || rest === "" ? 1 : Number.parseInt(rest, 10);
				const blob = Number.isInteger(index) ? blobByRecency(index) : undefined;
				if (!blob) {
					ctx.ui.notify(
						recentBlobs().length === 0 ? "Aucun JSON détecté dans cette session" : `Blob n°${rest} introuvable`,
						"warning",
					);
					return;
				}
				await ctx.ui.editor(blobTitle(blob), blob.pretty);
				return;
			}

			ctx.ui.notify(USAGE, "warning");
		},
	});
}
