#!/usr/bin/env python3
"""Skip empty hidden-thinking labels so they leave no transcript spacer."""

from __future__ import annotations

import glob
import os
import shutil
import sys
from pathlib import Path

VISIBLE = """        const hasVisibleContent = message.content.some((c) => (c.type === "text" && c.text.trim()) || (c.type === "thinking" && c.thinking.trim()));
        if (hasVisibleContent) {
            this.contentContainer.addChild(new Spacer(1));
        }"""

VISIBLE_PATCHED = """        const thinkingVisible = !this.hideThinkingBlock || Boolean(this.hiddenThinkingLabel && this.hiddenThinkingLabel.trim());
        const hasVisibleContent = message.content.some((c) => (c.type === "text" && c.text.trim()) || (c.type === "thinking" && c.thinking.trim() && thinkingVisible));
        if (hasVisibleContent) {
            this.contentContainer.addChild(new Spacer(1));
        }"""

LABEL = """                if (this.hideThinkingBlock) {
                    // Show one static label for each run of thinking blocks when hidden.
                    this.contentContainer.addChild(new Text(theme.italic(theme.fg("thinkingText", this.hiddenThinkingLabel)), this.outputPad, 0));
                }"""

LABEL_PATCHED = """                if (this.hideThinkingBlock) {
                    // compact-thinking: empty hidden labels leave no transcript line
                    if (this.hiddenThinkingLabel && this.hiddenThinkingLabel.trim()) {
                        this.contentContainer.addChild(new Text(theme.italic(theme.fg("thinkingText", this.hiddenThinkingLabel)), this.outputPad, 0));
                    }
                }"""

AFTER = """                const hasVisibleContentAfter = message.content
                    .slice(i + 1)
                    .some((c) => (c.type === "text" && c.text.trim()) || (c.type === "thinking" && c.thinking.trim()));"""

LEGACY_AFTER_PATCHED = """                const hasVisibleContentAfter = message.content
                    .slice(i + 1)
                    .some((c) => (c.type === "text" && c.text.trim()) || (c.type === "thinking" && c.thinking.trim() && thinkingVisible));"""

AFTER_PATCHED = """                const hasVisibleTextBefore = message.content
                    .slice(0, i + 1)
                    .some((c) => c.type === "text" && c.text.trim());
                const hasVisibleContentAfter = message.content
                    .slice(i + 1)
                    .some((c) => (c.type === "text" && c.text.trim()) || (c.type === "thinking" && c.thinking.trim() && thinkingVisible));"""

AFTER_SPACER = """                if (hasVisibleContentAfter) {
                    this.contentContainer.addChild(new Spacer(1));
                }"""

LEGACY_AFTER_SPACER_PATCHED = """                if (thinkingVisible && hasVisibleContentAfter) {
                    this.contentContainer.addChild(new Spacer(1));
                }"""

AFTER_SPACER_PATCHED = """                if ((thinkingVisible || hasVisibleTextBefore) && hasVisibleContentAfter) {
                    this.contentContainer.addChild(new Spacer(1));
                }"""


def patch_source(source: str) -> tuple[str, list[str]]:
    applied: list[str] = []
    updated = source

    if AFTER_PATCHED not in updated and LEGACY_AFTER_PATCHED in updated:
        updated = updated.replace(LEGACY_AFTER_PATCHED, AFTER_PATCHED, 1)
        applied.append("upgrade-after-content")
    if AFTER_SPACER_PATCHED not in updated and LEGACY_AFTER_SPACER_PATCHED in updated:
        updated = updated.replace(LEGACY_AFTER_SPACER_PATCHED, AFTER_SPACER_PATCHED, 1)
        applied.append("upgrade-after-spacer")

    replacements = (
        ("visible-content", VISIBLE, VISIBLE_PATCHED),
        ("empty-label", LABEL, LABEL_PATCHED),
        ("after-content", AFTER, AFTER_PATCHED),
        ("after-spacer", AFTER_SPACER, AFTER_SPACER_PATCHED),
    )
    for name, original, patched in replacements:
        if patched in updated:
            continue
        if original not in updated:
            raise ValueError(f"{name} snippet not found")
        updated = updated.replace(original, patched, 1)
        applied.append(name)
    return updated, applied


def candidate_files() -> list[Path]:
    files: list[Path] = []
    pi = shutil.which("pi")
    if pi:
        linked = Path(pi).resolve().parent / "modes/interactive/components/assistant-message.js"
        if linked.is_file():
            files.append(linked)

    pattern = str(
        Path.home()
        / ".local/share/pnpm/global/**/pi-coding-agent/dist/modes/interactive/components/assistant-message.js"
    )
    files.extend(Path(match) for match in glob.glob(pattern, recursive=True))

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
        sample = VISIBLE + "\n" + AFTER + "\n" + LABEL + "\n" + AFTER_SPACER
        updated, applied = patch_source(sample)
        if applied != ["visible-content", "empty-label", "after-content", "after-spacer"]:
            print(f"self-test failed: {applied}", file=sys.stderr)
            return 1
        if patch_source(updated) != (updated, []):
            print("self-test failed: patch is not idempotent", file=sys.stderr)
            return 1
        print("self-test ok")
        return 0

    files = candidate_files()
    if not files:
        print("pi-coding-agent assistant-message.js introuvable — patch ignoré")
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
