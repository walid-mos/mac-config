/**
 * Double-escape clear: two Escapes in quick succession empty the prompt.
 *
 * A single Escape keeps its default behavior (interrupt while streaming,
 * cancel autocomplete, no-op when idle). The double-press only clears when
 * the editor is non-empty, so Escape Esc on an empty editor stays inert.
 */

import {
	CustomEditor,
	type ExtensionAPI,
} from '@earendil-works/pi-coding-agent'

import { registerEditorDecorator } from '../ui/editor-decorator.ts'

import { createDoubleEscapeEditor } from './editor.ts'

export default function doubleEscapeClear(pi: ExtensionAPI): void {
	registerEditorDecorator(
		pi,
		(tui, theme, keybindings) => new CustomEditor(tui, theme, keybindings),
		createDoubleEscapeEditor,
	)
}
