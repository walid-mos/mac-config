---
name: how-to
description: >-
  Answer an implementation question ("how do I do X with Y?") with
  version-pinned official docs plus field evidence (known bugs, pitfalls,
  prior art). Trigger on /how-to, "comment je fais/implémente X",
  "how do I", "what's the right way to", "quelle est la bonne façon de".
user-invocable: true
---

# How-To

Answer one implementation question with evidence, not memory. Three
non-negotiables, in order of importance:

1. **Freshest documentation, always.** Never answer from training memory
   alone. Every API claim must be backed by a page fetched THIS session.
   Memory proposes, the web disposes.
2. **Version-pinned to the project.** The docs consulted must match the
   version actually installed here (React 18 in the lockfile → React 18
   docs, not React 19 docs, not a 2021 blog post).
3. **Cross-referenced against the field.** Before recommending an
   approach, check whether real users hit bugs, regressions or footguns
   with it (GitHub issues, Stack Overflow, release notes).

## Pipeline

### 1. Frame the question

Identify every library/tool/runtime the question touches (a question like
"react-hook-form with zod" pins BOTH). Read the code around the user's
questioning first if they pointed at a file — the answer must fit the
existing patterns, not fight them.

### 2. Pin versions (project-first)

Resolve the **installed** version, not the manifest range. Lockfile beats
manifest:

| Ecosystem | Installed version source | Fallback |
|---|---|---|
| JS/TS | `package-lock.json` / `pnpm-lock.yaml` / `yarn.lock` / `bun.lock` | `package.json` range |
| Rust | `Cargo.lock` | `Cargo.toml` |
| Python | `uv.lock` / `poetry.lock` / `pip freeze` | `pyproject.toml` / `requirements.txt` |
| Go | `go.sum` / `go.mod` | — |
| Ruby | `Gemfile.lock` | `Gemfile` |
| PHP | `composer.lock` | `composer.json` |
| Runtime | `.nvmrc` / `.node-version` / `.tool-versions` / `mise.toml` | `engines` field |

Also note the **latest stable** version (from the registry or release
page) so you can flag the gap. If the dependency isn't in this project at
all, say so and use latest stable explicitly.

### 3. Fetch official docs — for that version

- Search with the pinned major version AND the current year in the query
  (`react 18 useTransition site:react.dev 2026`), then WebFetch the
  actual pages. A search snippet is not a source.
- Prefer official, versioned doc URLs. Many projects keep per-version
  docs (`legacy.reactjs.org` vs `react.dev`, `/docs/v4/`, `/en/14/`,
  readthedocs version switcher) — verify the page header states the
  version you pinned. A doc page that silently describes a newer major
  is a wrong source; flag any version mismatch.
- Fetch the **changelog / release notes** between the pinned version and
  latest. This catches APIs missing/deprecated in the pinned version and
  behavior changes that invalidate older advice.
- Check each source's publication/update date. Reject anything that
  predates the pinned major version unless it's the official versioned
  doc itself.

### 4. Cross-reference the field

Run these searches in parallel (independent WebSearch calls in one
block, or fan out Explore/general-purpose agents for big questions):

- `<lib> <api/feature> bug OR broken OR regression <pinned version>`
- `site:github.com <repo> issues <api/feature>` — read state (open vs
  closed-fixed-in-vX) and whether the affected range covers the pinned
  version.
- `<lib> <feature> site:stackoverflow.com` — sort mentally by date;
  a top answer from 3 majors ago is a trap, not a source.
- `<lib> <feature> best practice <current year>` — prior art and
  migration writeups.

For each hit that matters, record: source, date, affected versions, and
whether it applies to the pinned version. Discard the rest.

### 5. Synthesize

Lead with the recommended approach. Then:

- **Code first**, written for the pinned version and matching the
  project's existing style/idioms.
- **Caveats from the field**: each known bug/footgun with its source
  link, date, and affected-version range. If field reports contradict
  the official docs, say so explicitly.
- **Version gap warning** when relevant: if the project is N majors
  behind and the newer version changes the recommended approach, answer
  for the pinned version and mention the upgrade path in one short
  paragraph.
- Every non-obvious claim carries an inline source link. No source =
  no claim.

## Hard rules

- A fetch failure is not an excuse to fall back to memory — retry,
  try the alternate doc mirror, or state plainly which claim is
  unverified.
- If sources conflict and can't be resolved, present both with dates
  and let the user decide; recommend the one with the freshest
  corroboration.
