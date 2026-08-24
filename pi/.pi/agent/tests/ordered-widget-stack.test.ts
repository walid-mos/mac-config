import assert from "node:assert/strict";
import test from "node:test";
import {
	ABOVE_EDITOR_PRIORITY,
	setOrderedAboveEditorWidget,
} from "../extensions/ui/ordered-widget-stack.ts";

test("keeps above-editor widgets in priority order without remounting on updates", () => {
	let registrations = 0;
	let removals = 0;
	let rendersRequested = 0;
	let component: { dispose?(): void; render(width: number): string[] } | undefined;
	const tui = { requestRender: () => { rendersRequested += 1; } };
	const theme = {};
	const ui = {
		setWidget(
			_id: string,
			content: ((host: typeof tui, colors: typeof theme) => { dispose?(): void; render(width: number): string[] }) | undefined,
			_options?: { placement?: string },
		): void {
			if (content === undefined) {
				removals += 1;
				return;
			}
			registrations += 1;
			component = content(tui, theme);
		},
	};

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
});
