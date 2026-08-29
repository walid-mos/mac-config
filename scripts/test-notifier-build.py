#!/usr/bin/env python3
"""Exercise Pi.app input invalidation entirely inside a temporary directory."""

from __future__ import annotations

import os
import plistlib
import shutil
import stat
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BUILDER = ROOT / "scripts" / "build-notifier-app.sh"
SWIFT = ROOT / "scripts" / "notifier" / "pi-notify.swift"


def executable(path: Path, content: str) -> None:
    path.write_text(content, encoding="utf-8")
    path.chmod(path.stat().st_mode | stat.S_IXUSR)


def compile_count(log: Path) -> int:
    return sum(line.startswith("swiftc ") for line in log.read_text(encoding="utf-8").splitlines())


def run(builder: Path, environment: dict[str, str]) -> None:
    subprocess.run([str(builder)], check=True, env=environment, capture_output=True, text=True)


def main() -> int:
    with tempfile.TemporaryDirectory(prefix="pi-notifier-build-test-") as temporary:
        root = Path(temporary)
        source_app = root / "terminal-notifier.app"
        source_macos = source_app / "Contents" / "MacOS"
        source_resources = source_app / "Contents" / "Resources"
        source_macos.mkdir(parents=True)
        source_resources.mkdir(parents=True)
        executable(source_macos / "terminal-notifier", "#!/bin/sh\nexit 0\n")
        (source_resources / "source-resource.txt").write_text("one\n", encoding="utf-8")
        with (source_app / "Contents" / "Info.plist").open("wb") as plist:
            plistlib.dump(
                {
                    "CFBundleName": "terminal-notifier",
                    "CFBundleDisplayName": "terminal-notifier",
                    "CFBundleExecutable": "terminal-notifier",
                    "CFBundleIdentifier": "nl.superalloy.terminal-notifier",
                    "CFBundleIconFile": "Terminal",
                },
                plist,
            )

        swift = root / "pi-notify.swift"
        shutil.copy2(SWIFT, swift)
        icon = root / "Ghostty.icns"
        icon.write_bytes(b"icon-one")
        destination = root / "Applications" / "Pi.app"
        builder = root / "build-notifier-app.sh"
        shutil.copy2(BUILDER, builder)
        builder.chmod(builder.stat().st_mode | stat.S_IXUSR)

        log = root / "commands.log"
        log.write_text("", encoding="utf-8")
        fake_swiftc = root / "fake-swiftc"
        executable(
            fake_swiftc,
            """#!/usr/bin/env python3
import os, pathlib, sys
log = pathlib.Path(os.environ["BUILD_TEST_LOG"])
with log.open("a") as stream: stream.write("swiftc " + " ".join(sys.argv[1:]) + "\\n")
out = pathlib.Path(sys.argv[sys.argv.index("-o") + 1])
out.write_text("compiled\\n")
out.chmod(0o755)
""",
        )
        fake_codesign = root / "fake-codesign"
        fake_lsregister = root / "fake-lsregister"
        executable(fake_codesign, "#!/bin/sh\necho codesign \"$@\" >> \"$BUILD_TEST_LOG\"\n")
        executable(fake_lsregister, "#!/bin/sh\necho lsregister \"$@\" >> \"$BUILD_TEST_LOG\"\n")

        environment = os.environ | {
            "NOTIFIER_APP_SOURCE": str(source_app),
            "NOTIFIER_APP_DEST": str(destination),
            "PI_NOTIFY_SWIFT_SOURCE": str(swift),
            "NOTIFIER_ICON_SOURCE": str(icon),
            "SWIFTC": str(fake_swiftc),
            "CODESIGN": str(fake_codesign),
            "LSREGISTER": str(fake_lsregister),
            "BUILD_TEST_LOG": str(log),
        }

        run(builder, environment)
        assert compile_count(log) == 1
        run(builder, environment)
        assert compile_count(log) == 1, "unchanged installation must be a no-op"

        for path in (builder, swift, icon, source_app / "Contents" / "Info.plist"):
            os.utime(path, None)
        run(builder, environment)
        assert compile_count(log) == 1, "mtime-only changes must not invalidate"

        swift.write_text(swift.read_text(encoding="utf-8") + "\n// test input\n", encoding="utf-8")
        run(builder, environment)
        assert compile_count(log) == 2, "Swift changes must invalidate"

        (source_resources / "source-resource.txt").write_text("two\n", encoding="utf-8")
        run(builder, environment)
        assert compile_count(log) == 3, "bundle resource changes must invalidate"

        with (source_app / "Contents" / "Info.plist").open("rb") as stream:
            source_plist = plistlib.load(stream)
        source_plist["FixtureRevision"] = 2
        with (source_app / "Contents" / "Info.plist").open("wb") as stream:
            plistlib.dump(source_plist, stream)
        run(builder, environment)
        assert compile_count(log) == 4, "source Info.plist changes must invalidate"

        icon.write_bytes(b"icon-two")
        run(builder, environment)
        assert compile_count(log) == 5, "icon changes must invalidate"

        builder.write_text(builder.read_text(encoding="utf-8") + "\n# build logic revision\n", encoding="utf-8")
        run(builder, environment)
        assert compile_count(log) == 6, "build logic changes must invalidate"

        (destination / "Contents" / "MacOS" / "pi-notify").unlink()
        run(builder, environment)
        assert compile_count(log) == 7, "a non-conforming installation must rebuild"

        with (destination / "Contents" / "Info.plist").open("rb") as stream:
            installed = plistlib.load(stream)
        assert installed["CFBundleName"] == "Pi"
        assert installed["CFBundleDisplayName"] == "Pi"
        assert installed["CFBundleExecutable"] == "pi-notify"
        assert installed["CFBundleIdentifier"] == "app.pi.notifier"
        assert (destination / "Contents" / "Resources" / "pi-notify-input.sha256").is_file()
        assert str(destination).startswith(str(root)), "test must never touch /Applications"

    print("notifier build test passed: deterministic inputs invalidate only when content changes.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
