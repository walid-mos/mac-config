#!/usr/bin/env python3
"""Persist Pi editor prompt history separately for each working directory."""

from __future__ import annotations

import glob
import os
import shutil
import sys
from pathlib import Path

IMPORTS = '''import { createHash } from "node:crypto";
import { appendFileSync, chmodSync, mkdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
'''

HISTORY_HELPERS = '''const PROMPT_HISTORY_LIMIT = 100;
function promptHistoryPath() {
    const directoryHash = createHash("sha256").update(process.cwd()).digest("hex");
    return join(homedir(), ".pi", "agent", "prompt-history", `${directoryHash}.jsonl`);
}
function loadPromptHistory() {
    try {
        return readFileSync(promptHistoryPath(), "utf8")
            .trimEnd()
            .split("\\n")
            .reverse()
            .flatMap((line) => {
            try {
                const entry = JSON.parse(line);
                return typeof entry === "string" && entry.trim() ? [entry] : [];
            }
            catch {
                return [];
            }
        })
            .slice(0, PROMPT_HISTORY_LIMIT);
    }
    catch {
        return [];
    }
}
function savePromptHistory(prompt) {
    try {
        const path = promptHistoryPath();
        mkdirSync(dirname(path), { recursive: true, mode: 0o700 });
        appendFileSync(path, `${JSON.stringify(prompt)}\\n`, { encoding: "utf8", mode: 0o600 });
        chmodSync(path, 0o600);
    }
    catch {
        // A history write must never prevent a submitted prompt from running.
    }
}
'''

LEGACY_IMPORTS = '''import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
'''

LEGACY_HISTORY_HELPERS = '''const PROMPT_HISTORY_LIMIT = 100;
function promptHistoryPath() {
    const directoryHash = createHash("sha256").update(process.cwd()).digest("hex");
    return join(homedir(), ".pi", "agent", "prompt-history", `${directoryHash}.json`);
}
function loadPromptHistory() {
    try {
        const parsed = JSON.parse(readFileSync(promptHistoryPath(), "utf8"));
        return Array.isArray(parsed) ? parsed.filter((entry) => typeof entry === "string" && entry.trim()).slice(0, PROMPT_HISTORY_LIMIT) : [];
    }
    catch {
        return [];
    }
}
function savePromptHistory(history) {
    try {
        const path = promptHistoryPath();
        mkdirSync(dirname(path), { recursive: true });
        const temporaryPath = `${path}.${process.pid}.tmp`;
        writeFileSync(temporaryPath, JSON.stringify(history), "utf8");
        renameSync(temporaryPath, path);
    }
    catch {
        // A history write must never prevent a submitted prompt from running.
    }
}
'''

IMPORT_MARKER = 'import { getKeybindings } from "../keybindings.js";\n'
HELPER_MARKER = 'const graphemeSegmenter = getGraphemeSegmenter();\n'
HISTORY_FIELD = '    history = [];\n'
PERSISTED_HISTORY_FIELD = '    history = loadPromptHistory();\n'
HISTORY_LIMIT = '''        if (this.history.length > 100) {
            this.history.pop();
        }'''
PERSISTED_HISTORY_LIMIT = '''        if (this.history.length > PROMPT_HISTORY_LIMIT) {
            this.history.pop();
        }
        savePromptHistory(trimmed);'''
LEGACY_PERSISTED_HISTORY_LIMIT = '''        if (this.history.length > PROMPT_HISTORY_LIMIT) {
            this.history.pop();
        }
        savePromptHistory(this.history);'''


def patch_source(source: str) -> tuple[str, list[str]]:
    applied: list[str] = []
    updated = source

    if IMPORTS not in updated:
        if LEGACY_IMPORTS in updated:
            updated = updated.replace(LEGACY_IMPORTS, IMPORTS, 1)
        elif IMPORT_MARKER in updated:
            updated = updated.replace(IMPORT_MARKER, IMPORTS + IMPORT_MARKER, 1)
        else:
            raise ValueError("editor import marker not found")
        applied.append("imports")

    if HISTORY_HELPERS not in updated:
        if LEGACY_HISTORY_HELPERS in updated:
            updated = updated.replace(LEGACY_HISTORY_HELPERS, HISTORY_HELPERS, 1)
        elif HELPER_MARKER in updated:
            updated = updated.replace(HELPER_MARKER, HISTORY_HELPERS + HELPER_MARKER, 1)
        else:
            raise ValueError("editor helper marker not found")
        applied.append("history-helpers")

    if PERSISTED_HISTORY_FIELD not in updated:
        if HISTORY_FIELD not in updated:
            raise ValueError("editor history field not found")
        updated = updated.replace(HISTORY_FIELD, PERSISTED_HISTORY_FIELD, 1)
        applied.append("history-load")

    if PERSISTED_HISTORY_LIMIT not in updated:
        if LEGACY_PERSISTED_HISTORY_LIMIT in updated:
            updated = updated.replace(LEGACY_PERSISTED_HISTORY_LIMIT, PERSISTED_HISTORY_LIMIT, 1)
        elif HISTORY_LIMIT in updated:
            updated = updated.replace(HISTORY_LIMIT, PERSISTED_HISTORY_LIMIT, 1)
        else:
            raise ValueError("editor history limit not found")
        applied.append("history-save")

    return updated, applied


def candidate_files() -> list[Path]:
    files: list[Path] = []
    pi = shutil.which("pi")
    if pi:
        package_root = Path(pi).resolve().parent.parent
        linked = package_root / "node_modules/@earendil-works/pi-tui/dist/components/editor.js"
        if linked.is_file():
            files.append(linked)

    patterns = (
        Path.home() / ".local/share/pnpm/global/**/pi-tui/dist/components/editor.js",
        Path.home()
        / ".local/share/pnpm/global/**/node_modules/.pnpm/node_modules/@earendil-works/pi-tui/dist/components/editor.js",
    )
    for pattern in patterns:
        files.extend(Path(match) for match in glob.glob(str(pattern), recursive=True))

    unique: list[Path] = []
    seen: set[str] = set()
    for path in files:
        key = str(path.resolve())
        if key not in seen:
            seen.add(key)
            unique.append(path)
    return unique


def patch_file(path: Path) -> str:
    original = path.read_text(encoding="utf-8")
    updated, applied = patch_source(original)
    if not applied:
        return f"already patched: {path}"
    path.write_text(updated, encoding="utf-8")
    return f"patched ({', '.join(applied)}): {path}"


def main() -> int:
    if os.environ.get("PI_PATCH_SELF_TEST") == "1":
        sample = IMPORT_MARKER + HELPER_MARKER + HISTORY_FIELD + HISTORY_LIMIT
        updated, applied = patch_source(sample)
        if applied != ["imports", "history-helpers", "history-load", "history-save"]:
            print(f"self-test failed: {applied}", file=sys.stderr)
            return 1
        if patch_source(updated) != (updated, []):
            print("self-test failed: patch is not idempotent", file=sys.stderr)
            return 1
        print("self-test ok")
        return 0

    files = candidate_files()
    if not files:
        print("pi-tui editor.js introuvable — patch ignoré")
        return 0

    failed = False
    for path in files:
        try:
            print(patch_file(path))
        except ValueError as error:
            failed = True
            print(f"échec {path}: {error}", file=sys.stderr)
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
