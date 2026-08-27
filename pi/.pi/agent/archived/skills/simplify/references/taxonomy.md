# Simplify taxonomy

One class per finding. The test is **knowledge**, not character-similarity
(coding RULE 12 / AHA).

## `cleanup` — apply now

Behavior-preserving. Stay inside the reviewed file list, except to import an
existing export or consolidate at an existing legal shared ownership boundary.

| Signal | Do this |
|---|---|
| A helper/type/constant **already exists** and new code re-implements it | Call the existing export. Name it in the finding. |
| 2+ live consumers encode the **same knowledge** (predicate, mapper, error table, i18n shape, schema field set), including renamed equivalents across frontend, backend, tests, or schemas | Consolidate at the smallest existing legal shared ownership boundary/package. A helper need not already exist. |
| 2+ copies of the same knowledge are inside this diff | Collapse to one named thing in the smallest existing module that already owns that knowledge. |
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

### Clarity guards

- Prefer explicit, domain-named code over a clever or compressed abstraction.
- Do not merge code that merely looks alike: copies must have one change reason,
  identical inputs/outputs, and the same owner and lifecycle.
- Keep boundary-specific adaptation explicit; share the invariant, not transport,
  rendering, fixture setup, or framework ceremony.
- Reject an extraction if its name, parameters, or call sites are less clear than
  the copies, or if it hides meaningful differences behind flags/options.
- Do not trade independent tests for coupled tests; test each consumer's contract
  at its own boundary.

## `follow-up` — real, do not apply

- Would change user-visible behavior or a product rule.
- Invents a new shared module when this diff would be its first consumer
  (speculative seam, ARCH 0).
- Has 2+ copies but no existing legal shared ownership boundary/package; record
  the opportunity rather than creating cross-layer coupling.
- Touches files outside the reviewed list for anything other than an existing
  import or the verified existing shared boundary.
- Needs a product decision.

Examples: generic "referential CRUD" for categories/partners/products;
promoting a one-file `SelectField` to the design system; rewriting
`backoffice.procedure`.

## `skip` — tempting, rejected

False positive, style, or the altitude is already correct. Write a skip row
only when you almost proposed a cleanup and then refused it. Do not pad.

## Decision shortcuts

1. Helper already in the repo → `cleanup` (reuse), even at the first new copy.
2. No helper, 2+ live consumers encode the same knowledge and an existing legal
   shared boundary/package owns it → `cleanup` (consolidate there).
3. No helper, 2+ copies but no legal shared boundary → `follow-up`.
4. No helper, one consumer, "a shared X would be nicer" → `follow-up` or silence.
5. Deeper mechanism exists → `cleanup` (altitude). Deeper mechanism would have
   to be invented → `follow-up`.
6. In doubt that behavior stays identical or the abstraction stays clearer →
   `follow-up`, never `cleanup`.

## `cost`

- `trivial` — one-liner, delete, switch an import.
- `local` — one file, small extract.
- `cross-file` — two or more files. The parent applies the smallest verified set after loading the relevant coding/language/UI skills and reruns the behavior lock after each independent set.
