import assert from "node:assert/strict";
import test from "node:test";
import {
	createSurfaceRegistry,
	DEFAULT_SURFACE_PREFERENCES,
	nextSurfacePreferences,
	resolveSurfaceDensity,
	type SurfacePreferences,
} from "../extensions/ui/surface.ts";
import {
	parseSurfaceSettings,
	persistSurfaceSettings,
	projectSurfaceIntoSettings,
	type PersistFileOps,
} from "../extensions/settings/surface.ts";

function preferences(
	mode: SurfacePreferences["mode"],
	preset: SurfacePreferences["preset"],
): SurfacePreferences {
	return { version: 1, mode, preset };
}

test("resolves compact/default/full modes around active work", () => {
	assert.equal(resolveSurfaceDensity(DEFAULT_SURFACE_PREFERENCES, false), "compact");
	assert.equal(resolveSurfaceDensity(DEFAULT_SURFACE_PREFERENCES, true), "detailed");
	assert.equal(resolveSurfaceDensity(preferences("manual", "compact"), true), "compact");
	assert.equal(resolveSurfaceDensity(preferences("manual", "default"), false), "detailed");
	assert.equal(resolveSurfaceDensity(preferences("manual", "full"), false), "detailed");
});

test("cycles manual presets and returns to automatic mode", () => {
	assert.deepEqual(nextSurfacePreferences(DEFAULT_SURFACE_PREFERENCES), preferences("manual", "compact"));
	assert.deepEqual(nextSurfacePreferences(preferences("manual", "compact")), preferences("manual", "default"));
	assert.deepEqual(nextSurfacePreferences(preferences("manual", "default")), preferences("manual", "full"));
	assert.deepEqual(nextSurfacePreferences(preferences("manual", "full")), DEFAULT_SURFACE_PREFERENCES);
});

test("renders targets in priority order with bounded single lines", () => {
	const registry = createSurfaceRegistry();
	const observed: string[] = [];
	registry.register({
		id: "later",
		placement: "aboveEditor",
		priority: 2,
		active: true,
		render: ({ density, preset }) => {
			observed.push(`${density}:${preset}`);
			return ["second\nignored"];
		},
	});
	registry.register({
		id: "first",
		placement: "aboveEditor",
		priority: 1,
		render: () => ["first line is longer"],
	});
	registry.register({ id: "footer", placement: "footer", render: () => ["footer"] });

	assert.deepEqual(registry.render("aboveEditor", 8), ["first l…", "second"]);
	assert.deepEqual(observed, ["detailed:default"]);
	assert.deepEqual(registry.render("footer", 80), ["footer"]);
});

test("default keeps a summary plus one detail while full keeps every detail", () => {
	const registry = createSurfaceRegistry();
	registry.register({
		id: "details",
		placement: "aboveEditor",
		render: () => ["summary", "detail", "full detail"],
	});

	assert.deepEqual(registry.render("aboveEditor", 80), ["summary"]);
	assert.deepEqual(registry.render("aboveEditor", 80, undefined, preferences("manual", "default")), ["summary", "detail"]);
	assert.deepEqual(registry.render("aboveEditor", 80, undefined, preferences("manual", "full")), ["summary", "detail", "full detail"]);
});

test("truncates ANSI-colored lines without exposing escape fragments", () => {
	const registry = createSurfaceRegistry();
	registry.register({
		id: "colored",
		placement: "aboveEditor",
		render: () => ["\u001b[31mabcdef\u001b[0m"],
	});

	const [line] = registry.render("aboveEditor", 4);
	assert.equal(line?.includes("\u001b[31m"), true);
	assert.equal(line?.includes("\u001b[0m"), true);
	assert.equal(line?.includes("\u001b[3"), true);
});

test("replaces duplicate ids and makes stale/repeated unsubscriptions harmless", () => {
	const registry = createSurfaceRegistry();
	const removeFirst = registry.register({
		id: "status",
		placement: "footer",
		render: () => ["first"],
	});
	const removeReplacement = registry.register({
		id: "status",
		placement: "aboveEditor",
		render: () => ["replacement"],
	});

	removeFirst();
	assert.deepEqual(registry.render("aboveEditor", 80), ["replacement"]);
	removeReplacement();
	removeReplacement();
	assert.deepEqual(registry.render("aboveEditor", 80), []);
});

test("validates surface settings and projects without dropping unrelated values", () => {
	assert.deepEqual(parseSurfaceSettings(undefined), { ok: true, value: DEFAULT_SURFACE_PREFERENCES });
	assert.deepEqual(parseSurfaceSettings({ version: 1, mode: "manual", preset: "full" }), {
		ok: true,
		value: preferences("manual", "full"),
	});
	assert.equal(parseSurfaceSettings({ version: 2, mode: "auto", preset: "default" }).ok, false);
	assert.equal(parseSurfaceSettings({ mode: "wide", preset: "default" }).ok, false);
	assert.equal(parseSurfaceSettings([]).ok, false);

});

test("projects a valid preset without dropping existing surface extensions", () => {
	const projected = projectSurfaceIntoSettings(
		{ theme: "catppuccin-latte", surface: { future: true } },
		preferences("manual", "full"),
	);
	assert.equal(projected.ok, true);
	if (!projected.ok) return;
	assert.deepEqual(projected.settings, {
		theme: "catppuccin-latte",
		surface: { future: true, version: 1, mode: "manual", preset: "full" },
	});
});

test("persists surface settings through a symlink-safe file operation boundary", () => {
	const files = new Map([["settings.json", JSON.stringify({ theme: "latte" })]]);
	const ops: PersistFileOps = {
		exists: (path) => files.has(path),
		mkdir: () => {},
		readFile: (path) => {
			const body = files.get(path);
			if (body === undefined) throw new Error(`missing ${path}`);
			return body;
		},
		rename: (from, to) => {
			const body = files.get(from);
			if (body === undefined) throw new Error(`missing ${from}`);
			files.set(to, body);
			files.delete(from);
		},
		resolve: (path) => path,
		unlink: (path) => {
			files.delete(path);
		},
		writeFile: (path, body) => {
			files.set(path, body);
		},
	};

	assert.deepEqual(persistSurfaceSettings("settings.json", preferences("manual", "full"), ops), { ok: true });
	assert.deepEqual(JSON.parse(files.get("settings.json") ?? "{}"), {
		theme: "latte",
		surface: { version: 1, mode: "manual", preset: "full" },
	});
});
