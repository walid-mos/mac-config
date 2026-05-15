# Rich mode (interactive feedback loop)

When the artifact must come back into the agent as **typed data** (decisions to make, anchored comments to react to, tunable tokens, multi-choice questions), switch to rich mode. The HTML serves as a UI; the user clicks **Submit** and the data lands as `submission.json` next to `plan.html`. Claude then reads it and continues.

## When to use rich mode

Use rich mode when the doc has any of:

- Open questions the user must answer before implementation
- Decisions with 2+ viable options (the user picks)
- Live-tunable tokens (color, spacing, copy) that drive the implementation
- Anchored comments on files, sections, or code lines

Otherwise stay in static mode (retros, audits, status reports — no feedback needed).

## Output path

`./docs/interviews/<slug>/plan.html` at the repo root. Slug is the topic identifier — kebab-case, no date prefix. Many slugs can coexist in the same repo (one per in-flight plan).

If `docs/interviews/<slug>/` already exists, **overwrite it** unless the user explicitly named a different slug to preserve history.

## Submission protocol

The HTML must include a `<button id="rp-submit">Submit</button>` that:

1. Collects all interactive state into a single object (see shape below).
2. `POST`s the object as JSON to `/submit` on the same origin (the page is served by `rp`).
3. Replaces its own UI with a `✓ Submitted — return to Claude` confirmation on success.

```js
async function rpSubmit(payload) {
  const res = await fetch('/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('submit failed')
  document.body.innerHTML = '<main style="padding:4rem;font-family:DM Sans,sans-serif"><h1>✓ Submitted</h1><p>Return to Claude — you can close this tab.</p></main>'
}
```

## Submission shape

Free-form, but follow this template so Claude can parse it deterministically:

```json
{
  "decisions": { "<question-id>": "<chosen-option-id>" },
  "edits":     { "<section-id>": "<edited markdown or text>" },
  "comments":  [{ "target": "<anchor>", "body": "<text>" }],
  "tokens":    { "<token-name>": "<value>" },
  "freeform":  "<open notes>"
}
```

Omit keys that don't apply. Anchors for `comments` should be stable selectors (CSS selector, file path, line number) — never DOM positions.

## Running the loop

After writing `plan.html`:

1. Launch the server **in background** with Bash `run_in_background: true`:
   ```
   rp <slug>
   ```
   `rp` resolves the slug to `docs/interviews/<slug>/`, starts the local server on port `7654` (default), opens the browser, and blocks until the user clicks Submit. The harness will notify when the process exits.
2. **Immediately tell the user the URL in chat.** The browser auto-open may fail silently (focus, popup blocker, no GUI). Default URL: `http://localhost:7654/`; if a custom port was used, read `docs/interviews/<slug>/.rp-url`. One short chat line is enough — e.g. *"Round servi sur http://localhost:7654/ — clique Submit quand t'as fini."*
3. Wait for the background process to complete. **Do not poll.**
4. Read `docs/interviews/<slug>/submission.json` and act on it (apply decisions, address comments, tune tokens).

## Required blocks for rich mode

In addition to the shape-based composition (see `recipes.md`), every rich-mode HTML must include:

- A persistent `Submit` button (sticky footer, always visible).
- At least one of: `decisions`, `open-questions`, `comments`, or `interactive-figure`. A rich-mode HTML with no actual interactivity is a smell — drop back to static mode.
- A vanilla-JS controller that wires inputs → state object → POST. No frameworks.
