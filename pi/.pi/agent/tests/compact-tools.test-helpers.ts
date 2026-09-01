import assert from 'node:assert/strict'

import { CompactRowStack } from '../extensions/compact-tools/stack.ts'

import type {
	CompactComponent,
	CompactRenderContext,
	CompactTheme,
	CompactToolDefinition,
} from '../extensions/compact-tools/types.ts'

export const theme: CompactTheme = {
	fg: (_role, text) => text,
	bold: text => text,
}

export function fakeNative(name: string, cwd: string): CompactToolDefinition {
	return {
		name,
		label: name,
		description: `native ${name} in ${cwd}`,
		parameters: {},
		promptSnippet: `${name} snippet`,
		promptGuidelines: [`${name} guideline`],
		execute: async () => ({
			content: [{ type: 'text', text: 'native' }],
			details: {},
		}),
		renderResult: () => ({
			render: () => ['NATIVE_RESULT'],
			invalidate() {},
		}),
	}
}

export function fakeContext(
	overrides: Partial<CompactRenderContext> = {},
): CompactRenderContext {
	return {
		state: {},
		cwd: '/proj',
		executionStarted: false,
		expanded: false,
		args: undefined,
		...overrides,
	}
}

export function renderOne(component: CompactComponent, width = 80): string {
	const lines = component.render(width)
	assert.equal(lines.length, 1)
	return lines[0]
}

export function stackWithTools(...tools: string[]): CompactRowStack {
	const stack = new CompactRowStack()
	for (const tool of tools) stack.registerTool(tool, true)
	return stack
}
