#!/usr/bin/env python3
"""Validate an isolated Stow deployment can start Pi with repository resources."""

from __future__ import annotations

import fcntl
import json
import os
import pty
import re
import select
import shutil
import signal
import struct
import subprocess
import sys
import tempfile
import termios
import time
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
STARTUP_DIAGNOSTICS = (
    "failed to load extension",
    "failed to load skill",
    "failed to load agent instructions",
    "error loading extension",
    "error loading skill",
    "does not export a valid factory function",
    "does not export a valid extension factory",
    "[extension issues]",
)
ANSI_ESCAPE = re.compile(rb"\x1b\[[0-?]*[ -/]*[@-~]")


def require_command(name: str) -> str:
    command = shutil.which(name)
    if command is None:
        raise RuntimeError(f"{name} is required for pi-test but was not found in PATH")
    return command


def validate_runtime_skill_migration(home: Path, make: str) -> None:
    agent = home / ".pi" / "agent"
    legacy_skill = agent / "skills" / "crit" / "SKILL.md"
    external_skill = agent / "external" / "skills" / "crit" / "SKILL.md"
    legacy_skill.parent.mkdir(parents=True)
    legacy_skill.write_text("legacy-crit\n", encoding="utf-8")
    command = [make, "--no-print-directory", "pi-dirs", f"HOME={home}"]
    subprocess.run(command, cwd=REPOSITORY_ROOT, check=True)
    subprocess.run(command, cwd=REPOSITORY_ROOT, check=True)
    if legacy_skill.exists() or external_skill.read_text(encoding="utf-8") != "legacy-crit\n":
        raise RuntimeError("pi-dirs did not migrate the legacy Crit skill idempotently")

    conflicting_legacy = agent / "skills" / "crit-cli" / "SKILL.md"
    conflicting_external = agent / "external" / "skills" / "crit-cli" / "SKILL.md"
    conflicting_legacy.parent.mkdir(parents=True)
    conflicting_external.parent.mkdir(parents=True)
    conflicting_legacy.write_text("legacy-copy\n", encoding="utf-8")
    conflicting_external.write_text("external-copy\n", encoding="utf-8")
    collision = subprocess.run(command, cwd=REPOSITORY_ROOT, capture_output=True, text=True)
    if collision.returncode == 0:
        raise RuntimeError("pi-dirs must refuse an ambiguous Crit skill migration")
    if conflicting_legacy.read_text(encoding="utf-8") != "legacy-copy\n" or conflicting_external.read_text(encoding="utf-8") != "external-copy\n":
        raise RuntimeError("pi-dirs changed files while refusing an ambiguous Crit migration")


def deploy_pi(home: Path, stow: str, make: str) -> None:
    agent = home / ".pi" / "agent"
    external_skills = agent / "external" / "skills"
    for runtime_directory in ("sessions", "npm", "external", "external/skills"):
        (agent / runtime_directory).mkdir(parents=True, exist_ok=True)
    (external_skills / "pi-config-test").mkdir()
    (external_skills / "pi-config-test" / "SKILL.md").write_text(
        "---\nname: pi-config-test\ndescription: Isolated external resource test.\n---\n\n# Test\n",
        encoding="utf-8",
    )
    (agent / "auth.json").write_text('{"sentinel":"auth"}\n', encoding="utf-8")
    (agent / "sessions" / "sentinel.jsonl").write_text("session-sentinel\n", encoding="utf-8")
    (agent / "npm" / "sentinel.txt").write_text("npm-sentinel\n", encoding="utf-8")
    subprocess.run(
        [stow, "-d", str(REPOSITORY_ROOT), "-t", str(home), "--no-folding", "-R", "pi"],
        check=True,
    )
    if (agent / "extensions").is_symlink():
        raise RuntimeError("legacy --no-folding fixture unexpectedly folded extensions")
    command = [make, "--no-print-directory", "pi", f"HOME={home}"]
    subprocess.run(command, cwd=REPOSITORY_ROOT, check=True)
    subprocess.run(command, cwd=REPOSITORY_ROOT, check=True)


def require_expected_layout(home: Path) -> None:
    agent = home / ".pi" / "agent"
    external_skills = agent / "external" / "skills"
    expected_links = (agent / "extensions", agent / "skills")
    runtime_paths = (agent, agent / "sessions", agent / "agents", agent / "npm", agent / "auth.json", external_skills)
    missing_links = [str(path) for path in expected_links if not path.is_symlink()]
    linked_runtime_paths = [str(path) for path in runtime_paths if path.is_symlink()]
    expected_versioned_skill = agent / "skills" / "harness-tuning" / "SKILL.md"
    expected_external_skill = external_skills / "pi-config-test" / "SKILL.md"
    settings = json.loads((agent / "settings.json").read_text(encoding="utf-8"))
    preserved_runtime = {
        agent / "auth.json": '{"sentinel":"auth"}\n',
        agent / "sessions" / "sentinel.jsonl": "session-sentinel\n",
        agent / "npm" / "sentinel.txt": "npm-sentinel\n",
    }
    changed_runtime = [
        str(path)
        for path, expected in preserved_runtime.items()
        if not path.is_file() or path.read_text(encoding="utf-8") != expected
    ]
    if missing_links or linked_runtime_paths or changed_runtime or not expected_versioned_skill.is_file() or not expected_external_skill.is_file() or settings.get("skills") != ["~/.pi/agent/external/skills"]:
        details = []
        if missing_links:
            details.append(f"static Pi directories must be symlinks: {', '.join(missing_links)}")
        if linked_runtime_paths:
            details.append(f"runtime Pi paths must stay local: {', '.join(linked_runtime_paths)}")
        if changed_runtime:
            details.append(f"runtime Pi contents changed during Stow: {', '.join(changed_runtime)}")
        if not expected_versioned_skill.is_file():
            details.append(f"versioned skill missing: {expected_versioned_skill}")
        if not expected_external_skill.is_file():
            details.append(f"external skill missing: {expected_external_skill}")
        if settings.get("skills") != ["~/.pi/agent/external/skills"]:
            details.append("settings.json must load ~/.pi/agent/external/skills")
        raise RuntimeError("; ".join(details))


def drain(fd: int, output: bytearray) -> None:
    # Pi's TUI footer can keep a PTY readable continuously during startup.
    for _ in range(64):
        if not select.select([fd], [], [], 0)[0]:
            return
        try:
            output.extend(os.read(fd, 65_536))
        except OSError:
            return


def start_pi(pi: str, home: Path) -> tuple[int, bytes]:
    pid, fd = pty.fork()
    if pid == 0:
        fcntl.ioctl(0, termios.TIOCSWINSZ, struct.pack("HHHH", 24, 120, 0, 0))
        environment = os.environ | {"HOME": str(home), "PI_OFFLINE": "1"}
        os.chdir(REPOSITORY_ROOT)
        os.execvpe(pi, [pi, "--offline", "--no-session", "--approve"], environment)

    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", 24, 120, 0, 0))
    output = bytearray()
    startup_deadline = time.monotonic() + 2
    while time.monotonic() < startup_deadline:
        drain(fd, output)
        waited, status = os.waitpid(pid, os.WNOHANG)
        if waited:
            os.close(fd)
            return os.waitstatus_to_exitcode(status), bytes(output)
        time.sleep(0.03)

    os.write(fd, b"\x04")
    shutdown_deadline = time.monotonic() + 3
    while time.monotonic() < shutdown_deadline:
        drain(fd, output)
        waited, status = os.waitpid(pid, os.WNOHANG)
        if waited:
            os.close(fd)
            return os.waitstatus_to_exitcode(status), bytes(output)
        time.sleep(0.03)

    os.kill(pid, signal.SIGTERM)
    _, status = os.waitpid(pid, 0)
    drain(fd, output)
    os.close(fd)
    return os.waitstatus_to_exitcode(status), bytes(output)


def validate_startup(pi: str, home: Path) -> None:
    exit_code, output = start_pi(pi, home)
    text = ANSI_ESCAPE.sub(b"", output).decode("utf-8", errors="replace")
    diagnostics = [diagnostic for diagnostic in STARTUP_DIAGNOSTICS if diagnostic in text.lower()]
    if exit_code != 0 or diagnostics:
        print(text[-4_000:], file=sys.stderr)
        failure = f"Pi exited with {exit_code}" if exit_code != 0 else "Pi reported startup diagnostics"
        raise RuntimeError(f"{failure}: {', '.join(diagnostics)}")


def main() -> int:
    try:
        stow = require_command("stow")
        pi = require_command("pi")
        make = require_command("make")
        with tempfile.TemporaryDirectory(prefix="pi-config-test-") as temporary_directory:
            root = Path(temporary_directory)
            migration_home = root / "migration-home"
            migration_home.mkdir()
            validate_runtime_skill_migration(migration_home, make)
            home = root / "home"
            home.mkdir()
            deploy_pi(home, stow, make)
            require_expected_layout(home)
            validate_startup(pi, home)
    except (RuntimeError, subprocess.CalledProcessError) as error:
        print(f"pi-test failed: {error}", file=sys.stderr)
        return 1
    print("pi-test passed: Stow folds static Pi resources and Pi starts offline.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
