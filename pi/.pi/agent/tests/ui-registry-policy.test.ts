import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const TEST_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const EXTENSIONS_DIRECTORY = resolve(TEST_DIRECTORY, "../extensions");

async function typescriptFiles(directory: string): Promise<string[]> {
	const entries = await readdir(directory, { withFileTypes: true });
	const nested = await Promise.all(entries.map(async (entry) => {
		const path = resolve(directory, entry.name);
		if (entry.isDirectory()) return typescriptFiles(path);
		return entry.isFile() && entry.name.endsWith(".ts") ? [path] : [];
	}));
	return nested.flat();
}

async function filesCalling(method: "setWidget" | "setFooter"): Promise<string[]> {
	const matches: string[] = [];
	for (const path of await typescriptFiles(EXTENSIONS_DIRECTORY)) {
		const source = await readFile(path, "utf8");
		if (source.includes(`.${method}(`)) {
			matches.push(relative(EXTENSIONS_DIRECTORY, path));
		}
	}
	return matches.sort();
}

test("widgets and footer can only be mounted by their central hosts", async () => {
	assert.deepEqual(await filesCalling("setWidget"), ["ui/ordered-widget-stack.ts"]);
	assert.deepEqual(await filesCalling("setFooter"), ["footer/runtime.ts"]);
});
