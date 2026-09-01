import type {
	EditorFactory,
	ExtensionAPI,
	KeybindingsManager,
} from '@earendil-works/pi-coding-agent'
import type { EditorComponent } from '@earendil-works/pi-tui'

export type EditorDecorator = (
	base: EditorComponent,
	keybindings: KeybindingsManager,
) => EditorComponent

const factoryDecorators = new WeakMap<EditorFactory, ReadonlySet<symbol>>()

/**
 * Compose one editor decorator exactly once across every session_start event.
 * Metadata follows the complete factory chain, so independently registered
 * decorators do not wrap each other again on session replacement.
 */
export function registerEditorDecorator(
	pi: ExtensionAPI,
	createDefault: EditorFactory,
	decorate: EditorDecorator,
): void {
	const decoratorId = Symbol('editor-decorator')
	pi.on('session_start', (_event, context) => {
		const previous = context.ui.getEditorComponent()
		if (previous && factoryDecorators.get(previous)?.has(decoratorId))
			return

		const factory: EditorFactory = (tui, theme, keybindings) => {
			const base =
				previous?.(tui, theme, keybindings) ??
				createDefault(tui, theme, keybindings)
			return decorate(base, keybindings)
		}
		const installed = new Set(
			previous ? factoryDecorators.get(previous) : undefined,
		)
		installed.add(decoratorId)
		factoryDecorators.set(factory, installed)
		context.ui.setEditorComponent(factory)
	})
}
