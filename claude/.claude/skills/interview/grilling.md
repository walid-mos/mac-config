# Grilling (rounds 1..N)

For each in-scope branch, derive the questions needed to fill the six-field closure schema (see `closure.md`). Each question targets one missing cell.

## 1. Build the round

A round is a batch of all currently-pending questions across all branches. Pending = never asked, skipped in a prior round (re-grilled with refined wording), or re-opened from the resolved summary.

Generate `plan.html` with the `Interview · grilling` recipe (`header` + `resolved-summary`* + `questions`). For the `questions` and `resolved-summary` block contracts (recommended-answer accent box, skip-as-third-path, re-open link), see `../plan-html/blocks.md`.

Per-round budget: 4–10 questions feels right. Below 4, batch with the next branch; above 10, split into two rounds (process `state.json` after each, ordering follows depth-first traversal of the tree).

## 2. Run the round

Serve via `rp <slug>` and relay the URL in chat — protocol in `../plan-html/rich-mode.md`. Read `submission.json`:

```json
{
  "answers": {
    "<question-id>": { "choice"?: "...", "freetext"?: "...", "skip"?: true, "note"?: "..." }
  },
  "reopen": ["<question-id>", ...],
  "freeform": "..."
}
```

## 3. Merge and decide

Update `state.json` for every non-skipped answer (record it as a cell value in the six-field closure table). For skipped or re-opened answers, queue them for the next round — but **refine the wording** before re-asking. A literal repeat is a smell; if the user skipped, the question wasn't clear enough.

Loop §1 → §3 until every in-scope branch has all six cells populated. Then enter closure (`closure.md`).
