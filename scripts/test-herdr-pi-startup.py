#!/usr/bin/env python3
"""Isolated Herdr smoke: rapid Pi starts must stay foreground and never SIGTTIN."""

from __future__ import annotations

import json
import os
import shutil
import subprocess
import tempfile
import time
from pathlib import Path
from typing import Any, TextIO

TRIALS = 20
SESSION_NAME = f"herdr-pi-startup-smoke-{os.getpid()}"
PI_FOREGROUND_WAIT = 4.0
STABILITY_SECONDS = 3.0
POLL_STEP = 0.05
SHELL_COMMANDS = {"zsh", "bash", "sh", "dash", "fish"}
PI_COMMANDS = {"pi", "node"}
INHERITED_HERDR = (
    "HERDR_ENV",
    "HERDR_TAB_ID",
    "HERDR_SOCKET_PATH",
    "HERDR_BIN_PATH",
    "HERDR_WORKSPACE_ID",
    "HERDR_PANE_ID",
)


def isolated_env() -> dict[str, str]:
    env = os.environ.copy()
    for key in INHERITED_HERDR:
        env.pop(key, None)
    return env


def herdr(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["herdr", "--session", SESSION_NAME, *args],
        check=check,
        text=True,
        capture_output=True,
        env=isolated_env(),
    )


def session_ctl(*args: str) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        ["herdr", "session", *args],
        check=False,
        text=True,
        capture_output=True,
        env=isolated_env(),
    )


def parse_cli(stdout: str) -> dict[str, Any]:
    payload = json.loads(stdout)
    result = payload.get("result")
    if not isinstance(result, dict):
        raise RuntimeError(f"unexpected herdr payload: {stdout[:400]}")
    return result


class TrackedServer:
    def __init__(
        self,
        process: subprocess.Popen[bytes],
        log_file: TextIO,
        log_path: Path,
    ) -> None:
        self.process = process
        self.log_file = log_file
        self.log_path = log_path

    def close(self) -> None:
        if self.process.poll() is None:
            self.process.terminate()
            try:
                self.process.wait(timeout=3)
            except subprocess.TimeoutExpired:
                self.process.kill()
                self.process.wait(timeout=3)
        self.log_file.close()
        self.log_path.unlink(missing_ok=True)


def start_session() -> TrackedServer:
    log_fd, raw_log_path = tempfile.mkstemp(prefix=f"{SESSION_NAME}-", suffix=".log")
    log_path = Path(raw_log_path)
    log_file = os.fdopen(log_fd, "w")
    process = subprocess.Popen(
        ["herdr", "--session", SESSION_NAME, "server"],
        stdin=subprocess.DEVNULL,
        stdout=log_file,
        stderr=subprocess.STDOUT,
        env=isolated_env(),
    )
    tracked = TrackedServer(process, log_file, log_path)
    deadline = time.monotonic() + 8.0
    try:
        while time.monotonic() < deadline:
            if process.poll() is not None:
                raise RuntimeError(f"server exited before ready rc={process.returncode}")
            status = herdr("status", check=False)
            if "status: running" in status.stdout:
                created = parse_cli(
                    herdr(
                        "workspace",
                        "create",
                        "--label",
                        "pi-startup-smoke",
                        "--no-focus",
                    ).stdout
                )
                if not isinstance(created.get("workspace"), dict):
                    raise RuntimeError("smoke workspace was not created")
                return tracked
            time.sleep(0.1)
        raise RuntimeError(f"named session {SESSION_NAME} did not start")
    except Exception:
        tracked.close()
        raise


def stop_session() -> None:
    session_ctl("stop", SESSION_NAME)
    session_ctl("delete", SESSION_NAME)


def process_snapshot(pane_id: str) -> dict[str, Any]:
    result = parse_cli(herdr("pane", "process-info", "--pane", pane_id).stdout)
    info = result.get("process_info")
    if not isinstance(info, dict):
        raise RuntimeError(f"missing process_info for {pane_id}")
    return info


def wait_for_shell(pane_id: str) -> int:
    deadline = time.monotonic() + 8.0
    while time.monotonic() < deadline:
        info = process_snapshot(pane_id)
        shell_pid = info.get("shell_pid")
        rows = process_rows()
        shell = rows.get(shell_pid) if isinstance(shell_pid, int) else None
        if shell is not None and shell["pgid"] == shell["tpgid"]:
            return shell_pid
        time.sleep(POLL_STEP)
    raise RuntimeError(f"pane {pane_id} shell never became ready")


def command_name(raw: str) -> str:
    return Path(raw).name.lstrip("-") or raw


def process_rows() -> dict[int, dict[str, Any]]:
    raw = subprocess.check_output(
        ["ps", "-axo", "pid=,ppid=,pgid=,tpgid=,stat=,comm="], text=True
    )
    rows: dict[int, dict[str, Any]] = {}
    for line in raw.splitlines():
        parts = line.split()
        if len(parts) < 6:
            continue
        row = {
            "pid": int(parts[0]),
            "ppid": int(parts[1]),
            "pgid": int(parts[2]),
            "tpgid": int(parts[3]),
            "stat": parts[4],
            "comm": command_name(parts[5]),
        }
        rows[row["pid"]] = row
    return rows


def pane_tpgid(shell_pid: int, rows: dict[int, dict[str, Any]]) -> int | None:
    shell = rows.get(shell_pid)
    if shell is None:
        return None
    tpgid = shell["tpgid"]
    return tpgid if isinstance(tpgid, int) and tpgid > 0 else None


def is_descendant(pid: int, ancestor_pid: int, rows: dict[int, dict[str, Any]]) -> bool:
    seen: set[int] = set()
    current = rows.get(pid)
    while current is not None and current["pid"] not in seen:
        if current["ppid"] == ancestor_pid:
            return True
        seen.add(current["pid"])
        current = rows.get(current["ppid"])
    return False


def inspect_pi(
    pane_id: str,
    shell_pid: int,
    pi_pgid: int | None,
    require_pi: bool,
) -> tuple[str | None, int | None]:
    try:
        process_snapshot(pane_id)
    except (subprocess.CalledProcessError, RuntimeError, json.JSONDecodeError) as exc:
        return f"pane-exit:{exc}", pi_pgid
    all_rows = process_rows()
    shell = all_rows.get(shell_pid)
    if shell is None:
        return f"missing-shell-process:{shell_pid}", pi_pgid
    foreground_pgid = pane_tpgid(shell_pid, all_rows)
    if foreground_pgid is None:
        return f"missing-tpgid:{shell_pid}", pi_pgid
    rows = [row for row in all_rows.values() if row["pgid"] == foreground_pgid]
    for row in rows:
        if row["stat"].startswith(("T", "t")):
            return f"stopped:{row}", pi_pgid
    names = {row["comm"] for row in rows}
    pi_rows = [
        row
        for row in rows
        if row["comm"] in PI_COMMANDS and is_descendant(row["pid"], shell_pid, all_rows)
    ]
    if foreground_pgid == shell["pgid"]:
        if require_pi or pi_pgid is not None:
            return "foreground-returned-to-shell", pi_pgid
        return "pi-never-foreground", pi_pgid
    if not pi_rows:
        if names & SHELL_COMMANDS and foreground_pgid != shell["pgid"]:
            return (
                f"foreign-tpgid:pgid={foreground_pgid}:processes={sorted(names)}",
                pi_pgid,
            )
        if require_pi or pi_pgid is not None:
            return (
                f"foreign-tpgid:pgid={foreground_pgid}:processes={sorted(names)}",
                pi_pgid,
            )
        return f"pi-not-foreground:pgid={foreground_pgid}:processes={sorted(names)}", pi_pgid
    if pi_pgid is not None and foreground_pgid != pi_pgid:
        return f"tpgid-changed:{pi_pgid}->{foreground_pgid}", pi_pgid
    return None, foreground_pgid


def wait_for_pi_foreground(pane_id: str, shell_pid: int) -> tuple[str | None, int | None]:
    deadline = time.monotonic() + PI_FOREGROUND_WAIT
    last_reason = "pi-never-foreground"
    pi_pgid: int | None = None
    while time.monotonic() < deadline:
        last_reason, pi_pgid = inspect_pi(pane_id, shell_pid, pi_pgid, require_pi=False)
        if last_reason is None:
            return None, pi_pgid
        if last_reason.startswith(
            (
                "pane-exit:",
                "stopped:",
                "tpgid-changed:",
                "foreign-tpgid:",
                "missing-shell-process:",
            )
        ):
            return last_reason, pi_pgid
        time.sleep(POLL_STEP)
    return last_reason, pi_pgid


def trial_failed(pane_id: str, shell_pid: int) -> str | None:
    startup_failure, pi_pgid = wait_for_pi_foreground(pane_id, shell_pid)
    if startup_failure is not None:
        return startup_failure
    deadline = time.monotonic() + STABILITY_SECONDS
    while time.monotonic() < deadline:
        reason, pi_pgid = inspect_pi(pane_id, shell_pid, pi_pgid, require_pi=True)
        if reason is not None:
            return reason
        time.sleep(POLL_STEP)
    reason, _ = inspect_pi(pane_id, shell_pid, pi_pgid, require_pi=True)
    return reason


def run_trial(workspace_id: str, index: int) -> str | None:
    created = parse_cli(
        herdr(
            "tab",
            "create",
            "--workspace",
            workspace_id,
            "--label",
            f"pi-smoke-{index}",
            "--focus",
        ).stdout
    )
    root = created.get("root_pane")
    tab = created.get("tab")
    if not isinstance(root, dict) or not isinstance(root.get("pane_id"), str):
        return "tab-create-missing-pane"
    pane_id = root["pane_id"]
    tab_id = tab.get("tab_id") if isinstance(tab, dict) else None
    try:
        shell_pid = wait_for_shell(pane_id)
        herdr("pane", "run", pane_id, "pi")
        return trial_failed(pane_id, shell_pid)
    finally:
        herdr("pane", "send-keys", pane_id, "ctrl+c", check=False)
        time.sleep(0.05)
        if isinstance(tab_id, str):
            herdr("tab", "close", tab_id, check=False)


def main() -> int:
    if shutil.which("herdr") is None or shutil.which("pi") is None:
        print("herdr or pi not installed")
        return 1

    stop_session()
    server: TrackedServer | None = None
    failed = False
    try:
        server = start_session()
        workspaces = parse_cli(herdr("workspace", "list").stdout).get("workspaces")
        if not isinstance(workspaces, list) or not workspaces:
            raise RuntimeError("smoke workspace missing")
        workspace_id = workspaces[0].get("workspace_id")
        if not isinstance(workspace_id, str):
            raise RuntimeError("smoke workspace id missing")
        for index in range(TRIALS):
            reason = run_trial(workspace_id, index)
            print(f"trial={index + 1:02} status={'ok' if reason is None else reason}")
            failed = failed or reason is not None
    except Exception as exc:
        print(f"setup-error:{exc}")
        failed = True
    finally:
        stop_session()
        if server is not None:
            server.close()
    return 1 if failed else 0


if __name__ == "__main__":
    raise SystemExit(main())
