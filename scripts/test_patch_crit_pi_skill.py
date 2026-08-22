#!/usr/bin/env python3
import importlib.util
from pathlib import Path
import tempfile
import unittest

SCRIPT = Path(__file__).with_name("patch-crit-pi-skill.py")
SPEC = importlib.util.spec_from_file_location("patch_crit_pi_skill", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(MODULE)


class PatchCritPiSkillTest(unittest.TestCase):
    def test_patch_is_idempotent_and_keeps_generated_content(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            skill = Path(directory) / "SKILL.md"
            skill.write_text("---\nname: crit\n---\n\n# Review with Crit\n\nGenerated body.\n")

            MODULE.patch_skill(skill)
            first = skill.read_text()
            MODULE.patch_skill(skill)

            self.assertEqual(skill.read_text(), first)
            self.assertEqual(first.count(MODULE.START), 1)
            self.assertIn("use `crit_review` instead of bash", first)
            self.assertIn("Generated body.", first)

    def test_unexpected_generated_skill_fails_closed(self) -> None:
        with tempfile.TemporaryDirectory() as directory:
            skill = Path(directory) / "SKILL.md"
            skill.write_text("unexpected")
            with self.assertRaisesRegex(ValueError, "expected heading"):
                MODULE.patch_skill(skill)


if __name__ == "__main__":
    unittest.main()
