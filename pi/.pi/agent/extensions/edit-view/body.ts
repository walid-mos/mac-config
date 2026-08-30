/**
 * Collapsed body for the edit row: the diff frame for successful edits,
 * nothing otherwise (the compact row carries the error summary). Pi-free
 * module, fully unit-testable.
 */

import type {
	CompactComponent,
	CompactRenderContext,
	CompactTheme,
	CompactToolResult,
} from "../compact-tools/types.ts";
import { createEditFrameComponent } from "./component.ts";
import { parseEditArgs } from "./frame.ts";

export function editCollapsedBody(
	result: CompactToolResult,
	_options: { expanded?: boolean; isPartial?: boolean },
	theme: CompactTheme,
	context: CompactRenderContext,
): CompactComponent {
	const parsed = parseEditArgs(context.args as Record<string, unknown> | undefined);
	if (!parsed || result.isError) {
		return { render: () => [], invalidate: () => {} };
	}
	return createEditFrameComponent(parsed.path, parsed.edits, theme);
}
