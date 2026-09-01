import assert from "node:assert/strict";
import test from "node:test";
import { createSurfaceRegistry, type SurfaceEntry } from "../extensions/ui/surface.ts";
import { terminalLineWidth } from "../extensions/ui/terminal-text.ts";

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

test("caps entries at maxLines with a truncation marker", () => {
	const registry = createSurfaceRegistry();
	const manyLines = Array.from({ length: 13 }, (_, index) => `line ${String(index + 1)}`);

	registry.register(entry({ id: "capped-default", render: () => manyLines }));
	registry.register(entry({ id: "capped-custom", maxLines: 2, render: () => manyLines }));

	assert.deepEqual(registry.render("aboveEditor", 80), [
		"line 1",
		"line 2",
		"… (+11 lines)",
		"line 1",
		"line 2",
		"line 3",
		"line 4",
		"line 5",
		"line 6",
		"line 7",
		"line 8",
		"line 9",
		"line 10",
		"… (+3 lines)",
	]);
	assert.ok(
		registry.render("aboveEditor", 6).every(line => terminalLineWidth(line) <= 6),
	);

});

test("isolates render failures per entry without dropping siblings", () => {
	const registry = createSurfaceRegistry();
	registry.register(entry({ id: "broken", priority: 1, render: () => { throw new Error("boom"); } }));
	registry.register(entry({ id: "healthy", priority: 2, render: () => ["ok"] }));

	assert.deepEqual(registry.render("aboveEditor", 80), ["[surface] broken: render failed (boom)", "ok"]);
	const [fallback] = registry.render("aboveEditor", 10);
	assert.equal(fallback?.endsWith("…"), true);
});

test("unregister removes an entry by id and reports whether it existed", () => {
	const registry = createSurfaceRegistry();
	let changes = 0;
	registry.subscribe(() => {
		changes += 1;
	});
	registry.register(entry({ id: "status", placement: "belowEditor", render: () => ["status"] }));

	assert.equal(registry.unregister("missing"), false);
	assert.equal(registry.unregister("status"), true);
	assert.deepEqual(registry.render("belowEditor", 80), []);
	assert.equal(changes, 2);
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
