---
name: terse
description: >
  Toggle of the global terse output mode (ON by default via ~/.claude/TERSE.md).
  Invoke to switch the CURRENT conversation to normal verbose mode — full
  explanations, pedagogy, no compression. Use when user invokes /terse, says
  "normal mode", "stop terse", "explique en détail". Invoking again (or the
  user saying "terse") re-enables terse for the conversation.
---

# Terse toggle

Terse is the session default (rules live in `~/.claude/TERSE.md`, loaded via the global CLAUDE.md). This skill flips the state for the current conversation only.

- If terse was active (the default): switch to **normal mode** — full prose, explanations sized to the topic, no compression rules. Stay in normal mode for every following response of this conversation.
- If normal mode was already toggled on: switch **back to terse** and re-apply `~/.claude/TERSE.md` strictly.

State persists for the whole conversation until toggled again. A bare "terse" / "normal mode" from the user counts as a toggle without invoking the skill.
