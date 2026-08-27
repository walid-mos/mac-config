import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { Type } from "@sinclair/typebox";
import { formatCritOutput, formatCritProgress } from "./crit-review/output.ts";
import { runCritProcess } from "./crit-review/process.ts";

export default function critReviewExtension(pi: ExtensionAPI): void {
	pi.registerTool({
		name: "crit_review",
		label: "Crit Review",
		description:
			"Open an interactive Crit review and wait until the reviewer clicks Finish Review. Returns Crit's stdout instructions and stderr status so you can continue the review workflow automatically.",
		promptSnippet: "Run Crit and wait for Finish Review",
		promptGuidelines: [
			"Use crit_review instead of bash when a Crit workflow needs an interactive review; follow the returned instructions before continuing.",
		],
		parameters: Type.Object({
			arguments: Type.Array(Type.String(), {
				description: "Arguments passed directly to crit, for example [\"--range\", \"main..HEAD\"]. Use [] for the current branch diff.",
			}),
		}),
		executionMode: "sequential",
		async execute(_toolCallId, params, signal, onUpdate, ctx) {
			const result = await runCritProcess("crit", params.arguments, ctx.cwd, signal, (progress) => {
				onUpdate?.({
					content: [{ type: "text", text: formatCritProgress(progress) }],
					details: progress,
				});
			});
			return {
				content: [{ type: "text", text: formatCritOutput(result) }],
				details: result,
				isError: result.killed || result.code !== 0,
			};
		},
	});

	pi.registerCommand("cg", {
		description: "Start the guided, chaptered Crit review loop",
		handler: async (arguments_, ctx) => {
			const invocation = ["/skill:crit-guided", arguments_.trim()].filter(Boolean).join(" ");
			if (ctx.isIdle()) {
				pi.sendUserMessage(invocation, { expandPromptTemplates: true });
				return;
			}
			pi.sendUserMessage(invocation, { deliverAs: "followUp", expandPromptTemplates: true });
			ctx.ui.notify("Guided Crit review queued", "info");
		},
	});
}
