import { dirname } from "node:path";
import {
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
export type PersistFileOps = {
	exists: (path: string) => boolean;
	mkdir: (path: string) => void;
	readFile: (path: string) => string;
	rename: (from: string, to: string) => void;
	resolve: (path: string) => string;
	unlink: (path: string) => void;
	writeFile: (path: string, body: string) => void;
};

export const defaultPersistFileOps: PersistFileOps = {
	exists: existsSync,
	mkdir: (path) => mkdirSync(path, { recursive: true }),
	readFile: (path) => readFileSync(path, "utf8"),
	rename: renameSync,
	resolve: resolveWritablePath,
	unlink: unlinkSync,
	writeFile: (path, body) => writeFileSync(path, body),
};

export function resolveWritablePath(path: string): string {
	if (!isSymlink(path)) return path;
	try {
		return realpathSync(path);
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : "unresolvable";
		throw new Error(`Could not resolve symlink ${path}: ${message}`);
	}
}

export function defaultAgentDir(): string {
	return process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");
}

export function defaultSettingsPath(): string {
	return join(defaultAgentDir(), "settings.json");
}

export function loadSettingsObject(
	path: string,
	ops: PersistFileOps = defaultPersistFileOps,
): { ok: true; value: Record<string, unknown> } | { ok: false; reason: string } {
	try {
		const parsed: unknown = JSON.parse(ops.readFile(path));
		if (!isRecord(parsed)) return { ok: false, reason: "settings.json must be a JSON object." };
		return { ok: true, value: parsed };
	} catch (error: unknown) {
		if (error instanceof SyntaxError) {
			return { ok: false, reason: "settings.json is not valid JSON." };
		}
		return { ok: false, reason: "Could not read settings.json." };
	}
}

function isSymlink(path: string): boolean {
	try {
		return lstatSync(path).isSymbolicLink();
	} catch {
		return false;
	}
}

import {
	DEFAULT_SURFACE_PREFERENCES,
	isSurfaceMode,
	isSurfacePreset,
	type SurfaceMode,
	type SurfacePreferences,
	type SurfacePreset,
} from "../ui/surface.ts";

export type { PersistFileOps };

export type SurfaceSettingsParseResult =
	| { ok: true; value: SurfacePreferences }
	| { ok: false; reason: string };

export type SurfaceSettingsProjectionResult =
	| { ok: true; settings: Record<string, unknown> }
	| { ok: false; reason: string };

export function parseSurfaceSettings(value: unknown): SurfaceSettingsParseResult {
	if (value === undefined) return { ok: true, value: DEFAULT_SURFACE_PREFERENCES };
	if (!isRecord(value)) return { ok: false, reason: "settings.surface must be an object." };
	if (value.version !== undefined && value.version !== 1) {
		return { ok: false, reason: "settings.surface.version must be 1." };
	}
	const mode = value.mode ?? DEFAULT_SURFACE_PREFERENCES.mode;
	const preset = value.preset ?? DEFAULT_SURFACE_PREFERENCES.preset;
	if (!isSurfaceMode(mode)) {
		return { ok: false, reason: "settings.surface.mode must be auto or manual." };
	}
	if (!isSurfacePreset(preset)) {
		return { ok: false, reason: "settings.surface.preset must be compact, default, or full." };
	}
	return { ok: true, value: { version: 1, mode, preset } };
}

export function loadSurfaceSettings(
	path: string,
	ops: PersistFileOps = defaultPersistFileOps,
): SurfaceSettingsParseResult {
	const loaded = loadSettingsObject(path, ops);
	if (!loaded.ok) return loaded;
	return parseSurfaceSettings(loaded.value.surface);
}

export function projectSurfaceIntoSettings(
	settings: unknown,
	surface: SurfacePreferences,
): SurfaceSettingsProjectionResult {
	if (!isRecord(settings)) return { ok: false, reason: "settings.json must be a JSON object." };
	const currentSurface = isRecord(settings.surface) ? settings.surface : {};
	return {
		ok: true,
		settings: {
			...settings,
			surface: {
				...currentSurface,
				version: 1,
				mode: surface.mode,
				preset: surface.preset,
			},
		},
	};
}

export function persistSurfaceSettings(
	path: string,
	surface: SurfacePreferences,
	ops: PersistFileOps = defaultPersistFileOps,
): { ok: true } | { ok: false; reason: string } {
	const loaded = loadSettingsObject(path, ops);
	if (!loaded.ok) return loaded;
	const projected = projectSurfaceIntoSettings(loaded.value, surface);
	if (!projected.ok) return projected;
	try {
		const target = ops.resolve(path);
		const temporary = `${target}.surface.tmp`;
		ops.mkdir(dirname(target));
		ops.writeFile(temporary, `${JSON.stringify(projected.settings, null, 2)}\n`);
		ops.rename(temporary, target);
		return { ok: true };
	} catch (error: unknown) {
		const message = error instanceof Error ? error.message : "write failed";
		return { ok: false, reason: `Could not persist surface settings: ${message}` };
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
