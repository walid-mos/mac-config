import type {
	CompactComponent,
	CompactRenderContext,
	CompactTheme,
	CompactToolResult,
} from "../compact-tools/types.ts";
import { createWriteFrameComponent } from "./component.ts";
import { parseWriteArgs } from "./frame.ts";

export function writeCollapsedBody(
	result: CompactToolResult,
	_options: { expanded?: boolean; isPartial?: boolean },
	theme: CompactTheme,
	context: CompactRenderContext,
): CompactComponent {
	const parsed = parseWriteArgs(context.args as Record<string, unknown> | undefined);
	if (!parsed || result.isError) return { render: () => [], invalidate: () => {} };
	return createWriteFrameComponent(parsed.path, parsed.content, theme);
}
