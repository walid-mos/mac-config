import { createRotation, type IntervalScheduler, type Rotation } from "./rotation.ts";

export type Spinner = {
	intervalMs: number;
	frames: readonly [string, ...string[]];
};

/** Canonical `sand` animation from sindresorhus/cli-spinners. */
export const SAND_SPINNER: Spinner = {
	intervalMs: 80,
	frames: [
		"⠁",
		"⠂",
		"⠄",
		"⡀",
		"⡈",
		"⡐",
		"⡠",
		"⣀",
		"⣁",
		"⣂",
		"⣄",
		"⣌",
		"⣔",
		"⣤",
		"⣥",
		"⣦",
		"⣮",
		"⣶",
		"⣷",
		"⣿",
		"⡿",
		"⠿",
		"⢟",
		"⠟",
		"⡛",
		"⠛",
		"⠫",
		"⢋",
		"⠋",
		"⠍",
		"⡉",
		"⠉",
		"⠑",
		"⠡",
		"⢁",
	],
};

/** Emits the first frame immediately, then loops at the spinner interval. */
export function createSpinnerRotation(options: {
	scheduler: IntervalScheduler;
	spinner: Spinner;
	onFrame: (frame: string) => void;
}): Rotation {
	let frameIndex = 0;
	return createRotation({
		scheduler: options.scheduler,
		intervalMs: options.spinner.intervalMs,
		advance: () => {
			options.onFrame(options.spinner.frames[frameIndex] ?? options.spinner.frames[0]);
			frameIndex = (frameIndex + 1) % options.spinner.frames.length;
		},
	});
}
