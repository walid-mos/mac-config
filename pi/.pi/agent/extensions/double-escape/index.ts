/**
 * Double-escape clear: two Escapes in quick succession empty the prompt.
 *
 * A single Escape keeps its default behavior (interrupt while streaming,
 * cancel autocomplete, no-op when idle). The double-press only clears when
 * the editor is non-empty, so Escape Esc on an empty editor stays inert.
 */

import {
	CustomEditor,
	type EditorFactory,
	type ExtensionAPI,
} from "@earendil-works/pi-coding-agent";
import { DoubleEscapeEditor } from "./editor.ts";

/**
 * Factories installed by this extension, guarded against re-installation:
 * session_start fires on new/resume/fork too, and the editor component
 * survives session replacement while extensions are re-instantiated.
 */
const installedFactories = new WeakSet<object>();

export default function doubleEscapeClear(pi: ExtensionAPI): void {
	pi.on("session_start", (_event, ctx) => {
		const previous = ctx.ui.getEditorComponent();
		if (previous && installedFactories.has(previous)) return;
		const factory: EditorFactory = (tui, theme, keybindings) => {
			const base =
				previous?.(tui, theme, keybindings) ??
				new CustomEditor(tui, theme, keybindings);
			return new DoubleEscapeEditor(base, keybindings);
		};
		installedFactories.add(factory);
		ctx.ui.setEditorComponent(factory);
	});
}
