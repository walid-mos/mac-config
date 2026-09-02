"""Run repository Node tests against the dependencies of the installed Pi."""

from __future__ import annotations

import fcntl
import hashlib
import re
import shutil
import subprocess
import sys
import tempfile
from collections.abc import Iterable
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
NODE_MODULES = REPOSITORY_ROOT / "node_modules"
LOCK_PATH = Path(tempfile.gettempdir()) / (
    "pi-node-tests-"
    f"{hashlib.sha256(str(REPOSITORY_ROOT).encode()).hexdigest()[:16]}.lock"
)
SHIM_TARGET = re.compile(r"^# cmd-shim-target=(.+)$", re.MULTILINE)
REQUIRED_PACKAGES = (
    "@earendil-works/pi-ai",
    "@earendil-works/pi-coding-agent",
    "@earendil-works/pi-tui",
    "typebox",
)


def package_from_cli(target: Path) -> Path:
    if (
        target.name != "cli.js"
        or target.parent.name != "bundle"
        or target.parent.parent.name != "dist"
    ):
        raise RuntimeError(f"unexpected Pi CLI target: {target}")
    return target.parents[2]


def installed_pi_node_modules() -> Path:
    executable = shutil.which("pi")
    if executable is None:
        raise RuntimeError("pi is required for Node tests")
    path = Path(executable)
    resolved = path.resolve()
    if resolved.name == "cli.js":
        package = package_from_cli(resolved)
    else:
        contents = path.read_text(encoding="utf-8", errors="replace")
        match = SHIM_TARGET.search(contents)
        if match is None:
            raise RuntimeError(f"cannot locate the installed Pi package from {path}")
        package = package_from_cli(Path(match.group(1)).expanduser().resolve())
    dependencies = package.parent.parent
    missing = [name for name in REQUIRED_PACKAGES if not (dependencies / name).exists()]
    if missing:
        raise RuntimeError(
            f"installed Pi dependency tree is incomplete: {', '.join(missing)}"
        )
    return dependencies


def matching_tests(patterns: Iterable[str]) -> list[str]:
    tests_directory = REPOSITORY_ROOT / "pi/.pi/agent/tests"
    return sorted(
        {
            str(path.relative_to(REPOSITORY_ROOT))
            for pattern in patterns
            for path in tests_directory.glob(pattern)
        }
    )


def run_node_tests(suite: str, patterns: Iterable[str]) -> int:
    with LOCK_PATH.open("w", encoding="utf-8") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if NODE_MODULES.exists() or NODE_MODULES.is_symlink():
            print(
                f"refusing to replace existing test path: {NODE_MODULES}",
                file=sys.stderr,
            )
            return 1
        tests = matching_tests(patterns)
        if not tests:
            print(f"{suite} tests failed: no tests matched", file=sys.stderr)
            return 1
        try:
            NODE_MODULES.symlink_to(
                installed_pi_node_modules(), target_is_directory=True
            )
            return subprocess.run(
                ["node", "--test", *tests],
                cwd=REPOSITORY_ROOT,
                check=False,
            ).returncode
        except (OSError, RuntimeError) as error:
            print(f"{suite} tests failed: {error}", file=sys.stderr)
            return 1
        finally:
            if NODE_MODULES.is_symlink():
                NODE_MODULES.unlink()
