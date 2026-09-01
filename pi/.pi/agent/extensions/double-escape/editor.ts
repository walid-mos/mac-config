import { EscapePacer } from './pacer.ts'

import type {
	AppKeybinding,
	KeybindingsManager,
} from '@earendil-works/pi-coding-agent'
import type {
	AutocompleteProvider,
	EditorComponent,
	Focusable,
} from '@earendil-works/pi-tui'

type ActionEditor = EditorComponent & {
	actionHandlers: Map<AppKeybinding, () => void>
	onEscape?: () => void
	onCtrlD?: () => void
	onPasteImage?: () => void
	onExtensionShortcut?: (data: string) => boolean
}

export class DoubleEscapeEditor implements EditorComponent, Focusable {
	private readonly pacer = new EscapePacer()
	private readonly base: ActionEditor
	private readonly keybindings: KeybindingsManager
	private readonly now: () => number

	constructor(
		base: EditorComponent,
		keybindings: KeybindingsManager,
		now: () => number = Date.now,
	) {
		const actionBase = asActionEditor(base)
		if (!actionBase) {
			throw new Error(
				'double-escape: wrapped editor must expose the CustomEditor action surface',
			)
		}
		this.base = actionBase
		this.keybindings = keybindings
		this.now = now
	}

	/**
	 * Pi wires application actions onto a custom editor only when it exposes the
	 * CustomEditor action surface. Proxy it to the wrapped editor so shortcuts
	 * such as app.tools.expand survive this decorator.
	 */
	get actionHandlers(): Map<AppKeybinding, () => void> {
		return this.base.actionHandlers
	}

	get onEscape(): (() => void) | undefined {
		return this.base.onEscape
	}

	set onEscape(value: (() => void) | undefined) {
		this.base.onEscape = value
	}

	get onCtrlD(): (() => void) | undefined {
		return this.base.onCtrlD
	}

	set onCtrlD(value: (() => void) | undefined) {
		this.base.onCtrlD = value
	}

	get onPasteImage(): (() => void) | undefined {
		return this.base.onPasteImage
	}

	set onPasteImage(value: (() => void) | undefined) {
		this.base.onPasteImage = value
	}

	get onExtensionShortcut(): ((data: string) => boolean) | undefined {
		return this.base.onExtensionShortcut
	}

	set onExtensionShortcut(value: ((data: string) => boolean) | undefined) {
		this.base.onExtensionShortcut = value
	}

	get focused(): boolean {
		return isFocusableEditor(this.base) && this.base.focused
	}

	set focused(value: boolean) {
		if (isFocusableEditor(this.base)) this.base.focused = value
	}

	get wantsKeyRelease(): boolean | undefined {
		return this.base.wantsKeyRelease
	}

	set wantsKeyRelease(value: boolean | undefined) {
		this.base.wantsKeyRelease = value
	}

	get onSubmit(): ((text: string) => void) | undefined {
		return this.base.onSubmit
	}

	set onSubmit(value: ((text: string) => void) | undefined) {
		this.base.onSubmit = value
	}

	get onChange(): ((text: string) => void) | undefined {
		return this.base.onChange
	}

	set onChange(value: ((text: string) => void) | undefined) {
		this.base.onChange = value
	}

	get borderColor(): ((text: string) => string) | undefined {
		return this.base.borderColor
	}

	set borderColor(value: ((text: string) => string) | undefined) {
		this.base.borderColor = value
	}

	handleInput(data: string): void {
		if (
			this.keybindings.matches(data, 'app.interrupt') &&
			!isShowingAutocomplete(this.base)
		) {
			if (
				this.pacer.registerEscape(this.now()) &&
				this.getText().length > 0
			) {
				this.setText('')
				return
			}
		} else {
			// Any other key (or closing the autocomplete) breaks the gesture.
			this.pacer.reset()
		}
		this.base.handleInput(data)
	}

	render(width: number): string[] {
		return this.base.render(width)
	}

	invalidate(): void {
		this.base.invalidate()
	}

	getText(): string {
		return this.base.getText()
	}

	setText(text: string): void {
		this.base.setText(text)
	}

	addToHistory(text: string): void {
		this.base.addToHistory?.(text)
	}

	insertTextAtCursor(text: string): void {
		this.base.insertTextAtCursor?.(text)
	}

	getExpandedText(): string {
		return this.base.getExpandedText?.() ?? this.base.getText()
	}

	setAutocompleteProvider(provider: AutocompleteProvider): void {
		this.base.setAutocompleteProvider?.(provider)
	}

	setPaddingX(padding: number): void {
		this.base.setPaddingX?.(padding)
	}

	setAutocompleteMaxVisible(maxVisible: number): void {
		this.base.setAutocompleteMaxVisible?.(maxVisible)
	}
}

function asActionEditor(editor: EditorComponent): ActionEditor | undefined {
	const candidate = editor as Partial<ActionEditor>
	return candidate.actionHandlers instanceof Map
		? (candidate as ActionEditor)
		: undefined
}

function isFocusableEditor(
	editor: EditorComponent,
): editor is EditorComponent & Focusable {
	return 'focused' in editor
}

function isShowingAutocomplete(editor: EditorComponent): boolean {
	const candidate = editor as EditorComponent & {
		isShowingAutocomplete?: () => boolean
	}
	return candidate.isShowingAutocomplete?.() ?? false
}
