#!/usr/bin/env python3
"""
backlog skill worker — Linear issue creator.

Reads a tasks.json bundle (schema in SKILL.md) and creates Linear issues
idempotently in the target project. Skips any task whose computed title
("[P{N}-{step}] <title>") already exists in the project.

Usage:
    python3 create_issues.py <path/to/tasks.json>

Env:
    LINEAR_API_KEY  required, personal API key (NO `Bearer ` prefix)

Logs (one line per task, plus a Done summary):
    OK   <identifier> <prefixed-title>
    SKIP <prefixed-title> already exists
    FAIL <prefixed-title> <error>
    Done — created=N skipped=M failed=K
"""

from __future__ import annotations

import json
import os
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from typing import Any

LINEAR_URL = "https://api.linear.app/graphql"
WORKERS = 8
HTTP_TIMEOUT = 30


def die(msg: str) -> "None":
    print(f"FATAL {msg}", flush=True)
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
            payload = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"errors": [{"message": f"HTTP {e.code} {e.reason}"}]}
    except urllib.error.URLError as e:
        return {"errors": [{"message": f"URL error: {e.reason}"}]}
    if "errors" in payload:
        return payload
    return payload


def fetch_existing_titles(api_key: str, project_id: str) -> set[str]:
    titles: set[str] = set()
    cursor: str | None = None
    while True:
        after = f', after: "{cursor}"' if cursor else ""
        query = (
            f'{{ issues(first: 250{after}, filter: {{ project: {{ id: {{ eq: "{project_id}" }} }} }}) '
            "{ nodes { title } pageInfo { hasNextPage endCursor } } }"
        )
        result = call(api_key, query)
        if "errors" in result:
            die(f"failed to list existing issues: {result['errors']}")
        data = result["data"]["issues"]
        for node in data["nodes"]:
            titles.add(node["title"])
        if not data["pageInfo"]["hasNextPage"]:
            break
        cursor = data["pageInfo"]["endCursor"]
    return titles


def make_create_mutation(input_dict: dict[str, Any]) -> str:
    fields = ", ".join(
        f"{k}: {json.dumps(v)}" if isinstance(v, str) else f"{k}: {v}"
        for k, v in input_dict.items()
    )
    return (
        "mutation { issueCreate(input: { "
        + fields
        + " }) { success issue { id identifier title } } }"
    )


def validate_bundle(bundle: dict[str, Any]) -> "None":
    for required in ("project_id", "team_id", "phases"):
        if required not in bundle:
            die(f"tasks.json missing required field: {required}")
    if not isinstance(bundle["phases"], list) or not bundle["phases"]:
        die("tasks.json `phases` must be a non-empty list")
    seen_phase_numbers: set[int] = set()
    for phase in bundle["phases"]:
        for required in ("number", "name", "tasks"):
            if required not in phase:
                die(f"phase missing required field: {required}")
        n = phase["number"]
        if not isinstance(n, int) or n < 0:
            die(f"phase number must be int ≥ 0, got {n!r}")
        if n in seen_phase_numbers:
            die(f"duplicate phase number {n}")
        seen_phase_numbers.add(n)
        if not isinstance(phase["tasks"], list) or not phase["tasks"]:
            die(f"phase {n} has no tasks")
        seen_steps: set[str] = set()
        for task in phase["tasks"]:
            for required in ("step", "title", "description"):
                if required not in task:
                    die(f"phase {n} task missing field: {required}")
            step = task["step"]
            if not isinstance(step, str) or len(step) != 2 or not step.isdigit():
                die(f"phase {n} step must be 2-digit string, got {step!r}")
            if step in seen_steps:
                die(f"phase {n} has duplicate step {step}")
            seen_steps.add(step)


def build_payload(
    bundle: dict[str, Any],
) -> list[tuple[str, dict[str, Any]]]:
    """Return list of (prefixed_title, issue_input) ready to submit."""
    project_id: str = bundle["project_id"]
    team_id: str = bundle["team_id"]
    default_priority: int = bundle.get("default_priority", 3)
    out: list[tuple[str, dict[str, Any]]] = []
    for phase in bundle["phases"]:
        n = phase["number"]
        for task in phase["tasks"]:
            prefixed = f"[P{n}-{task['step']}] {task['title']}"
            issue_input: dict[str, Any] = {
                "title": prefixed,
                "description": task["description"],
                "priority": task.get("priority", default_priority),
                "projectId": project_id,
                "teamId": team_id,
            }
            out.append((prefixed, issue_input))
    return out


def submit_one(
    api_key: str,
    prefixed_title: str,
    issue_input: dict[str, Any],
    existing: set[str],
) -> str:
    if prefixed_title in existing:
        return f"SKIP {prefixed_title} — already exists"
    mutation = make_create_mutation(issue_input)
    result = call(api_key, mutation)
    if "errors" in result:
        msg = "; ".join(e.get("message", str(e)) for e in result["errors"])
        return f"FAIL {prefixed_title} — {msg}"
    payload = result.get("data", {}).get("issueCreate")
    if not payload or not payload.get("success"):
        return f"FAIL {prefixed_title} — issueCreate returned no success"
    issue = payload.get("issue", {})
    return f"OK {issue.get('identifier', '?')} {prefixed_title}"


def main(argv: list[str]) -> int:
    if len(argv) != 2:
        die(f"usage: {argv[0]} <path/to/tasks.json>")
    path = argv[1]
    api_key = os.environ.get("LINEAR_API_KEY")
    if not api_key:
        die("LINEAR_API_KEY is not set in env")
    if api_key.lower().startswith("bearer "):
        die("LINEAR_API_KEY must NOT start with 'Bearer ' (Linear personal keys reject Bearer)")

    try:
        with open(path, encoding="utf-8") as f:
            bundle = json.load(f)
    except FileNotFoundError:
        die(f"tasks.json not found: {path}")
    except json.JSONDecodeError as e:
        die(f"tasks.json is not valid JSON: {e}")

    validate_bundle(bundle)

    print(f"Loading existing issues for project {bundle['project_id']} …", flush=True)
    existing = fetch_existing_titles(api_key, bundle["project_id"])
    print(f"Found {len(existing)} existing issues; computing payload …", flush=True)

    payload = build_payload(bundle)
    print(f"Submitting {len(payload)} tasks with {WORKERS} workers …", flush=True)

    created = 0
    skipped = 0
    failed = 0
    with ThreadPoolExecutor(max_workers=WORKERS) as pool:
        futures = [
            pool.submit(submit_one, api_key, title, inp, existing)
            for title, inp in payload
        ]
        for fut in futures:
            line = fut.result()
            print(line, flush=True)
            if line.startswith("OK "):
                created += 1
            elif line.startswith("SKIP "):
                skipped += 1
            else:
                failed += 1

    print(f"Done — created={created} skipped={skipped} failed={failed}", flush=True)
    return 0 if failed == 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
