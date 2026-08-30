import { writeFrameRows, type FrameTheme, type WriteFrameComponent } from "./frame.ts";

export function createWriteFrameComponent(
	path: string,
	content: string,
	theme: FrameTheme,
): WriteFrameComponent {
	return {
		render(width: number): string[] {
			return writeFrameRows(path, content, width, theme);
		},
		invalidate(): void {},
	};
}
