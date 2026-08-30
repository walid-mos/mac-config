import assert from "node:assert/strict";
import test from "node:test";
import {
	ABOVE_EDITOR_PRIORITY,
	HOST_WIDGET_IDS,
	setOrderedAboveEditorWidget,
} from "../extensions/ui/ordered-widget-stack.ts";
import { surfaceRegistry } from "../extensions/ui/surface.ts";

type Component = {
	dispose?: () => void;
	invalidate?: () => void;
	render: (width: number) => string[];
};

function fakeTheme() {
	return { fg: (_role: string, text: string) => text };
}

test("keeps above-editor widgets in priority order without remounting on updates", () => {
	surfaceRegistry.clear();
	let registrations = 0;
	let removals = 0;
	let rendersRequested = 0;
	let activeTheme: Record<string, never> = {};
	let component: Component | undefined;
	const tui = { requestRender: () => { rendersRequested += 1; } };
	const ui = {
		get theme(): Record<string, never> {
			return activeTheme;
		},
		setWidget(
			_id: string,
			content: ((host: typeof tui, colors: typeof activeTheme) => Component) | undefined,
		): void {
			if (content === undefined) {
				removals += 1;
				component = undefined;
				return;
			}
			registrations += 1;
			component = content(tui, activeTheme);
		},
	};

	try {
		setOrderedAboveEditorWidget(ui, "goal", {
			priority: ABOVE_EDITOR_PRIORITY.goal,
			render: () => ["goal"],
		});
		setOrderedAboveEditorWidget(ui, "background", {
			priority: ABOVE_EDITOR_PRIORITY.backgroundTasks,
			render: () => ["background"],
		});
		setOrderedAboveEditorWidget(ui, "activity", {
			priority: ABOVE_EDITOR_PRIORITY.activity,
			render: () => ["activity"],
		});

		assert.equal(registrations, 1);
		assert.deepEqual(component?.render(80), ["goal", "background", "activity"]);

		setOrderedAboveEditorWidget(ui, "goal", {
			priority: ABOVE_EDITOR_PRIORITY.goal,
			render: () => ["goal updated"],
		});
		assert.equal(registrations, 1);
		assert.deepEqual(component?.render(80), ["goal updated", "background", "activity"]);
		assert.equal(rendersRequested, 3);

		component?.dispose?.();
		setOrderedAboveEditorWidget(ui, "goal", {
			priority: ABOVE_EDITOR_PRIORITY.goal,
			render: () => ["goal after remount"],
		});
		assert.equal(registrations, 2);
		assert.deepEqual(component?.render(80), ["goal after remount", "background", "activity"]);

		setOrderedAboveEditorWidget(ui, "goal", undefined);
		setOrderedAboveEditorWidget(ui, "activity", undefined);
		setOrderedAboveEditorWidget(ui, "background", undefined);
		assert.equal(removals, 1);
	} finally {
		surfaceRegistry.clear();
		activeTheme = {};
	}
});

test("re-renders with the live ui theme after invalidation", () => {
	surfaceRegistry.clear();
	let rendersRequested = 0;
	let component: Component | undefined;
	const tui = { requestRender: () => { rendersRequested += 1; } };
	let activeTheme: { accent?: string } = { accent: "mauve" };
	const ui = {
		get theme(): { accent?: string } {
			return activeTheme;
		},
		setWidget(
			_id: string,
			content: ((host: typeof tui, colors: unknown) => Component) | undefined,
		): void {
			if (content === undefined) {
				component = undefined;
				return;
			}
			component = content(tui, activeTheme);
		},
	};

	try {
		setOrderedAboveEditorWidget(ui, "themed", {
			priority: 1,
			render: (_width, theme) => [`accent:${String((theme as { accent?: string }).accent)}`],
		});

		assert.deepEqual(component?.render(80), ["accent:mauve"]);

		activeTheme = { accent: "blue" };
		component?.invalidate?.();
		assert.deepEqual(component?.render(80), ["accent:blue"]);
		// register() fired before the host subscribed; invalidate() is observed.
		assert.equal(rendersRequested, 1);
	} finally {
		setOrderedAboveEditorWidget(ui, "themed", undefined);
		surfaceRegistry.clear();
	}
});

/** Mimics pi's setExtensionWidget: one component per key, dispose on overwrite. */
function piLikeWidgets() {
	const above = new Map<string, Component>();
	const calls: string[] = [];
	const ui = {
		setWidget(key: string, content: unknown) {
			above.get(key)?.dispose?.();
			above.delete(key);
			calls.push(content === undefined ? `remove:${key}` : `mount:${key}`);
			if (content === undefined) return;
			const factory = content as (tui: unknown, theme: unknown) => Component;
			above.set(key, factory({ requestRender: () => {} }, fakeTheme()));
		},
		requestRender: () => {},
		get theme() {
			return fakeTheme();
		},
	};
	return { above, calls, ui };
}

test("surface registry and host are process-global across isolated module instances", async () => {
	surfaceRegistry.clear();
	const { above, calls, ui } = piLikeWidgets();

	const firstStack = await import("../extensions/ui/ordered-widget-stack.ts");
	const secondStack = await import("../extensions/ui/ordered-widget-stack.ts?instance=2");
	const secondSurface = await import("../extensions/ui/surface.ts?instance=2");

	assert.equal(secondSurface.surfaceRegistry, surfaceRegistry, "one process-global registry");
	assert.deepEqual(secondStack.HOST_WIDGET_IDS, HOST_WIDGET_IDS, "one stable host key per placement");

	try {
		firstStack.setOrderedAboveEditorWidget(ui, "working-loader", {
			priority: ABOVE_EDITOR_PRIORITY.working,
			render: () => ["✻ working..."],
		});
		secondStack.setOrderedAboveEditorWidget(ui, "background", {
			priority: ABOVE_EDITOR_PRIORITY.backgroundTasks,
			render: () => ["◆ BACKGROUND"],
		});

		assert.deepEqual(calls, [`mount:${HOST_WIDGET_IDS.aboveEditor}`], "host mounted once");
		assert.deepEqual(
			above.get(HOST_WIDGET_IDS.aboveEditor)?.render(80),
			["✻ working...", "◆ BACKGROUND"],
			"both extensions render through the same globally ordered host",
		);

		firstStack.setOrderedAboveEditorWidget(ui, "working-loader", undefined);
		assert.deepEqual(calls, [`mount:${HOST_WIDGET_IDS.aboveEditor}`], "host kept for background");
		assert.deepEqual(above.get(HOST_WIDGET_IDS.aboveEditor)?.render(80), ["◆ BACKGROUND"]);

		secondStack.setOrderedAboveEditorWidget(ui, "background", undefined);
		assert.deepEqual(calls, [
			`mount:${HOST_WIDGET_IDS.aboveEditor}`,
			`remove:${HOST_WIDGET_IDS.aboveEditor}`,
		]);
		assert.equal(above.has(HOST_WIDGET_IDS.aboveEditor), false);
	} finally {
		surfaceRegistry.clear();
	}
});
