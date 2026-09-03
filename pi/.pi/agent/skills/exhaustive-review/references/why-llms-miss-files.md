# Why exhaustive review needs mechanical proof

This reference explains the rationale. `SKILL.md` owns the workflow contract and
the scripts own CLI behavior.

## Failure modes

1. **Salience replaces enumeration.** Models naturally prioritize large or
   interesting files and omit the quiet long tail.
2. **Feeling finished is not evidence.** A confident completion statement does not
   prove that every scoped file was visited.
3. **Context decays over long passes.** Later files receive weaker attention as
   earlier context accumulates.
4. **Multiple objectives compete.** Bugs, architecture, duplication, and formatting
   in one pass receive partial coverage instead of independent evaluation.

## Why the mechanism works

- A mechanical inventory turns recall into list traversal.
- One objective per manifest prevents a verdict from standing in for another
  evaluation.
- A read-only survey prevents early fixes from hiding unvisited files.
- Small fresh-context batches bound attention decay.
- A fail-closed coverage check replaces self-reported completeness.
- A negative-space report exposes deliberate exclusions.

Quality tools can detect syntax defects, complexity, duplication, dead code, and
regressions. They do not prove module cohesion or responsibility boundaries; those
still require a named review objective and direct inspection.
