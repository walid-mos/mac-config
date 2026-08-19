# Simplify taxonomy

One class per finding. The test is **knowledge**, not character-similarity
(coding RULE 12 / AHA).

## `cleanup` — apply now

Behavior-preserving. Inside the reviewed file list, except to **call** an
existing export.

| Signal | Do this |
|---|---|
| A helper/type/constant **already exists** and the new code re-implements it | Call the existing export. Name it in the finding. |
| 2+ copies of the **same knowledge** are inside this diff (same predicate, mapper, error table, i18n shape) | Collapse to one named thing in the smallest existing module that already owns that knowledge. |
| Narrative comment, unused param/type, wrapper JSX that adds no layout | Delete. |
| State that can be derived | Stop storing it. |
| Independent I/O run sequentially in this diff | `Promise.all` (or equivalent). |
| Stringly-typed value where a union/const already exists | Use the union. |
| One-line pass-through this diff added (ARCH 0 deletion test) | Inline it. |
| Special case re-tests a condition an existing helper already answers | Call that helper. |

**Altitude cleanup** = sit on a mechanism that already exists. Example:
`user.segment === 'premium-midscale-economy'` copied in the diff while
`hasRetrocardScale` (or equivalent) already lives in `entities/session`
→ use the existing helper. That is reuse+altitude, not architecture.

## `follow-up` — real, do not apply

- Would change user-visible behavior or a product rule.
- Invents a new shared module this diff would be the first consumer of
  (speculative seam, ARCH 0).
- Touches files outside the reviewed list for anything other than an
  existing import.
- Needs a product decision.

Examples: generic "referential CRUD" for categories/partners/products;
promoting a one-file `SelectField` to the design system; rewriting
`backoffice.procedure`.

## `skip` — tempting, rejected

False positive, style, or the altitude is already correct. Write a skip
row only when you almost proposed a cleanup and then refused it. Do not
pad.

## Decision shortcuts

1. Helper already in the repo → `cleanup` (reuse), even at the first new copy.
2. No helper, 2+ copies of the same knowledge **in this diff** → `cleanup` (quality), extract locally.
3. No helper, one copy, "a shared X would be nicer" → `follow-up` or silence.
4. Deeper mechanism exists → `cleanup` (altitude). Deeper mechanism would have to be invented → `follow-up`.
5. In doubt that behavior stays identical → `follow-up`, never `cleanup`.

## `cost`

- `trivial` — one-liner, delete, switch an import.
- `local` — one file, small extract.
- `cross-file` — 2–3 files. Parent applies these via `implementer` / `implementer-front`.
