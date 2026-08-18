# Grilling

Interview the user relentlessly until you share the same understanding of the
feature. The goal is not politeness or coverage — it is that **no decision
remains open** by the end, because an open decision downstream is a ticket an
agent cannot finish alone.

## Rounds, not a queue

Build the decision tree first, then partition it into **rounds**:

- Questions with no dependency between them go in the **same round**, asked
  together — grouped by domain, each pre-answered with your recommendation.
  The user scans, overrides the few disagreements, approves.
- A question whose answer depends on another still open waits for the **next
  round**. Never ask a question whose answer is determined by one unresolved.
- After each round, fold the answers in, re-derive the frontier of newly
  askable questions, and ship the next round. Most grills converge in 2–3
  rounds.
- **Pi tooling** : utilise `ask_user_question` pour poser les questions d'un
  round. Regroupe les questions indépendantes dans un seul appel.

## Rules

- **Always propose your recommended answer**, with one sentence of why. Every
  option carries your recommendation.
- **Heavy decisions get compare-axes, not bare radios.** If the user must
  weigh options (architecture, data shape, contract), present options in
  columns with behaviour/cost/consequence in rows.
- **Facts are looked up, not asked.** If the answer is in the filesystem, the
  tracker, the lockfile, the docs or a tool, go get it. Asking the user what
  their own code does burns the interview budget.
- **Push back once.** If the user's answer creates a contradiction with an
  ADR, an earlier answer, or the codebase, say so plainly and give the
  alternative. If they reaffirm, it is decided — record it and move on.
- **Do not act until the user confirms** shared understanding. No spec, no
  tickets, no Plane writes during the grill.

## What must be closed before the grill ends

Sweep this list before declaring the interview over. Anything still open here
either gets asked now, or goes to *Hors périmètre* in the spec.

- **Actors and outcome** — who is this for, and what can they do afterwards
  that they cannot do today?
- **Vocabulary** — the domain name of every new concept, in the project's
  existing language. A new noun that clashes with an existing one is a bug.
- **Scope edge** — the nearest thing this feature is *not*. Name it.
- **Data shape** — new entities, new fields, nullability, units and formats
  (money, dates, ids), and whether a migration is needed.
- **Contracts** — endpoints or module interfaces touched: inputs, outputs,
  status codes, error shapes.
- **States and transitions** — every state a new entity can hold, and what
  moves it. Including the transitions nobody wants (expiry, failure, retry).
- **Authorisation** — what is public, what requires a session, what happens
  to an unauthenticated caller.
- **Failure behaviour** — what the user sees when it breaks. "Fails silently"
  is a decision, and usually the wrong one.
- **Seams and tests** — where this gets tested, at the highest existing seam.
  Prefer existing seams; propose new ones as high as possible; the ideal
  number of new seams is zero, then one.
- **Prior art** — the closest existing implementation in this repo to imitate.
- **Sequencing constraint** — anything that must land before or after
  something else, and why.
- **Cost and infra** — for Cloudflare/NextNode targets, anything that changes
  the bill or the deploy surface.

## Stopping

The final round ends with a recap — every decision taken, one line each,
editable so the user can still reverse one. Approval is the confirmation.
If a decision is reversed, fold it in and re-ship the recap.