import {
	createEditorProxy,
	type ActionEditor,
	type KeybindingsManager,
} from '../ui/editor-proxy.ts'

import { EscapePacer } from './pacer.ts'

import type { EditorComponent } from '@earendil-works/pi-tui'

export function createDoubleEscapeEditor(
	base: EditorComponent,
	keybindings: KeybindingsManager,
	now: () => number = Date.now,
): ActionEditor {
	const pacer = new EscapePacer()
	return createEditorProxy(base, {
		handleInput(data: string): void {
			if (
				keybindings.matches(data, 'app.interrupt') &&
				!isShowingAutocomplete(base)
			) {
				if (pacer.registerEscape(now()) && base.getText().length > 0) {
					base.setText('')
					return
				}
			} else {
				// Any other key (or closing the autocomplete) breaks the gesture.
				pacer.reset()
			}
			base.handleInput(data)
		},
	})
}

function isShowingAutocomplete(editor: EditorComponent): boolean {
	const candidate = editor as EditorComponent & {
		isShowingAutocomplete?: () => boolean
	}
	return candidate.isShowingAutocomplete?.() ?? false
}
