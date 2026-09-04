import type {
	AppKeybinding,
	KeybindingsManager,
} from '@earendil-works/pi-coding-agent'
import type { EditorComponent } from '@earendil-works/pi-tui'

export type ActionEditor = EditorComponent & {
	actionHandlers: Map<AppKeybinding, () => void>
	onEscape?: () => void
	onCtrlD?: () => void
	onPasteImage?: () => void
	onExtensionShortcut?: (data: string) => boolean
}

/** Only overrides belong to the decorator; all other state stays on the base. */
export function createEditorProxy(
	base: EditorComponent,
	overrides: Partial<ActionEditor>,
): ActionEditor {
	if (!isActionEditor(base))
		throw new Error(
			'editor decorator: wrapped editor must expose the CustomEditor action surface',
		)
	const boundMethods = new WeakMap<Callable, Callable>()
	return new Proxy(base, {
		get(target, property): unknown {
			if (Object.hasOwn(overrides, property))
				return Reflect.get(overrides, property)
			const value: unknown = Reflect.get(target, property, target)
			if (!isCallable(value) || !isPrototypeMethod(target, property))
				return value
			// Keep method receivers and identity, without binding callback fields.
			let bound = boundMethods.get(value)
			if (!bound) {
				bound = value.bind(target)
				boundMethods.set(value, bound)
			}
			return bound
		},
		set(target, property, value: unknown): boolean {
			const owner = Object.hasOwn(overrides, property)
				? overrides
				: target
			return Reflect.set(owner, property, value, owner)
		},
		has(target, property): boolean {
			return (
				Object.hasOwn(overrides, property) ||
				Reflect.has(target, property)
			)
		},
	})
}

function isActionEditor(base: EditorComponent): base is ActionEditor {
	return 'actionHandlers' in base && base.actionHandlers instanceof Map
}

type Callable = (...args: unknown[]) => unknown

function isCallable(value: unknown): value is Callable {
	return typeof value === 'function'
}

function isPrototypeMethod(base: object, property: PropertyKey): boolean {
	let prototype: object | null = Object.getPrototypeOf(base)
	while (prototype) {
		const descriptor = Object.getOwnPropertyDescriptor(prototype, property)
		if (descriptor) return typeof descriptor.value === 'function'
		prototype = Object.getPrototypeOf(prototype)
	}
	return false
}

export type { KeybindingsManager }
