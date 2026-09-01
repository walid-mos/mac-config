import {
	createEditToolDefinition,
	createWriteToolDefinition,
	type ExtensionAPI,
	type ToolDefinition,
} from '@earendil-works/pi-coding-agent'

import { createCompactRenderers } from '../compact-tools/renderer.ts'

import { editCollapsedBody } from './edit.ts'
import { writeCollapsedBody } from './write.ts'

import type {
	CompactResultBodyRenderer,
	CompactToolDefinition,
} from '../compact-tools/types.ts'

interface MutationToolSpec {
	name: 'edit' | 'write'
	create(cwd: string): CompactToolDefinition | undefined
	resultBody: CompactResultBodyRenderer
}

const MUTATION_TOOLS: readonly MutationToolSpec[] = [
	{
		name: 'edit',
		create: createEditToolDefinition,
		resultBody: editCollapsedBody,
	},
	{
		name: 'write',
		create: createWriteToolDefinition,
		resultBody: writeCollapsedBody,
	},
]

export default function mutationView(pi: ExtensionAPI): void {
	for (const spec of MUTATION_TOOLS) registerMutationTool(pi, spec)
}

function registerMutationTool(pi: ExtensionAPI, spec: MutationToolSpec): void {
	const base = spec.create(process.cwd())
	if (!base) return
	const nativeByCwd = new Map<string, CompactToolDefinition | undefined>()
	const nativeFor = (cwd: string): CompactToolDefinition | undefined => {
		if (!nativeByCwd.has(cwd)) nativeByCwd.set(cwd, spec.create(cwd))
		return nativeByCwd.get(cwd)
	}
	const renderers = createCompactRenderers(
		spec.name,
		cwd => (cwd ? nativeFor(cwd) : undefined),
		{ resultBody: spec.resultBody },
	)
	pi.registerTool({
		...base,
		renderShell: 'self',
		...renderers,
		execute(toolCallId, params, signal, onUpdate, ctx) {
			const native = nativeFor(ctx.cwd)
			if (!native)
				throw new Error(
					`mutation-view: no native definition for "${spec.name}"`,
				)
			return native.execute(toolCallId, params, signal, onUpdate, ctx)
		},
	} as unknown as ToolDefinition)
}
