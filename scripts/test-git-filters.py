#!/usr/bin/env python3
"""Regression tests for repository Git clean filters."""

from __future__ import annotations

import subprocess
from pathlib import Path

REPOSITORY_ROOT = Path(__file__).resolve().parents[1]
HERMES_FILTER = REPOSITORY_ROOT / "scripts" / "git-filter-hermes-config-clean.sh"


def filter_hermes_config(source: str) -> str:
    result = subprocess.run(
        [str(HERMES_FILTER)],
        input=source,
        check=True,
        capture_output=True,
        text=True,
    )
    return result.stdout


def test_hermes_model_selection_is_normalized() -> None:
    source = """model:
  # Hermes may retain comments in this block.
  default: temporary/model
  provider: temporary-provider
  base_url: https://temporary.invalid/v1
  custom: retained
agent:
  model:
    default: nested-is-retained
"""
    expected = """model:
  # Hermes may retain comments in this block.
  default: gpt-5.6-luna-900k
  provider: openai-codex
  base_url: https://chatgpt.com/backend-api/codex
  custom: retained
agent:
  model:
    default: nested-is-retained
"""
    actual = filter_hermes_config(source)
    if actual != expected:
        raise AssertionError(f"unexpected Hermes filter output:\n{actual}")


if __name__ == "__main__":
    test_hermes_model_selection_is_normalized()
    print("git-filter tests passed")
