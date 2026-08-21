export type ActivityStripState = {
	promptStarted: boolean;
	frozen: boolean;
	startedAtMs: number;
	elapsedMs: number;
	turns: number;
	tools: number;
};

const CLOCK_GLYPH = "◷";
const PART_SEP = " · ";

export function emptyActivityStrip(): ActivityStripState {
	return {
		promptStarted: false,
		frozen: false,
		startedAtMs: 0,
		elapsedMs: 0,
		turns: 0,
		tools: 0,
	};
}

export function startPrompt(nowMs: number): ActivityStripState {
	return {
		...emptyActivityStrip(),
		promptStarted: true,
		startedAtMs: nowMs,
	};
}

export function tickElapsed(state: ActivityStripState, nowMs: number): ActivityStripState {
	if (!state.promptStarted || state.frozen) return state;
	return { ...state, elapsedMs: Math.max(0, nowMs - state.startedAtMs) };
}

export function settleStrip(state: ActivityStripState, nowMs: number): ActivityStripState {
	if (!state.promptStarted) return state;
	return {
		...state,
		frozen: true,
		elapsedMs: Math.max(0, nowMs - state.startedAtMs),
	};
}

export function countTurn(state: ActivityStripState): ActivityStripState {
	if (!state.promptStarted) return state;
	return { ...state, turns: state.turns + 1 };
}

export function countTool(state: ActivityStripState): ActivityStripState {
	if (!state.promptStarted) return state;
	return { ...state, tools: state.tools + 1 };
}

export function formatElapsed(elapsedMs: number): string {
	const totalSeconds = Math.max(0, Math.floor(elapsedMs / 1000));
	const minutes = Math.floor(totalSeconds / 60);
	const seconds = totalSeconds % 60;
	return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

export function formatActivityLine(state: ActivityStripState): string {
	return [
		`${CLOCK_GLYPH} ${formatElapsed(state.elapsedMs)}`,
		`${state.turns} turns`,
		`${state.tools} tools`,
	].join(PART_SEP);
}

export function clipToTerminalWidth(text: string, width: number): string {
	const single = text.replace(/[\r\n]+/g, " ");
	if (width <= 0) return "";
	if (single.length <= width) return single;
	if (width === 1) return "…";
	return `${single.slice(0, width - 1)}…`;
}

