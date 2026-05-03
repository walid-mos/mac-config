#!/usr/bin/env python3
"""
go skill helper — fetch open phases for a Linear project.

Queries Linear for all issues in the given project whose state is NOT
`completed` or `canceled`, parses the `[P{N}-{step}] ` prefix from each
title, groups by phase number, and prints a single JSON object to stdout.

Usage:
    python3 fetch_phases.py <project_id> [--phase N]

When `--phase N` is supplied, only that phase appears in the output (the
others are dropped before printing). This keeps the helper output small
when the caller already knows which phase to ship.

Env:
    LINEAR_API_KEY required (no `Bearer ` prefix).

Output schema:
    {
      "project_id": "<uuid>",
      "phases": [
        {
          "number": 1,            # int, or null for orphans (no [P*-*] prefix)
          "tasks": [
            {
              "id": "<uuid>",
              "identifier": "INT-123",
              "title": "[P1-01] Add port allocator state to R2",
              "description": "...",
              "priority": 2,
              "state_name": "Todo",
              "state_type": "unstarted",
              "step": "01"          # or null for orphans
            }
          ]
        }
      ]
    }
"""

from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from typing import Any

LINEAR_URL = "https://api.linear.app/graphql"
HTTP_TIMEOUT = 30
PHASE_RE = re.compile(r"^\[P(\d+)-(\d{2})\]\s+")


def die(msg: str) -> "None":
    print(f"FATAL {msg}", file=sys.stderr, flush=True)
    sys.exit(2)


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


def fetch_open_issues(api_key: str, project_id: str) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    cursor: str | None = None
    while True:
        after = f', after: "{cursor}"' if cursor else ""
        query = (
            f"{{ issues(first: 250{after}, filter: {{ "
            f'project: {{ id: {{ eq: "{project_id}" }} }}, '
            f'state: {{ type: {{ nin: ["completed", "canceled"] }} }} '
            f"}}) {{ nodes {{ id identifier title description priority "
            f"state {{ name type }} }} pageInfo {{ hasNextPage endCursor }} }} }}"
        )
        result = call(api_key, query)
        if "errors" in result:
            die(f"failed to list open issues: {result['errors']}")
        data = result["data"]["issues"]
        issues.extend(data["nodes"])
        if not data["pageInfo"]["hasNextPage"]:
            break
        cursor = data["pageInfo"]["endCursor"]
    return issues


def to_task(issue: dict[str, Any], step: str | None) -> dict[str, Any]:
    return {
        "id": issue["id"],
        "identifier": issue["identifier"],
        "title": issue["title"],
        "description": issue.get("description") or "",
        "priority": issue.get("priority"),
        "state_name": issue["state"]["name"],
        "state_type": issue["state"]["type"],
        "step": step,
    }


def group_by_phase(issues: list[dict[str, Any]]) -> list[dict[str, Any]]:
    phases: dict[int, list[dict[str, Any]]] = {}
    orphans: list[dict[str, Any]] = []
    for issue in issues:
        m = PHASE_RE.match(issue.get("title") or "")
        if not m:
            orphans.append(to_task(issue, None))
            continue
        phase_n = int(m.group(1))
        step = m.group(2)
        phases.setdefault(phase_n, []).append(to_task(issue, step))

    out: list[dict[str, Any]] = []
    for n in sorted(phases.keys()):
        tasks = sorted(phases[n], key=lambda t: t["step"] or "")
        out.append({"number": n, "tasks": tasks})
    if orphans:
        out.append({"number": None, "tasks": orphans})
    return out


def parse_phase_filter(argv: list[str]) -> int | None:
    if len(argv) == 2:
        return None
    if len(argv) == 4 and argv[2] == "--phase":
        try:
            return int(argv[3])
        except ValueError:
            die(f"--phase requires an integer, got {argv[3]!r}")
    die(f"usage: {argv[0]} <project_id> [--phase N]")
    return None  # unreachable; satisfies type-checker


def main(argv: list[str]) -> int:
    phase_filter = parse_phase_filter(argv)
    project_id = argv[1]
    api_key = os.environ.get("LINEAR_API_KEY")
    if not api_key:
        die("LINEAR_API_KEY is not set in env")
    if api_key.lower().startswith("bearer "):
        die("LINEAR_API_KEY must NOT start with 'Bearer ' (Linear personal keys reject Bearer)")

    issues = fetch_open_issues(api_key, project_id)
    grouped = group_by_phase(issues)
    if phase_filter is not None:
        grouped = [p for p in grouped if p["number"] == phase_filter]
    print(
        json.dumps(
            {"project_id": project_id, "phases": grouped},
            ensure_ascii=False,
            indent=2,
        )
    )
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
