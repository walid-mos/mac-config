#!/usr/bin/env python3
"""Stress Pi startup with input arriving before extensions finish loading."""

from __future__ import annotations

import fcntl
import os
import pty
import select
import signal
import struct
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
CRASH_LOG = Path.home() / ".pi" / "agent" / "pi-crash.log"


def drain(fd: int, output: bytearray) -> None:
    # Footer polling can keep the PTY perpetually readable; bound each drain pass.
    for _ in range(64):
        if not select.select([fd], [], [], 0)[0]:
            return
        try:
            output.extend(os.read(fd, 65_536))
        except OSError:
            return


def run_case(width: int, delay: float) -> tuple[str, bytes]:
    pid, fd = pty.fork()
    if pid == 0:
        fcntl.ioctl(0, termios.TIOCSWINSZ, struct.pack("HHHH", 24, width, 0, 0))
        os.environ["PI_OFFLINE"] = "1"
        os.execvp("pi", ["pi"])

    fcntl.ioctl(fd, termios.TIOCSWINSZ, struct.pack("HHHH", 24, width, 0, 0))
    time.sleep(delay)
    os.write(fd, b"x")
    output = bytearray()
    deadline = time.monotonic() + 1.5

    while time.monotonic() < deadline:
        select.select([fd], [], [], 0.03)
        drain(fd, output)
        waited, status = os.waitpid(pid, os.WNOHANG | os.WUNTRACED)
        if not waited:
            continue
        if os.WIFSTOPPED(status):
            os.kill(pid, signal.SIGCONT)
            os.kill(pid, signal.SIGTERM)
            os.waitpid(pid, 0)
            os.close(fd)
            return "stopped", bytes(output)
        os.close(fd)
        return f"early-exit:{os.waitstatus_to_exitcode(status)}", bytes(output)

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
    crash_log_before = CRASH_LOG.stat().st_mtime_ns if CRASH_LOG.exists() else None
    failed = False
    for width, delay in CASES:
        status, output = run_case(width, delay)
        has_failure_marker = any(marker in output for marker in FAILURE_MARKERS)
        case_failed = status != "shutdown:0" or has_failure_marker
        failed = failed or case_failed
        print(f"width={width} delay={delay:.2f} status={status} failure={has_failure_marker}")
        if case_failed:
            print(output.decode("utf-8", errors="replace")[-2_000:])

    crash_log_after = CRASH_LOG.stat().st_mtime_ns if CRASH_LOG.exists() else None
    if crash_log_after != crash_log_before:
        print(f"Pi wrote a new crash log: {CRASH_LOG}")
        failed = True
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
