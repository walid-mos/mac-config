import { renderCompactStack } from './stack-render.ts'
import {
	createCompactRowStackState,
	processSharedStackState,
} from './stack-state.ts'
import {
	beginStackMessage,
	endStackMessage,
	rebuildStackTranscript,
	resetStackTranscript,
	uniqueStackGroups,
	updateStackMessage,
} from './stack-transcript.ts'

import type { CompactRowView } from './line.ts'
import type { CompactRowStackState } from './stack-state.ts'
import type { StackMessage } from './stack-transcript.ts'

export { MAX_VISIBLE_STACK_CALLS } from './stack-render.ts'
export type { StackMessage } from './stack-transcript.ts'

/**
 * Process-global coordinator because Pi loads extension entrypoints through
 * isolated jiti module graphs. It groups consecutive compact calls into one
 * self-rendered component, leaving Pi only one outer spacer for the stack.
 */
export class CompactRowStack {
	private readonly state: CompactRowStackState

	constructor(state: CompactRowStackState = createCompactRowStackState()) {
		this.state = state
	}

	registerTool(tool: string, stackable: boolean): void {
		if (stackable) this.state.stackableTools.add(tool)
		else this.state.stackableTools.delete(tool)
	}

	clearRegisteredTools(): void {
		this.state.stackableTools.clear()
	}

	reset(): void {
		this.state.entries.clear()
		resetStackTranscript(this.state)
	}

	rebuild(messages: ReadonlyArray<StackMessage>): void {
		this.state.entries.clear()
		rebuildStackTranscript(this.state, messages)
	}

	beginMessage(message: StackMessage): void {
		beginStackMessage(this.state, message)
	}

	updateMessage(message: StackMessage): void {
		updateStackMessage(this.state, message)
	}

	endMessage(message: StackMessage): void {
		endStackMessage(this.state, message)
	}

	attach(id: string, view: CompactRowView, invalidate: () => void): void {
		const previous = this.state.entries.get(id)
		this.state.entries.set(id, { view, invalidate })
		if (!previous) this.invalidateGroup(id)
	}

	updateView(id: string, view: CompactRowView): void {
		const entry = this.state.entries.get(id)
		if (entry) entry.view = view
	}

	render(id: string, fallbackView: CompactRowView, width: number): string[] {
		return renderCompactStack(this.state, id, fallbackView, width)
	}

	groups(): string[][] {
		return uniqueStackGroups(this.state)
	}

	private invalidateGroup(id: string): void {
		const group = this.state.groupById.get(id)
		if (!group) return
		for (const memberId of group)
			this.state.entries.get(memberId)?.invalidate()
	}
}

// Every module graph gets the current implementation. Only inert data is
// process-global, so /reload never needs a manually versioned cache key.
export const compactRowStack = new CompactRowStack(processSharedStackState())
