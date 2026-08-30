/**
 * Double-escape clear: two Escapes in quick succession empty the prompt.
 *
 * A single Escape keeps its default behavior (interrupt while streaming,
 * cancel autocomplete, no-op when idle). The double-press only clears when
 * the editor is non-empty, so Escape Esc on an empty editor stays inert.
 */

import { CustomEditor, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { EscapePacer } from "./pacer.ts";

class DoubleEscapeEditor extends CustomEditor {
	private pacer = new EscapePacer();

	handleInput(data: string): void {
		if (this.keybindings.matches(data, "app.interrupt") && !this.isShowingAutocomplete()) {
			if (this.pacer.registerEscape(Date.now()) && this.getText().length > 0) {
				this.setText("");
				return;
			}
		} else {
			// Any other key (or closing the autocomplete) breaks the gesture.
			this.pacer.reset();
		}
		super.handleInput(data);
	}
}

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
		const factory: NonNullable<typeof previous> = (tui, theme, keybindings) =>
			new DoubleEscapeEditor(tui, theme, keybindings);
		installedFactories.add(factory);
		ctx.ui.setEditorComponent(factory);
	});
}
