import assert from "node:assert/strict";
import test from "node:test";
import { createSurfaceRegistry, type SurfaceEntry } from "../extensions/ui/surface.ts";

function entry(overrides: Partial<SurfaceEntry> & Pick<SurfaceEntry, "id">): SurfaceEntry {
	return {
		placement: "aboveEditor",
		render: () => [overrides.id],
		...overrides,
	};
}

test("renders targets in priority order and clips each line to the width", () => {
	const registry = createSurfaceRegistry();
	registry.register(entry({ id: "later", priority: 2, render: () => ["second\nignored"] }));
	registry.register(entry({ id: "first", priority: 1, render: () => ["first line is longer"] }));
	registry.register(entry({ id: "below", placement: "belowEditor" }));

	assert.deepEqual(registry.render("aboveEditor", 8), ["first l…", "second"]);
	assert.deepEqual(registry.render("belowEditor", 80), ["below"]);
	assert.deepEqual(registry.render("aboveEditor", 0), []);
});

test("keeps every rendered line in the single normal view", () => {
	const registry = createSurfaceRegistry();
	registry.register(
		entry({ id: "details", render: () => ["summary", "detail", "full detail"] }),
	);

	assert.deepEqual(registry.render("aboveEditor", 80), ["summary", "detail", "full detail"]);
});

test("truncates ANSI-colored lines without exposing escape fragments", () => {
	const registry = createSurfaceRegistry();
	registry.register(entry({ id: "colored", render: () => ["\u001b[31mabcdef\u001b[0m"] }));

	const [line] = registry.render("aboveEditor", 4);
	assert.equal(line?.includes("\u001b[31m"), true);
	assert.equal(line?.includes("\u001b[0m"), true);
	assert.equal(line?.includes("\u001b[3"), true);
});

test("replaces duplicate ids and makes stale/repeated unsubscriptions harmless", () => {
	const registry = createSurfaceRegistry();
	const removeFirst = registry.register(entry({ id: "status", placement: "belowEditor", render: () => ["first"] }));
	const removeReplacement = registry.register(entry({ id: "status", render: () => ["replacement"] }));

	removeFirst();
	assert.deepEqual(registry.render("aboveEditor", 80), ["replacement"]);
	removeReplacement();
	removeReplacement();
	assert.deepEqual(registry.render("aboveEditor", 80), []);
});

test("notifies subscribers on registration changes only while entries change", () => {
	const registry = createSurfaceRegistry();
	let changes = 0;
	const unsubscribe = registry.subscribe(() => {
		changes += 1;
	});
	const remove = registry.register(entry({ id: "watched" }));
	assert.equal(changes, 1);
	remove();
	assert.equal(changes, 2);
	remove();
	unsubscribe();
	registry.register(entry({ id: "unobserved" }));
	assert.equal(changes, 2);
});
