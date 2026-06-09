#!/usr/bin/env python3
"""
track skill helper — read a versioned plan.json and emit its structure.

plan.json is the sink-agnostic backlog contract produced by /backlog:
milestones[] -> tracks[] -> tasks[]. This helper parses it, validates the
shape, and prints either a summary of every milestone/track (no filter) or
the full task slice of a single track (--milestone M --track T).

The task identifier is DERIVED, never stored: [M{milestone}.{track}-{step}]
-> e.g. "[M1.A-01]". Regex on the consumer side: \\[M(\\d+)\\.([A-Z]+)-(\\d+)\\].

Usage:
    python3 read_plan.py <plan.json>                          # summary
    python3 read_plan.py <plan.json> --milestone 1 --track A  # one track slice

The <milestone> argument accepts either "1" or "M1".

Output (summary):
    {
      "effort": "V8",
      "milestones": [
        { "id": "M1", "number": 1, "demo": "...", "skeleton": true, "needs": [],
          "tracks": [ { "id": "A", "branch": "feat/...", "task_count": 2,
                        "first_titles": ["...", "..."] } ] }
      ]
    }

Output (--milestone/--track): the matching track, every task carrying the
derived "identifier" plus all its plan.json fields (title, size, slice_of,
done_when, description, sink_id, ...). No notion of completion state lives
here — progress is tracked in ~/mizraj/<slug>/progress.db (cockpit_db.sh),
not in plan.json.

Logs FATAL ... to stderr and exits 2 on any structural problem (fail loud).
"""

from __future__ import annotations

import json
import re
import sys
from typing import Any

MILESTONE_ID_RE = re.compile(r"^[Mm](\d+)$")
MILESTONE_ARG_RE = re.compile(r"^[Mm]?(\d+)$")
BRANCH_RE = re.compile(
    r"^(feat|fix|chore|refactor|docs|test|perf|build|ci|style|revert)/[a-z0-9][a-z0-9-]*$"
)


def die(msg: str) -> "None":
    print(f"FATAL {msg}", file=sys.stderr, flush=True)
    sys.exit(2)


def milestone_number(milestone: dict[str, Any]) -> int:
    raw = milestone.get("id")
    if not isinstance(raw, str):
        die(f"milestone is missing a string 'id': {milestone!r}")
    m = MILESTONE_ID_RE.match(raw)
    if not m:
        die(f"milestone id {raw!r} does not match 'M<number>'")
    return int(m.group(1))


def normalize_milestone_arg(value: str) -> int:
    m = MILESTONE_ARG_RE.match(value)
    if not m:
        die(f"--milestone expects '1' or 'M1', got {value!r}")
    return int(m.group(1))


def load_plan(path: str) -> dict[str, Any]:
    try:
        with open(path, encoding="utf-8") as fh:
            data = json.load(fh)
    except FileNotFoundError:
        die(f"plan not found: {path}")
    except json.JSONDecodeError as e:
        die(f"plan is not valid JSON ({path}): {e}")
    if not isinstance(data, dict) or not isinstance(data.get("milestones"), list):
        die(f"plan must be an object with a 'milestones' array ({path})")
    return data


def validate_milestone_graph(plan: dict[str, Any]) -> None:
    """`needs[]` must be explicit, backward-only, and reference existing milestones."""
    numbers_by_id: dict[str, int] = {}
    for milestone in plan["milestones"]:
        numbers_by_id[milestone["id"]] = milestone_number(milestone)
    for milestone in plan["milestones"]:
        mid = milestone["id"]
        needs = milestone.get("needs")
        if needs is None:
            die(f"milestone {mid} is missing required 'needs' (use [] for the skeleton)")
        if not isinstance(needs, list) or not all(isinstance(n, str) for n in needs):
            die(f"milestone {mid} 'needs' must be a list of milestone-id strings, got {needs!r}")
        if bool(milestone.get("skeleton", False)) and needs:
            die(f"skeleton milestone {mid} must have 'needs': [] (it depends on nothing)")
        for ref in needs:
            if ref not in numbers_by_id:
                die(f"milestone {mid} needs {ref!r}, which is not a milestone in this plan")
            if numbers_by_id[ref] >= numbers_by_id[mid]:
                die(f"milestone {mid} needs {ref!r}, not a strictly-earlier milestone (forward/cyclic dep)")


def validate_branches(plan: dict[str, Any]) -> None:
    """Every track carries a unique `branch` = `<conventional-type>/<kebab-slug>`."""
    seen: dict[str, str] = {}
    for milestone in plan["milestones"]:
        for track in milestone.get("tracks", []):
            coord = f"{milestone.get('id')}.{track.get('id')}"
            branch = track.get("branch")
            if not isinstance(branch, str) or not branch:
                die(f"track {coord} is missing a string 'branch'")
            if not BRANCH_RE.match(branch):
                die(f"track {coord} branch {branch!r} must be '<type>/<kebab-slug>' (no coordinate)")
            if branch in seen:
                die(f"branch {branch!r} is shared by tracks {seen[branch]} and {coord} — must be unique")
            seen[branch] = coord


def derive_identifier(milestone_id: str, track_id: str, step: Any) -> str:
    if not isinstance(step, str) or not step.isdigit():
        die(f"task 'step' must be a numeric string, got {step!r}")
    return f"[{milestone_id}.{track_id}-{step}]"


def summary(plan: dict[str, Any]) -> dict[str, Any]:
    milestones_out: list[dict[str, Any]] = []
    for milestone in plan["milestones"]:
        tracks_out: list[dict[str, Any]] = []
        for track in milestone.get("tracks", []):
            tasks = track.get("tasks", [])
            tracks_out.append(
                {
                    "id": track.get("id"),
                    "branch": track.get("branch"),
                    "task_count": len(tasks),
                    "first_titles": [t.get("title", "") for t in tasks[:2]],
                }
            )
        milestones_out.append(
            {
                "id": milestone.get("id"),
                "number": milestone_number(milestone),
                "demo": milestone.get("demo"),
                "skeleton": bool(milestone.get("skeleton", False)),
                "needs": milestone.get("needs", []),
                "tracks": tracks_out,
            }
        )
    return {"effort": plan.get("effort"), "milestones": milestones_out}


def slice_track(plan: dict[str, Any], want_milestone: int, want_track: str) -> dict[str, Any]:
    for milestone in plan["milestones"]:
        if milestone_number(milestone) != want_milestone:
            continue
        for track in milestone.get("tracks", []):
            if track.get("id") != want_track:
                continue
            tasks_out = []
            for task in track.get("tasks", []):
                identifier = derive_identifier(milestone["id"], track["id"], task.get("step"))
                tasks_out.append({**task, "identifier": identifier})
            return {
                "effort": plan.get("effort"),
                "milestone": {
                    "id": milestone["id"],
                    "number": want_milestone,
                    "demo": milestone.get("demo"),
                    "skeleton": bool(milestone.get("skeleton", False)),
                    "needs": milestone.get("needs", []),
                },
                "track": {"id": track["id"], "branch": track.get("branch"), "tasks": tasks_out},
            }
        die(f"milestone M{want_milestone} has no track {want_track!r}")
    die(f"no milestone M{want_milestone} in plan")
    return {}  # unreachable; satisfies type-checker


def parse_args(argv: list[str]) -> tuple[str, int | None, str | None]:
    if len(argv) == 2:
        return argv[1], None, None
    rest = argv[2:]
    milestone: int | None = None
    track: str | None = None
    i = 0
    while i < len(rest):
        flag = rest[i]
        if flag == "--milestone" and i + 1 < len(rest):
            milestone = normalize_milestone_arg(rest[i + 1])
        elif flag == "--track" and i + 1 < len(rest):
            track = rest[i + 1]
        else:
            die(f"usage: {argv[0]} <plan.json> [--milestone M --track T]")
        i += 2
    if (milestone is None) != (track is None):
        die("--milestone and --track must be supplied together")
    return argv[1], milestone, track


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        die(f"usage: {argv[0]} <plan.json> [--milestone M --track T]")
    path, milestone, track = parse_args(argv)
    plan = load_plan(path)
    validate_milestone_graph(plan)
    validate_branches(plan)
    if milestone is None:
        out = summary(plan)
    else:
        out = slice_track(plan, milestone, track)  # type: ignore[arg-type]
    print(json.dumps(out, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv))
