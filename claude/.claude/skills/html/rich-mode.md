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
2. `POST`s the object as JSON to `./submit` (resolved against the page URL — works whether `rp` serves the page at `/plan.html` or the cockpit serves it at `plan://localhost/<kind>/<slug>/plan.html`).
3. Replaces its own UI with a `✓ Submitted — return to Claude` confirmation on success.

```js
async function rpSubmit(payload) {
  const res = await fetch('./submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('submit failed')
  document.body.innerHTML = '<main style="padding:4rem;font-family:var(--np-sans)"><h1>✓ Submitted</h1><p>Return to Claude — you can close this tab.</p></main>'
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
   `rp` resolves the slug to `docs/interviews/<slug>/`, starts the local server (port `7654` by default, but it **auto-falls back to an OS-assigned free port** if 7654 is busy — so several `rp` can run in parallel without colliding), opens the browser, and blocks until the user clicks Submit. The harness will notify when the process exits.
2. **Immediately tell the user the URL in chat.** The browser auto-open may fail silently (focus, popup blocker, no GUI). **Never assume the port** — read the actual URL from the server: it's the first stdout line of the background `rp` command, and is also written to `docs/interviews/<slug>/.rp-url`. (With a parallel run the port may not be 7654.) One short chat line is enough — e.g. *"Round servi sur <url> — clique Submit quand t'as fini."*
3. Wait for the background process to complete. **Do not poll.**
4. Read `docs/interviews/<slug>/submission.json` and act on it (apply decisions, address comments, tune tokens).

## Required blocks for rich mode

In addition to the shape-based composition (see `recipes.md`), every rich-mode HTML must include:

- A persistent **approval gate** (sticky footer, always visible) — see below for the two-button contract.
- At least one of: `decisions`, `open-questions`, `comments`, or `interactive-figure`. A rich-mode HTML with no actual interactivity is a smell — drop back to static mode.
- A vanilla-JS controller that wires inputs → state object → POST. No frameworks.

## Approval gate — two buttons, two contracts

Replace the lone `Submit` button with two explicit choices in the sticky footer. Each maps to a different next-action contract for Claude. **Honor the contract literally** — improvising on one of these betrays the user's intent.

```html
<footer class="rp-gate">
  <button id="rp-reject" class="rp-btn rp-btn-ghost">Reject</button>
  <button id="rp-approve" class="rp-btn rp-btn-accent">Approve</button>
</footer>
```

Each button posts the same payload with one extra field:

```js
async function rpSubmit(mode /* 'approved' | 'rejected' */) {
  const payload = collectState()
  payload.approval_mode = mode
  const res = await fetch('./submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error('submit failed')
  document.body.innerHTML = `<main style="padding:4rem;font-family:var(--np-sans)"><h1>✓ ${mode === 'rejected' ? 'Rejected' : 'Submitted'}</h1><p>Return to Claude — you can close this tab.</p></main>`
}
document.getElementById('rp-approve').onclick = () => rpSubmit('approved')
document.getElementById('rp-reject').onclick  = () => rpSubmit('rejected')
```

### How Claude must react to `approval_mode`

- **`"approved"`** — **Do not restate. Do not ask "shall I proceed". Acknowledge briefly ("starting now") and begin implementation immediately.** The approval click is the user's explicit go-ahead — restating betrays it.
- **`"rejected"`** — do not implement. Acknowledge and ask what direction they want.

### Why the gate matters

It's a contract, not a courtesy. Restating after an `"approved"` click betrays the user's explicit choice to skip the safety check — they clicked Approve, that *is* the safety check. No mid-flow "shall I proceed" prompts, ever.
