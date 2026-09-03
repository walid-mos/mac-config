# AI Operational Discipline

Load this file only when planning coding work. The
behavioral rules remain in `SKILL.md`; this file defines how to execute them.

## 1. Collect evidence efficiently

Use `find` and `grep` to locate owners, then `read` the relevant implementation,
tests, callers, and contracts. Read targeted slices when the relevant region is
known. After editing, inspect the diff; read files back only when formatting,
generation, or a non-exact mutation could have changed unintended content.

## 2. Scale the plan to the change

Use the boundary from `SKILL.md` section 0 as the plan. Keep a local reversible
edit to a short internal sequence. For cross-cutting work, record goal, non-goals,
acceptance evidence, owners, and operation order before editing.

## 3. Load only required capabilities

Load `coding` and only the language, framework, UI, or workflow skills required by
the current files and behavior. Add a process skill only when its workflow is part
of the task; capability availability alone is not a reason to expand scope.
