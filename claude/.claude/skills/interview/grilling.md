# Grilling (rounds 1..N)

For each in-scope branch, derive the questions needed to fill the six-field closure schema (see `closure.md`). Each question targets one missing cell.

## 1. Build the round

A round is a batch of all currently-pending questions across all branches. Pending = never asked, skipped in a prior round (re-grilled with refined wording), or re-opened from the resolved summary.

Generate `plan.html` with the `Interview · grilling` recipe (`header` + `resolved-summary`* + `questions`). For the `questions` and `resolved-summary` block contracts (recommended-answer accent box, input-type rules, per-question diagram, skip-as-third-path, re-open link), see `../plan-html/blocks.md`. Per-question diagram primitives are documented in `../plan-html/diagrams.md` — load it whenever the round contains UX/architecture/comparison choices.

Per-round budget: 4–10 questions feels right. Below 4, batch with the next branch; above 10, split into two rounds (process `state.json` after each, ordering follows depth-first traversal of the tree).

**Per-question shape — pick deliberately, do not default:**

- **Mutually exclusive choice → radio** with `choice` in the answer.
- **Orthogonal axes that combine → checkbox** with `choices: string[]`. Typical case: a UX question that mixes layout + features (e.g. side-by-side + syntax + gutter + chrome-minimal). Forcing this into a radio is a smell — the user has to pick a fake bundle instead of their real combination.
- **Open-ended → textarea** with `freetext`. Use sparingly; most questions can be enumerated.
- **Option count is content-driven**, not pinned at 4. Two sharp options beat four where two are filler. Never invent options to fill a slot.
- **Include a diagram per question** when the choice has a spatial / structural dimension. UX layout choices, architecture comparisons, pipeline shapes — pick the primitive from `../plan-html/diagrams.md`. The reader should *see* the difference, not parse it from text.

## 2. Run the round

Serve via `rp <slug>` and relay the URL in chat — protocol in `../plan-html/rich-mode.md`. Read `submission.json`:

```json
{
  "answers": {
    "<question-id>": {
      "choice"?: "...",
      "choices"?: ["...", "..."],
      "freetext"?: "...",
      "skip"?: true,
      "note"?: "..."
    }
  },
  "reopen": ["<question-id>", ...],
  "freeform": "..."
}
```

`choice` for radio, `choices` for checkbox (multi-select), `freetext` for textarea — exactly one of these per non-skipped answer. `note` is the optional nuance/objection field always available alongside the input.

## 3. Merge and decide

Update `state.json` for every non-skipped answer (record it as a cell value in the six-field closure table). For skipped or re-opened answers, queue them for the next round — but **refine the wording** before re-asking. A literal repeat is a smell; if the user skipped, the question wasn't clear enough.

Loop §1 → §3 until every in-scope branch has all six cells populated. Then enter closure (`closure.md`).
