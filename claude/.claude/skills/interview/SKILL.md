---
name: interview
description: >-
  Interview the user relentlessly about a plan, design, or proposal until
  reaching shared understanding, resolving each branch of the decision tree,
  then capture the resolved decisions as an autonomous HTML deliverable.
  Asks one question at a time with a recommended answer. Use when the user
  runs `/interview`, says "grill me", "stress-test this plan", "challenge my
  design", "interview me", or wants to surface unresolved assumptions before
  implementation.
user-invocable: true
---

# Interview

Run in three phases. Do not skip phases.

## 1. Discovery

On invocation, restate the user's plan or design in your own words to confirm you understood it. Then enumerate the decision branches you see (architectural choices, scope cuts, sequencing, trade-offs) as a short bullet list. Ask the user to confirm or correct the tree before grilling.

## 2. Grilling

Walk the tree depth-first, one branch at a time, one question at a time.

For each question:
- State the question.
- State your **recommended answer** with a one-sentence reason.
- Surface the main trade-off.
- Wait for the user's response.

Rules:
- If a question can be answered by exploring the codebase, explore — never ask the user something you can verify yourself.
- Track resolved decisions internally as you go.
- If the user backtracks, update the affected branch, do not restart the tree.

## 3. Closure

When you estimate every branch is resolved, propose closure explicitly:

> "I think the tree is resolved. Do you want me to generate the HTML deliverable, or is there a branch you want to dig further?"

If the user wants more, return to Grilling. If they validate, generate the HTML and open it in the browser.

## Output

Write a single autonomous HTML file at `./docs/interview/<YYYY-MM-DD>-<topic-slug>.html`. Create the `docs/interview/` directory if it does not exist.

After writing it, open it in Chrome via the `mcp__claude-in-chrome__navigate` tool with a `file://` URL when the extension is connected; otherwise fall back to `open` (macOS) or `xdg-open` (Linux) via Bash.

### Sections (in order)

1. **Header** — topic, date.
2. **Context** — the problem in 2–4 short paragraphs, no fluff.
3. **Resolved decisions** — one block per decision: the question, the retained option, alternatives discarded with their reason. Use a styled list or an inline SVG tree.
4. **Risks & mitigations** — table.
5. **Open questions** — only if a branch remained unresolved at closure. Omit the section if empty.
6. **Next steps** — actionable checklist of implementation steps. Include a "Copy as backlog prompt" button that copies a prompt-ready summary to the clipboard (vanilla JS, no library).

### Design constraints

- Single file. No external assets, no CDN, no fonts. Inline CSS and JS only.
- Mobile-responsive (CSS grid / flex).
- Neutral system-font stack. One accent color, otherwise greys. Clarity over branding.
- Code snippets in `<pre><code>` with a monospace stack.
- No tracking, no analytics.
