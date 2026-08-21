#!/usr/bin/env python3
"""Remove Pi's forced spacer before renderShell="self" tool output."""

from __future__ import annotations

import glob
import os
import shutil
import sys
from pathlib import Path

SPACED = """            if (contentLines.length > 0) {
                lines.push("");
                lines.push(...contentLines);
            }"""

COMPACT = """            if (contentLines.length > 0) {
                if (this.rendererState.compactSpacing !== true) {
                    lines.push("");
                }
                lines.push(...contentLines);
            }"""

UNSCOPED_COMPACT = """            if (contentLines.length > 0) {
                // compact-tools: self-rendered tools own their spacing
                lines.push(...contentLines);
            }"""

LEGACY_COMPACT = """            if (contentLines.length > 0) {
                // compact-tools: no spacer between self-rendered tool calls
                lines.push(...contentLines);
            }"""

# Undo the first implementation if it was applied before this safer patch.
LEGACY_CALL_PATCH = """            const skipCollapsedCall = this.getRenderShell() === "self" && Boolean(this.result) && !this.expanded && !this.isPartial;
            const callRenderer = skipCollapsedCall ? null : this.getCallRenderer();
            if (skipCollapsedCall) {
                // compact-tools: collapsed completed self tools render result only
            }
            else if (!callRenderer) {
                renderContainer.addChild(this.createCallFallback());
                hasContent = true;
            }"""

ORIGINAL_CALL_RENDERER = """            const callRenderer = this.getCallRenderer();
            if (!callRenderer) {
                renderContainer.addChild(this.createCallFallback());
                hasContent = true;
            }"""


def patch_source(source: str) -> tuple[str, list[str]]:
    applied: list[str] = []
    updated = source

    if LEGACY_CALL_PATCH in updated:
        updated = updated.replace(LEGACY_CALL_PATCH, ORIGINAL_CALL_RENDERER, 1)
        applied.append("remove-legacy-call-patch")

    for legacy_spacing in (UNSCOPED_COMPACT, LEGACY_COMPACT):
        if legacy_spacing in updated:
            updated = updated.replace(legacy_spacing, COMPACT, 1)
            applied.append("scope-spacing-patch")
            break

    if COMPACT not in updated:
        if SPACED not in updated:
            raise ValueError("self-render spacer snippet not found")
        updated = updated.replace(SPACED, COMPACT, 1)
        applied.append("self-render-spacing")

    return updated, applied


def candidate_files() -> list[Path]:
    files: list[Path] = []
    pi = shutil.which("pi")
    if pi:
        linked = Path(pi).resolve().parent / "modes/interactive/components/tool-execution.js"
        if linked.is_file():
            files.append(linked)

    pattern = str(
        Path.home()
        / ".local/share/pnpm/global/**/pi-coding-agent/dist/modes/interactive/components/tool-execution.js"
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
        sample = SPACED + "\n" + ORIGINAL_CALL_RENDERER
        updated, applied = patch_source(sample)
        if applied != ["self-render-spacing"] or COMPACT not in updated:
            print("self-test failed: spacer patch missing", file=sys.stderr)
            return 1
        if patch_source(updated) != (updated, []):
            print("self-test failed: patch is not idempotent", file=sys.stderr)
            return 1
        print("self-test ok")
        return 0

    files = candidate_files()
    if not files:
        print("pi-coding-agent tool-execution.js introuvable — patch ignoré")
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
