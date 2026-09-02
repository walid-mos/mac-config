import assert from 'node:assert/strict'
import test from 'node:test'

import toolLoader from '../extensions/tool-loader.ts'

import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

type ToolDefinition = {
	name: string
	execute: (
		toolCallId: string,
		parameters: { groups: Array<'web' | 'frontend' | 'mcp'> },
	) => Promise<{
		content: Array<{ text: string }>
		details: { added: string[] }
	}>
}

type ResourcesHandler = () => void

function harness(registeredNames: string[]): {
	active: () => string[]
	loader: ToolDefinition
	resourcesDiscover: ResourcesHandler
} {
	let active = [...registeredNames]
	let loader: ToolDefinition | undefined
	let resourcesDiscover: ResourcesHandler | undefined
	const allTools = registeredNames.map(name => ({ name }))

	const pi = {
		registerTool(definition: ToolDefinition) {
			loader = definition
			allTools.push({ name: definition.name })
			active.push(definition.name)
		},
		on(event: string, handler: ResourcesHandler) {
			assert.equal(event, 'resources_discover')
			resourcesDiscover = handler
		},
		getAllTools() {
			return allTools
		},
		getActiveTools() {
			return [...active]
		},
		setActiveTools(names: string[]) {
			active = [...names]
		},
	}

	toolLoader(pi as unknown as ExtensionAPI)
	assert.ok(loader)
	assert.ok(resourcesDiscover)
	return {
		active: () => [...active],
		loader,
		resourcesDiscover,
	}
}

test('starts with rare capability groups inactive', () => {
	const runtime = harness([
		'read',
		'bash',
		'web_search',
		'frontend_open',
		'mcp',
	])

	runtime.resourcesDiscover()
	assert.deepEqual(runtime.active(), ['read', 'bash', 'load_tools'])
})

test('loads requested groups additively and only once', async () => {
	const runtime = harness([
		'read',
		'web_search',
		'fetch_content',
		'frontend_open',
		'frontend_eval',
	])
	runtime.resourcesDiscover()

	const first = await runtime.loader.execute('call-1', {
		groups: ['web', 'frontend'],
	})
	assert.deepEqual(first.details.added, [
		'web_search',
		'fetch_content',
		'frontend_open',
		'frontend_eval',
	])
	assert.deepEqual(runtime.active(), [
		'read',
		'load_tools',
		'web_search',
		'fetch_content',
		'frontend_open',
		'frontend_eval',
	])

	const second = await runtime.loader.execute('call-2', { groups: ['web'] })
	assert.deepEqual(second.details.added, [])
	assert.match(second.content[0].text, /already active/u)
})

test('ignores tools absent from the installed packages', async () => {
	const runtime = harness(['read', 'mcp'])
	runtime.resourcesDiscover()

	const result = await runtime.loader.execute('call-1', {
		groups: ['frontend'],
	})
	assert.deepEqual(result.details.added, [])
	assert.deepEqual(runtime.active(), ['read', 'load_tools'])
})
