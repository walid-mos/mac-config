/** Compact image attachments for the prompt: [img:1], [img:2], ... */

import {
	CustomEditor,
	type ExtensionAPI,
} from '@earendil-works/pi-coding-agent'

import { registerEditorDecorator } from '../ui/editor-decorator.ts'
import {
	ABOVE_EDITOR_PRIORITY,
	setOrderedAboveEditorWidget,
} from '../ui/ordered-widget-stack.ts'

import { createCapturePromptEditor } from './editor.ts'
import { renderCaptureStrip } from './render.ts'
import { CaptureStore } from './store.ts'

const WIDGET_ID = 'capture-prompt'
const noOp = (): void => {}
const plainAlias = (alias: string): string => alias

export default function capturePrompt(pi: ExtensionAPI): void {
	let currentCwd = process.cwd()
	let repaint = noOp
	let styleAlias = plainAlias
	const store = new CaptureStore(() => repaint())

	pi.on('session_start', (_event, context) => {
		currentCwd = context.cwd
		styleAlias = alias =>
			context.ui.theme.fg('accent', context.ui.theme.bold(alias))
		repaint = () => {
			setOrderedAboveEditorWidget(
				context.ui,
				WIDGET_ID,
				store.items.length === 0
					? undefined
					: {
							priority: ABOVE_EDITOR_PRIORITY.attachments,
							render: (width, theme) =>
								renderCaptureStrip(
									store.items,
									store.scrollOffset,
									width,
									theme,
								),
						},
			)
		}
		repaint()
	})

	pi.on('session_shutdown', (_event, context) => {
		setOrderedAboveEditorWidget(context.ui, WIDGET_ID, undefined)
		repaint = noOp
		styleAlias = plainAlias
	})

	registerEditorDecorator(
		pi,
		(tui, theme, keybindings) => new CustomEditor(tui, theme, keybindings),
		(base, keybindings) =>
			createCapturePromptEditor(
				base,
				store,
				currentCwd,
				keybindings,
				alias => styleAlias(alias),
			),
	)

	pi.on('input', event => {
		const images = store.imagesFor(event.text)
		if (images.length === 0) return { action: 'continue' }
		return {
			action: 'transform',
			text: event.text,
			images: [...(event.images ?? []), ...images],
		}
	})

	pi.registerShortcut('ctrl+shift+left', {
		description: 'Scroll prompt images left',
		handler: () => store.scroll(-1),
	})
	pi.registerShortcut('ctrl+shift+right', {
		description: 'Scroll prompt images right',
		handler: () => store.scroll(1),
	})
}
