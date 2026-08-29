import { persistJson } from './blob-store.ts'
import { registerJsonCommand } from './json-command.ts'
import { transformMarkdown } from './transform-markdown.ts'

import type {
	ExtensionAPI,
	ExtensionUIContext,
} from '@earendil-works/pi-coding-agent'

export default function jsonView(pi: ExtensionAPI): void {
	let activeUi: ExtensionUIContext | undefined

	pi.on('session_start', (_event, context) => {
		activeUi = context.ui
	})

	pi.registerMarkdownTransformer((markdown, context) => {
		if (context.messageType === 'assistant-thinking') return markdown
		return transformMarkdown(markdown, {
			expanded: activeUi?.getToolsExpanded() ?? false,
			width: context.availableWidth,
			persist: persistJson,
		})
	})

	registerJsonCommand(pi)
}
