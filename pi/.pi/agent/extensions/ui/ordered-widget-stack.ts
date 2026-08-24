import type { ExtensionUIContext, Theme } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";

const HOST_WIDGET_ID = "ordered-above-editor";

export const ABOVE_EDITOR_PRIORITY = {
	goal: 100,
	backgroundTasks: 200,
	activity: 300,
} as const;

export type OrderedWidgetEntry = {
	priority: number;
	render: (width: number, theme: Theme) => string[];
};

type MountedHost = {
	component: OrderedWidgetHost;
};

const entries = new Map<string, OrderedWidgetEntry>();
let mountedHost: MountedHost | undefined;

export function orderedWidgetLines(width: number, theme: Theme): string[] {
	return [...entries.entries()]
		.sort(([leftKey, left], [rightKey, right]) =>
			left.priority === right.priority
				? leftKey.localeCompare(rightKey)
				: left.priority - right.priority,
		)
		.flatMap(([, entry]) => entry.render(width, theme));
}

class OrderedWidgetHost {
	constructor(
		private readonly tui: TUI,
		private readonly theme: Theme,
	) {}

	render(width: number): string[] {
		return orderedWidgetLines(width, this.theme);
	}

	invalidate(): void {}

	dispose(): void {
		if (mountedHost?.component === this) mountedHost = undefined;
	}

	requestRender(): void {
		this.tui.requestRender();
	}
}

export function setOrderedAboveEditorWidget(
	ui: ExtensionUIContext,
	key: string,
	entry: OrderedWidgetEntry | undefined,
): void {
	if (entry === undefined) entries.delete(key);
	else entries.set(key, entry);

	if (entries.size === 0) {
		ui.setWidget(HOST_WIDGET_ID, undefined);
		mountedHost = undefined;
		return;
	}

	if (mountedHost === undefined) {
		ui.setWidget(
			HOST_WIDGET_ID,
			(tui, theme) => {
				const component = new OrderedWidgetHost(tui, theme);
				mountedHost = { component };
				return component;
			},
			{ placement: "aboveEditor" },
		);
		return;
	}

	mountedHost.component.requestRender();
}
