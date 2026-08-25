import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { defaultPersistFileOps, defaultSettingsPath } from "../settings/surface.ts";
import {
	loadSurfaceSettings,
	persistSurfaceSettings,
} from "../settings/surface.ts";
import {
	DEFAULT_SURFACE_PREFERENCES,
	getSurfacePreferences,
	nextSurfacePreferences,
	setSurfacePreferences,
	type SurfacePreferences,
	type SurfacePreset,
} from "../ui/surface.ts";

const COMMANDS: readonly string[] = ["auto", "compact", "default", "full", "toggle"];

export default function surfaceExtension(pi: ExtensionAPI): void {
	const settingsPath = defaultSettingsPath();
	let preferences = DEFAULT_SURFACE_PREFERENCES;

	function applyPreferences(next: SurfacePreferences, ctx: ExtensionContext, notice = true): void {
		const persisted = persistSurfaceSettings(settingsPath, next, defaultPersistFileOps);
		if (!persisted.ok) {
			ctx.ui.notify(persisted.reason, "error");
			return;
		}
		preferences = next;
		setSurfacePreferences(preferences);
		if (notice) ctx.ui.notify(`Surface: ${describePreferences(preferences)}`, "info");
	}

	function toggle(ctx: ExtensionContext): void {
		applyPreferences(nextSurfacePreferences(preferences), ctx);
	}

	pi.on("session_start", async (_event, ctx) => {
		const loaded = loadSurfaceSettings(settingsPath, defaultPersistFileOps);
		if (!loaded.ok) {
			ctx.ui.notify(`${loaded.reason} Using automatic surface mode.`, "warning");
			preferences = DEFAULT_SURFACE_PREFERENCES;
		} else {
			preferences = loaded.value;
		}
		setSurfacePreferences(preferences);
	});

	pi.registerCommand("surface", {
		description: "Show or change the unified surface preset",
		getArgumentCompletions: (prefix: string) => {
			const hits = COMMANDS.filter((command) => command.startsWith(prefix));
			return hits.length === 0 ? null : hits.map((value) => ({ value, label: value }));
		},
		handler: async (args, ctx) => {
			const command = args.trim().toLowerCase();
			if (command.length === 0) {
				ctx.ui.notify(`Surface: ${describePreferences(preferences)}`, "info");
				return;
			}
			if (command === "toggle") {
				toggle(ctx);
				return;
			}
			if (command === "auto") {
				applyPreferences({ version: 1, mode: "auto", preset: "default" }, ctx);
				return;
			}
			if (!isSurfacePresetCommand(command)) {
				ctx.ui.notify("Usage: /surface [auto|compact|default|full|toggle]", "error");
				return;
			}
			applyPreferences({ version: 1, mode: "manual", preset: command }, ctx);
		},
	});

	pi.registerShortcut("alt+s", {
		description: "Cycle unified surface presets",
		handler: async (ctx) => toggle(ctx),
	});
}

function isSurfacePresetCommand(value: string): value is SurfacePreset {
	return value === "compact" || value === "default" || value === "full";
}

function describePreferences(preferences: SurfacePreferences): string {
	if (preferences.mode === "auto") return "auto (compact at rest, detailed while active)";
	return `${preferences.preset} (manual)`;
}
