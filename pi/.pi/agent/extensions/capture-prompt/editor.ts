import {
	createEditorProxy,
	type ActionEditor,
	type KeybindingsManager,
} from '../ui/editor-proxy.ts'

import type { CaptureStore } from './store.ts'
import type { EditorComponent } from '@earendil-works/pi-tui'

const IMAGE_ALIAS = /\[img:\d+\]/gu

export function createCapturePromptEditor(
	base: EditorComponent,
	store: CaptureStore,
	cwd: string,
	keybindings: KeybindingsManager,
	styleAlias: (alias: string) => string,
): ActionEditor {
	let upstreamChange = base.onChange
	let upstreamSubmit = base.onSubmit
	let rewriting = false
	const handleSubmit = (text: string): void => {
		store.prepareSubmission(text)
		upstreamSubmit?.(text)
	}
	const handleChange = (text: string): void => {
		if (rewriting) {
			store.retainAliases(text)
			upstreamChange?.(text)
			return
		}

		const rewritten = store.ingestPaths(text, cwd)
		if (rewritten !== text) {
			rewriting = true
			try {
				base.setText(rewritten)
			} finally {
				rewriting = false
			}
			return
		}
		store.retainAliases(text)
		upstreamChange?.(text)
	}
	const editor = createEditorProxy(base, {
		handleInput(data: string): void {
			const before = base.getText()
			const trailingAlias = before.match(/\[img:\d+\]$/u)
			base.handleInput(data)
			if (
				trailingAlias?.index !== undefined &&
				keybindings.matches(data, 'tui.editor.deleteCharBackward') &&
				base.getText() === before.slice(0, -1)
			)
				base.setText(before.slice(0, trailingAlias.index))
		},
		render(width: number): string[] {
			return base
				.render(width)
				.map(line => line.replace(IMAGE_ALIAS, styleAlias))
		},
		get onSubmit(): ((text: string) => void) | undefined {
			return handleSubmit
		},
		set onSubmit(value: ((text: string) => void) | undefined) {
			upstreamSubmit = value
		},
		get onChange(): ((text: string) => void) | undefined {
			return handleChange
		},
		set onChange(value: ((text: string) => void) | undefined) {
			upstreamChange = value
		},
	})
	base.onChange = handleChange
	base.onSubmit = handleSubmit
	return editor
}
