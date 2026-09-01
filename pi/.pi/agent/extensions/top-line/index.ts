/**
 * Top-line editor: keep only the top border line of the prompt.
 *
 * The built-in editor draws a horizontal rule above and below the input.
 * This extension decorates the active editor so the bottom rule disappears,
 * leaving a single separator line above the prompt. Scroll indicators
 * (`↑ N` / `↓ N`) and the autocomplete list are preserved.
 */

import {
	CustomEditor,
	type EditorFactory,
	type ExtensionAPI,
} from '@earendil-works/pi-coding-agent'

import { keepTopRuleOnly } from './filter.ts'

type Renderable = {
	render(width: number): string[]
}

/**
 * Wrap an editor component so its render drops the bottom border rule.
 * A Proxy forwards everything else (state, accessors like `focused` and
 * `borderColor`, methods) to the wrapped editor untouched.
 */
function withTopRuleOnly<T extends Renderable>(base: T): T {
	return new Proxy(base, {
		get(target, property, receiver) {
			if (property === 'render') {
				return (width: number) => keepTopRuleOnly(target.render(width))
			}
			const value = Reflect.get(target, property, target)
			return typeof value === 'function' ? value.bind(target) : value
		},
	})
}

/**
 * Factories installed by this extension, guarded against re-installation:
 * session_start fires on new/resume/fork too, and the editor component
 * survives session replacement while extensions are re-instantiated.
 */
const installedFactories = new WeakSet<object>()

export default function topLineEditor(pi: ExtensionAPI): void {
	pi.on('session_start', (_event, ctx) => {
		const previous = ctx.ui.getEditorComponent()
		if (previous && installedFactories.has(previous)) return
		const factory: EditorFactory = (tui, theme, keybindings) => {
			const base =
				previous?.(tui, theme, keybindings) ??
				new CustomEditor(tui, theme, keybindings)
			return withTopRuleOnly(base)
		}
		installedFactories.add(factory)
		ctx.ui.setEditorComponent(factory)
	})
}
