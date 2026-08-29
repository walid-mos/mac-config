import { blobByRecency, readBlob, recentBlobs } from './blob-store.ts'
import { formatJsonBytes } from './json-frame.ts'

import type {
	ExtensionAPI,
	ExtensionCommandContext,
} from '@earendil-works/pi-coding-agent'
import type { JsonBlob } from './blob-store.ts'

const USAGE =
	'Usage : /json (plier/déplier) · /json open [n] (n = n-ième JSON le plus récent)'
const POSITIVE_INTEGER = /^[1-9]\d*$/
const COMMAND = {
	MAX_OPEN_ARGUMENTS: 2,
} as const

export type JsonCommand =
	| { kind: 'toggle' }
	| { kind: 'open'; recency: number; requested: string }
	| { kind: 'invalid' }

export function parseJsonCommand(argumentsSource: string): JsonCommand {
	const argumentsList = argumentsSource.trim().split(/\s+/).filter(Boolean)
	const [subcommand, requested] = argumentsList
	if (!subcommand) return { kind: 'toggle' }
	if (subcommand === 'toggle' && argumentsList.length === 1)
		return { kind: 'toggle' }
	if (
		subcommand !== 'open' ||
		argumentsList.length > COMMAND.MAX_OPEN_ARGUMENTS
	) {
		return { kind: 'invalid' }
	}
	if (!requested) return { kind: 'open', recency: 1, requested: '1' }
	if (!POSITIVE_INTEGER.test(requested)) return { kind: 'invalid' }
	const recency = Number(requested)
	if (!Number.isSafeInteger(recency)) return { kind: 'invalid' }
	return { kind: 'open', recency, requested }
}

function blobTitle(blob: JsonBlob, content: string): string {
	return `json · ${formatJsonBytes(blob.bytes)} · ${content.split('\n').length} lignes`
}

async function toggleJson(context: ExtensionCommandContext): Promise<void> {
	const isExpanded = !context.ui.getToolsExpanded()
	context.ui.setToolsExpanded(isExpanded)
	context.ui.notify(
		isExpanded ? 'JSON déplié' : 'JSON replié (aperçus minifiés)',
		'info',
	)
	if (context.mode === 'tui') await context.reload()
}

async function openJson(
	command: Extract<JsonCommand, { kind: 'open' }>,
	context: ExtensionCommandContext,
): Promise<void> {
	const blob = blobByRecency(command.recency)
	if (!blob) {
		if (recentBlobs().length) {
			context.ui.notify(
				`Blob n°${command.requested} introuvable`,
				'warning',
			)
			return
		}
		context.ui.notify('Aucun JSON détecté récemment', 'warning')
		return
	}
	let content: string
	try {
		content = readBlob(blob)
	} catch {
		context.ui.notify(
			`Blob n°${command.requested} illisible ou supprimé`,
			'warning',
		)
		return
	}
	await context.ui.editor(blobTitle(blob, content), content)
}

export function registerJsonCommand(pi: ExtensionAPI): void {
	pi.registerCommand('json', {
		description:
			"Blocs JSON : replier/déplier, ouvrir le n-ième blob dans l'éditeur (Ctrl+G → $EDITOR)",
		getArgumentCompletions: prefix => {
			const query = prefix.trim()
			const completions = ['toggle', 'open']
				.filter(subcommand => subcommand.startsWith(query))
				.map(subcommand => ({
					value: subcommand,
					label: subcommand,
					description: `/json ${subcommand}`,
				}))
			if (!completions.length) return null
			return completions
		},
		handler: async (argumentsSource, context) => {
			const command = parseJsonCommand(argumentsSource)
			if (command.kind === 'toggle') {
				await toggleJson(context)
				return
			}
			if (command.kind === 'open') {
				await openJson(command, context)
				return
			}
			context.ui.notify(USAGE, 'warning')
		},
	})
}
