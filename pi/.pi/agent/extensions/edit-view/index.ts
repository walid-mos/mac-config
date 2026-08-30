/**
 * edit-view: renders edit tool calls like the json-view blocks. Collapsed,
 * a rounded frame shows one line diff per edits[] entry (the native view
 * prints the whole file); ctrl+o expands to the native full-file diff.
 * Execution is delegated untouched to the real built-in definition.
 */

import {
	createEditToolDefinition,
	type ExtensionAPI,
	type ToolDefinition,
} from "@earendil-works/pi-coding-agent";

import { createCompactRenderers } from "../compact-tools/renderer.ts";
import type {
	CompactRenderers,
	CompactToolDefinition,
} from "../compact-tools/types.ts";
import { editCollapsedBody } from "./body.ts";

export default function editView(pi: ExtensionAPI): void {
	const base = createEditToolDefinition(process.cwd());
	if (!base) return;

	const nativeByCwd = new Map<string, CompactToolDefinition | undefined>();
	const nativeFor = (cwd: string): CompactToolDefinition | undefined => {
		if (!nativeByCwd.has(cwd)) nativeByCwd.set(cwd, createEditToolDefinition(cwd));
		return nativeByCwd.get(cwd);
	};

	const renderers: CompactRenderers = createCompactRenderers(
		"edit",
		(cwd) => (cwd ? nativeFor(cwd) : undefined),
		{
			hideRowOnSuccess: true,
			collapsedBody: editCollapsedBody,
		},
	);

	pi.registerTool({
		...base,
		renderShell: "self",
		...renderers,
		execute(toolCallId, params, signal, onUpdate, ctx) {
			const native = nativeFor(ctx.cwd);
			if (!native) throw new Error('edit-view: no native definition for "edit"');
			return native.execute(toolCallId, params, signal, onUpdate, ctx);
		},
	} as unknown as ToolDefinition<any, any>);
}
