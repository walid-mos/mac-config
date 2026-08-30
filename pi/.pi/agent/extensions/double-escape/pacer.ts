/** Max delay (ms) between two Escapes for them to count as a double-press. */
export const DOUBLE_ESCAPE_WINDOW_MS = 600;

/**
 * Tracks consecutive Escape presses for the double-escape gesture.
 *
 * The first Escape opens the window, the second one inside the window fires
 * (returns true) and re-arms the pacer. Any other key or a cancelled
 * autocomplete resets it, so Escape never accumulates stale state.
 */
export class EscapePacer {
	private lastEscapeAt: number | null = null;

	/** Register an Escape at time `now` (ms). Returns true on the second press. */
	registerEscape(now: number): boolean {
		const isDouble =
			this.lastEscapeAt !== null && now - this.lastEscapeAt <= DOUBLE_ESCAPE_WINDOW_MS;
		this.lastEscapeAt = isDouble ? null : now;
		return isDouble;
	}

	/** Forget any in-flight first press. */
	reset(): void {
		this.lastEscapeAt = null;
	}
}
