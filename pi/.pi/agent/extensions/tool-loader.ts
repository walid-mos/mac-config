import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

export const TOOL_GROUPS = {
	web: ['web_search', 'source_check', 'fetch_content', 'get_search_content'],
	frontend: [
		'frontend_open',
		'frontend_act',
		'frontend_screenshot',
		'frontend_console',
		'frontend_eval',
	],
	mcp: ['mcpScript', 'mcp'],
} as const

export type ToolGroup = keyof typeof TOOL_GROUPS

const LOADER_TOOL_NAME = 'load_tools'
const DEFERRED_TOOL_NAMES = new Set(Object.values(TOOL_GROUPS).flat())

function availableTools(pi: ExtensionAPI, group: ToolGroup): string[] {
	const registered = new Set(pi.getAllTools().map(tool => tool.name))
	return TOOL_GROUPS[group].filter(name => registered.has(name))
}

export default function toolLoader(pi: ExtensionAPI): void {
	pi.registerTool({
		name: LOADER_TOOL_NAME,
		label: 'Load Tools',
		description:
			'Load inactive tools by capability. Use before web research, browser UI testing, or MCP access.',
		parameters: {
			type: 'object',
			required: ['groups'],
			properties: {
				groups: {
					type: 'array',
					items: {
						type: 'string',
						enum: ['web', 'frontend', 'mcp'],
					},
					minItems: 1,
					uniqueItems: true,
				},
			},
		},
		async execute(_toolCallId, parameters) {
			const requested = parameters.groups.flatMap(group =>
				availableTools(pi, group),
			)
			const active = pi.getActiveTools()
			const added = requested.filter(name => !active.includes(name))
			if (added.length > 0)
				pi.setActiveTools([...new Set([...active, ...added])])

			return {
				content: [
					{
						type: 'text',
						text:
							added.length > 0
								? `Loaded tools: ${added.join(', ')}`
								: 'Requested tools are already active or unavailable.',
					},
				],
				details: { added },
			}
		},
	})

	pi.on('resources_discover', () => {
		const initial = pi
			.getActiveTools()
			.filter(name => !DEFERRED_TOOL_NAMES.has(name))
		pi.setActiveTools([...new Set([...initial, LOADER_TOOL_NAME])])
	})
}
