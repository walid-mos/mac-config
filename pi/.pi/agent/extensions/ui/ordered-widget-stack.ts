import type { ExtensionUIContext, Theme } from "@earendil-works/pi-coding-agent";
import type { TUI } from "@earendil-works/pi-tui";
import {
	getSurfacePreferences,
	subscribeSurfaceChanges,
	surfaceRegistry,
	type SurfacePlacement,
} from "./surface.ts";

const HOST_WIDGET_IDS: Record<SurfacePlacement, string> = {
	aboveEditor: "ordered-above-editor",
	belowEditor: "ordered-below-editor",
	footer: "ordered-footer",
};

export const ABOVE_EDITOR_PRIORITY = {
	goal: 100,
	backgroundTasks: 200,
	activity: 300,
} as const;

export type OrderedWidgetEntry = {
	priority: number;
	active?: boolean;
	render: (width: number, theme: Theme) => string[];
};

type MountedHost = {
	component: OrderedWidgetHost;
};

type WidgetPlacement = Exclude<SurfacePlacement, "footer">;

const mountedHosts = new Map<WidgetPlacement, MountedHost>();
const surfaceEntriesByPlacement = new Map<WidgetPlacement, Map<string, () => void>>();

export function orderedWidgetLines(width: number, theme: Theme): string[] {
	return surfaceRegistry.render("aboveEditor", width, theme, getSurfacePreferences());
}

class OrderedWidgetHost {
	private readonly unsubscribe: () => void;

	constructor(
		private readonly tui: TUI,
		private readonly theme: Theme,
		private readonly placement: WidgetPlacement,
	) {
		this.unsubscribe = subscribeSurfaceChanges(() => this.requestRender());
	}

	render(width: number): string[] {
		return surfaceRegistry.render(this.placement, width, this.theme, getSurfacePreferences());
	}

	invalidate(): void {}

	dispose(): void {
		this.unsubscribe();
		const mounted = mountedHosts.get(this.placement);
		if (mounted?.component === this) mountedHosts.delete(this.placement);
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
	setOrderedSurfaceWidget(ui, key, entry, "aboveEditor");
}

export function setOrderedSurfaceWidget(
	ui: ExtensionUIContext,
	key: string,
	entry: OrderedWidgetEntry | undefined,
	placement: WidgetPlacement = "aboveEditor",
): void {
	if (entry === undefined) {
		removeSurfaceEntry(ui, key, placement);
		return;
	}

	const handles = getSurfaceHandles(placement);
	const unregister = surfaceRegistry.register({
		id: key,
		placement,
		priority: entry.priority,
		active: entry.active,
		render: ({ width, theme }) => (theme === undefined ? [] : entry.render(width, theme)),
	});
	handles.set(key, unregister);
	mountHost(ui, placement);
}

function removeSurfaceEntry(ui: ExtensionUIContext, key: string, placement: WidgetPlacement): void {
	const handles = getSurfaceHandles(placement);
	const unregister = handles.get(key);
	if (unregister === undefined) return;
	handles.delete(key);
	unregister();
	if (surfaceRegistry.hasEntries(placement)) return;
	ui.setWidget(HOST_WIDGET_IDS[placement], undefined);
	const host = mountedHosts.get(placement);
	host?.component.dispose();
}

function mountHost(ui: ExtensionUIContext, placement: WidgetPlacement): void {
	if (mountedHosts.has(placement)) return;
	ui.setWidget(
		HOST_WIDGET_IDS[placement],
		(tui, theme) => {
			const component = new OrderedWidgetHost(tui, theme, placement);
			mountedHosts.set(placement, { component });
			return component;
		},
		{ placement },
	);
}

function getSurfaceHandles(placement: WidgetPlacement): Map<string, () => void> {
	const existing = surfaceEntriesByPlacement.get(placement);
	if (existing !== undefined) return existing;
	const handles = new Map<string, () => void>();
	surfaceEntriesByPlacement.set(placement, handles);
	return handles;
}
