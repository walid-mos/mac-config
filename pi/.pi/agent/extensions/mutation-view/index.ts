import {
	createEditToolDefinition,
	createWriteToolDefinition,
	type ExtensionAPI,
	type ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { createCompactRenderers } from "../compact-tools/renderer.ts";
import type { CompactToolDefinition } from "../compact-tools/types.ts";
import { editCollapsedBody } from "./edit.ts";
import { writeCollapsedBody } from "./write.ts";

export default function mutationView(pi: ExtensionAPI): void {
	registerEdit(pi);
	registerWrite(pi);
}

function registerEdit(pi: ExtensionAPI): void {
	const base = createEditToolDefinition(process.cwd());
	if (!base) return;
	const nativeByCwd = new Map<string, CompactToolDefinition | undefined>();
	const nativeFor = (cwd: string): CompactToolDefinition | undefined => {
		if (!nativeByCwd.has(cwd)) nativeByCwd.set(cwd, createEditToolDefinition(cwd));
		return nativeByCwd.get(cwd);
	};
	const renderers = createCompactRenderers("edit", (cwd) => (cwd ? nativeFor(cwd) : undefined), {
		hideRowOnSuccess: true,
		collapsedBody: editCollapsedBody,
		stackRows: false,
	});
	pi.registerTool({
		...base,
		renderShell: "self",
		...renderers,
		execute(toolCallId, params, signal, onUpdate, ctx) {
			const native = nativeFor(ctx.cwd);
			if (!native) throw new Error('mutation-view: no native definition for "edit"');
			return native.execute(toolCallId, params, signal, onUpdate, ctx);
		},
	} as unknown as ToolDefinition<any, any>);
}

function registerWrite(pi: ExtensionAPI): void {
	const base = createWriteToolDefinition(process.cwd());
	if (!base) return;
	const nativeByCwd = new Map<string, CompactToolDefinition | undefined>();
	const nativeFor = (cwd: string): CompactToolDefinition | undefined => {
		if (!nativeByCwd.has(cwd)) nativeByCwd.set(cwd, createWriteToolDefinition(cwd));
		return nativeByCwd.get(cwd);
	};
	const renderers = createCompactRenderers("write", (cwd) => (cwd ? nativeFor(cwd) : undefined), {
		hideRowOnSuccess: true,
		collapsedBody: writeCollapsedBody,
		stackRows: false,
		nativeCallWhenExpanded: true,
	});
	pi.registerTool({
		...base,
		renderShell: "self",
		...renderers,
		execute(toolCallId, params, signal, onUpdate, ctx) {
			const native = nativeFor(ctx.cwd);
			if (!native) throw new Error('mutation-view: no native definition for "write"');
			return native.execute(toolCallId, params, signal, onUpdate, ctx);
		},
	} as unknown as ToolDefinition<any, any>);
}
