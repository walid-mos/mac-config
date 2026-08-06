---
name: review-accor
description: Format a raw PR review comment to the accor CODE_REVIEW_CHARTER and post it inline. Use on /review-accor, or when the user gives a file/line + a raw comment and wants it turned into a proper review comment on a GitHub PR in this repo.
---

# review-accor

Turn a raw remark into a charter-compliant PR review comment, then post it inline.
Self-contained: everything from `.github/CODE_REVIEW_CHARTER.md` that matters for
writing a comment is inlined below — don't re-read the charter.

## Input the user gives

- File path (+ line, or a line range) — or a PR number if not obvious.
- Their raw comment, in FR or EN.

If the target PR isn't clear, ask (or infer from the current branch: `gh pr view --json number`).

## Output rules (the charter, distilled)

1. **Write in English.** Always, whatever language the user wrote in.
2. **Prefix every comment** with exactly one intent tag:
    | Prefix                                                                                                                              | Use when                                                            |
    | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------- |
    | `[BLOCKING]`                                                                                                                        | must be fixed before merge (bug, crash, security, broken invariant) |
    | `[SUGGESTION]`                                                                                                                      | improvement idea, not required                                      |
    | `[QUESTION]`                                                                                                                        | seeking clarification; an answer is expected                        |
    | `[NIT]`                                                                                                                             | minor style/formatting detail                                       |
    | `[DISCUSSION]`                                                                                                                      | broader topic for the team                                          |
    | Pick the weakest tag that fits. A personal preference is `[SUGGESTION]` or `[NIT]`, never `[BLOCKING]` — don't block on preference. |
3. **Review the code, never the person.** No "why did you", no "this is wrong". State the problem, then the fix.
4. **Be specific and actionable.** Name the concrete failure case; give a concrete direction or code snippet. Every comment should be answerable with an action.
5. **Distinguish blocking from optional** in the wording itself (e.g. "Not blocking — fine to keep as-is").
6. **Keep it tight.** One issue per comment. No preamble, no restating the diff.

Shape to aim for: `[TAG] <what's wrong + concrete failure case>. <fix / direction, optionally a snippet>. <blocking-or-not>.`

## Posting inline

Confirm the formatted comment with the user first, then post:

```bash
gh api repos/:owner/:repo/pulls/<PR>/comments \
  -f body='<formatted comment>' \
  -f commit_id="$(gh pr view <PR> --json headRefOid -q .headRefOid)" \
  -f path='<file path>' \
  -F line=<line> -f side=RIGHT -q '.html_url'
```

- Multi-line range: add `-F start_line=<n> -f start_side=RIGHT`.
- Return the `.html_url` to the user.
- For a general (non-line) comment: `gh pr comment <PR> --body '<comment>'`.
