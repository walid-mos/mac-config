#!/usr/bin/env python3
"""
next skill helper — set a Linear issue's workflow state by type.

This is the OPTIONAL Linear adapter. /next calls it only when a task carries
a `sink_id` (the Linear issue UUID) in the plan. When a task has no sink_id,
state lives purely in the per-project progress.db + git, and this helper is
never invoked.

Picks the FIRST workflow state of the issue's team matching the requested
type, then calls `issueUpdate(id, { stateId })`. This avoids hard-coding
state IDs (which differ per workspace).

Usage:
    python3 set_state.py <issue_id> <state_type> [--archive]

state_type ∈ {backlog, unstarted, started, completed, canceled}.

Flags:
    --archive    After the state update, call `issueArchive` so the issue
                 leaves the workspace's active list immediately (instead of
                 waiting for Linear's auto-archive delay). Useful for
                 `completed` to keep WIP/active counts clean.

Env:
    LINEAR_API_KEY required (no `Bearer ` prefix).

Logs:
    OK <identifier> -> <state name> [archived]   (success)
    FAIL <issue_id> <error>                      (failure, exit 1)
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from typing import Any

LINEAR_URL = "https://api.linear.app/graphql"
HTTP_TIMEOUT = 30
ALLOWED_TYPES = {"backlog", "unstarted", "started", "completed", "canceled"}

# Workflow state TYPE → ordered list of preferred state NAMES.
# Linear lets a team have several states sharing the same type
# (e.g. "In Progress" + "In Review" both have type "started"). Picking
# the first state Linear returns is non-deterministic; this table makes
# the helper land on the canonical "I'm starting work" / "I finished" /
# etc. state instead of a sibling like "In Review" or "Duplicate".
PREFERRED_NAMES = {
    "started": ("In Progress", "Doing", "In Development"),
    "completed": ("Done", "Completed", "Shipped"),
    "canceled": ("Canceled", "Cancelled"),
    "unstarted": ("Todo", "To Do"),
    "backlog": ("Backlog",),
}


def pick_state(states: list[dict[str, Any]], state_type: str) -> dict[str, Any] | None:
    matching = [s for s in states if s["type"] == state_type]
    if not matching:
        return None
    for preferred in PREFERRED_NAMES.get(state_type, ()):
        for s in matching:
            if s["name"] == preferred:
                return s
    return matching[0]


def die(msg: str, code: int = 2) -> "None":
    print(f"FATAL {msg}", file=sys.stderr, flush=True)
    sys.exit(code)


def fail(msg: str) -> "None":
    print(f"FAIL {msg}", file=sys.stderr, flush=True)
    sys.exit(1)


def call(api_key: str, query: str) -> dict[str, Any]:
    body = json.dumps({"query": query}).encode("utf-8")
    req = urllib.request.Request(
        LINEAR_URL,
        data=body,
        headers={"Content-Type": "application/json", "Authorization": api_key},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=HTTP_TIMEOUT) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"errors": [{"message": f"HTTP {e.code} {e.reason}"}]}
    except urllib.error.URLError as e:
        return {"errors": [{"message": f"URL error: {e.reason}"}]}


def fetch_issue_team_states(api_key: str, issue_id: str) -> list[dict[str, Any]]:
    query = (
        f'{{ issue(id: "{issue_id}") {{ id team {{ id states {{ '
        f"nodes {{ id name type }} }} }} }} }}"
    )
    result = call(api_key, query)
    if "errors" in result:
        msgs = "; ".join(e.get("message", str(e)) for e in result["errors"])
        fail(f"{issue_id} fetch issue states: {msgs}")
    issue = result.get("data", {}).get("issue")
    if not issue:
        fail(f"{issue_id} not found (or insufficient permissions)")
    return issue["team"]["states"]["nodes"]


def update_state(api_key: str, issue_id: str, state_id: str) -> dict[str, Any]:
    mutation = (
        f'mutation {{ issueUpdate(id: "{issue_id}", '
        f'input: {{ stateId: "{state_id}" }}) '
        "{ success issue { identifier state { name } } } }"
    )
    return call(api_key, mutation)


def archive_issue(api_key: str, issue_id: str) -> dict[str, Any]:
    mutation = f'mutation {{ issueArchive(id: "{issue_id}") {{ success }} }}'
    return call(api_key, mutation)


def main(argv: list[str]) -> int:
    args = argv[1:]
    archive = False
    if "--archive" in args:
        archive = True
        args = [a for a in args if a != "--archive"]
    if len(args) != 2:
        die(f"usage: {argv[0]} <issue_id> <state_type> [--archive]")
    issue_id, state_type = args
    if state_type not in ALLOWED_TYPES:
        die(f"state_type must be one of {sorted(ALLOWED_TYPES)}, got {state_type!r}")
    api_key = os.environ.get("LINEAR_API_KEY")
    if not api_key:
        die("LINEAR_API_KEY is not set in env")
    if api_key.lower().startswith("bearer "):
        die("LINEAR_API_KEY must NOT start with 'Bearer ' (Linear personal keys reject Bearer)")

    states = fetch_issue_team_states(api_key, issue_id)
    state = pick_state(states, state_type)
    if state is None:
        fail(f"{issue_id} no workflow state of type {state_type!r} in this team")

    result = update_state(api_key, issue_id, state["id"])
    if "errors" in result:
        msgs = "; ".join(e.get("message", str(e)) for e in result["errors"])
        fail(f"{issue_id} issueUpdate: {msgs}")
    payload = result.get("data", {}).get("issueUpdate")
    if not payload or not payload.get("success"):
        fail(f"{issue_id} issueUpdate returned no success")
    issue = payload["issue"]

    suffix = ""
    if archive:
        ar = archive_issue(api_key, issue_id)
        if "errors" in ar:
            msgs = "; ".join(e.get("message", str(e)) for e in ar["errors"])
            fail(f"{issue_id} issueArchive: {msgs}")
        ar_payload = ar.get("data", {}).get("issueArchive")
        if not ar_payload or not ar_payload.get("success"):
            fail(f"{issue_id} issueArchive returned no success")
        suffix = " [archived]"

    print(f"OK {issue['identifier']} -> {issue['state']['name']}{suffix}", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
