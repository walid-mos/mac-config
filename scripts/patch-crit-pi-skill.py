#!/usr/bin/env python3
"""Apply the repository's Pi-specific guidance to Crit's generated skill."""

from pathlib import Path
import os
import sys

START = "<!-- mac-config:crit-review-tool:start -->"
END = "<!-- mac-config:crit-review-tool:end -->"
GUIDANCE = f"""{START}
## Pi integration: use the blocking tool

In Pi, use `crit_review` instead of bash for every **interactive review launch
or reconnect** that must wait for **Finish Review**. Pass CLI arguments as the
tool's `arguments` array (use `[]` for a branch diff). The tool has no timeout,
streams Crit's startup output so the review URL is visible, forwards
cancellation, and returns only after Crit exits. Read its complete stdout/stderr
result and follow the emitted instructions automatically. Keep using bash for
non-interactive commands such as `crit comment`, including commands that pipe
JSON through stdin.
{END}
"""


def skill_path(agent_dir: Path) -> Path:
    return agent_dir / "skills" / "crit" / "SKILL.md"


def patch_skill(path: Path) -> None:
    text = path.read_text()
    if START in text or END in text:
        if text.count(START) != 1 or text.count(END) != 1:
            raise ValueError("incomplete or duplicate managed Crit guidance block")
        before, remainder = text.split(START, 1)
        _, after = remainder.split(END, 1)
        text = before.rstrip() + "\n\n" + after.lstrip()

    marker = "# Review with Crit\n"
    if marker not in text:
        raise ValueError("generated Crit skill has no expected heading")
    patched = text.replace(marker, f"{marker}\n{GUIDANCE}\n", 1)
    path.write_text(patched)


def main() -> int:
    agent_dir = Path(os.environ.get("PI_CODING_AGENT_DIR", "~/.pi/agent")).expanduser()
    skill = skill_path(agent_dir)
    if not skill.is_file():
        print(f"Crit Pi skill not found: {skill}", file=sys.stderr)
        return 1
    try:
        patch_skill(skill)
    except ValueError as error:
        print(f"Cannot patch {skill}: {error}", file=sys.stderr)
        return 1
    print(f"Patched Crit Pi skill: {skill}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
