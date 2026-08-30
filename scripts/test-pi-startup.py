#!/usr/bin/env python3
"""Stress Pi startup with input arriving before extensions finish loading."""

from __future__ import annotations

import fcntl
import os
import pty
import select
import shutil
import signal
import struct
import subprocess
import tempfile
import termios
import time
from pathlib import Path

CASES = tuple((width, delay) for delay in (0.0, 0.01, 0.05) for width in (60, 78, 120))
FAILURE_MARKERS = (
    b"uncaughtException",
    b"exceeds terminal width",
    b"Maximum call stack",
    b"Failed to load extension",
    b"Failed to load skill",
    b"does not export a valid factory function",
    b"does not export a valid extension factory",
    b"[Extension issues]",
)
REPOSITORY_ROOT = Path(__file__).resolve().parents[1]


def drain(fd: int, output: bytearray) -> None:
    # Footer polling can keep the PTY perpetually readable; bound each drain pass.
    for _ in range(64):
        if not select.select([fd], [], [], 0)[0]:
            return
        try:
            output.extend(os.read(fd, 65_536))
        except OSError:
            return


def run_case(width: int, delay: float, home: Path) -> tuple[str, bytes]:
    pid, fd = pty.fork()
    if pid == 0:
        fcntl.ioctl(0, termios.TIOCSWINSZ, struct.pack("HHHH", 24, width, 0, 0))
        os.environ["HOME"] = str(home)
        os.environ["PI_OFFLINE"] = "1"
        os.chdir(REPOSITORY_ROOT)
        os.execvp("pi", ["pi", "--approve"])

    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", 24, width, 0, 0))
    time.sleep(delay)
    os.write(fd, b"x")
    output = bytearray()
    deadline = time.monotonic() + 5.0
    terminal_ready = False

    while time.monotonic() < deadline:
        select.select([fd], [], [], 0.03)
        drain(fd, output)
        waited, status = os.waitpid(pid, os.WNOHANG | os.WUNTRACED)
        if waited:
            if os.WIFSTOPPED(status):
                os.kill(pid, signal.SIGCONT)
                os.kill(pid, signal.SIGTERM)
                os.waitpid(pid, 0)
                os.close(fd)
                return "stopped", bytes(output)
            os.close(fd)
            return f"early-exit:{os.waitstatus_to_exitcode(status)}", bytes(output)
        try:
            terminal_ready = not bool(termios.tcgetattr(fd)[3] & termios.ICANON)
        except termios.error:
            terminal_ready = False
        if terminal_ready:
            break

    if not terminal_ready:
        os.kill(pid, signal.SIGTERM)
        _, status = os.waitpid(pid, 0)
        drain(fd, output)
        os.close(fd)
        return f"startup-timeout:{os.waitstatus_to_exitcode(status)}", bytes(output)

    # Clear the injected text, then use Pi's normal empty-editor exit path.
    os.write(fd, b"\x03")
    time.sleep(0.1)
    os.write(fd, b"\x04")
    shutdown_deadline = time.monotonic() + 3.0
    while time.monotonic() < shutdown_deadline:
        drain(fd, output)
        waited, status = os.waitpid(pid, os.WNOHANG)
        if waited:
            os.close(fd)
            return f"shutdown:{os.waitstatus_to_exitcode(status)}", bytes(output)
        time.sleep(0.03)

    os.kill(pid, signal.SIGTERM)
    time.sleep(0.2)
    waited, status = os.waitpid(pid, os.WNOHANG)
    if waited:
        drain(fd, output)
        os.close(fd)
        return f"term-shutdown:{os.waitstatus_to_exitcode(status)}", bytes(output)
    os.kill(pid, signal.SIGKILL)
    os.waitpid(pid, 0)
    drain(fd, output)
    os.close(fd)
    return "forced-kill", bytes(output)


def main() -> int:
    stow = shutil.which("stow")
    if stow is None:
        print("stow is required for Pi startup tests")
        return 1
    with tempfile.TemporaryDirectory(prefix="pi-startup-test-") as temporary_directory:
        home = Path(temporary_directory) / "home"
        home.mkdir()
        (home / ".pi" / "agent" / "sessions").mkdir(parents=True)
        subprocess.run(
            [stow, "-d", str(REPOSITORY_ROOT), "-t", str(home), "--no-folding", "-R", "pi"],
            check=True,
        )
        crash_log = home / ".pi" / "agent" / "pi-crash.log"
        failed = False
        for width, delay in CASES:
            status, output = run_case(width, delay, home)
            has_failure_marker = any(marker in output for marker in FAILURE_MARKERS)
            case_failed = status != "shutdown:0" or has_failure_marker
            failed = failed or case_failed
            print(f"width={width} delay={delay:.2f} status={status} failure={has_failure_marker}")
            if case_failed:
                print(output.decode("utf-8", errors="replace")[-2_000:])

        if crash_log.exists():
            print(f"Pi wrote a crash log: {crash_log}")
            failed = True
        return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
