---
name: simplify
user-invocable: true
description: >-
  Post-implementation cleanup of a behavior-locked diff. Maps the repository,
  searches semantic duplication across layers with four parallel readers,
  canonicalizes findings, and applies only verified behavior-preserving fixes.
  Trigger on /simplify, "simplifie le diff", "cleanup avant review", "simplify
  last commit", or "simplify les PR 12 et 13". Not for initial implementation
  or correctness bugs.
---

# Simplify

Simplify code that already works. The objective is less duplicated **knowledge**,
less accidental complexity, and less future drift — not merely fewer lines.


- [classification and clarity guards](references/taxonomy.md)
- [same-knowledge discovery protocol](references/discovery.md)

## 0. Resolve scope and lock behavior

Treat unrecognized free text as `FOCUS`.

| Input | Scope |
|---|---|
| none | default base (`develop`, else `main`, else GitHub default) through `HEAD`, plus working tree |
| `last` / `HEAD` | `git show HEAD`, plus working tree |
| `HEAD~N` / `last N commits` | `HEAD~N...HEAD`, plus working tree |
| `#12` / `pr 12` | PR diff; apply only changes present locally |
| several PRs | union; apply only changes present locally |
| `maillon` | stack branch versus parent; `gh stack view`, then fork-point fallback |
| `global` / `stack` | whole stack versus default base |
| path | restrict the resolved range to that path |

Set explicit `RANGE`, sorted `FILES`, and `FOCUS`. Exclude generated files before
research: lockfiles, snapshots such as `**/migrations/meta/*_snapshot.json`,
generated clients, build output, vendored code, and license dumps. Stop if
`FILES` is empty.

Detect commands from the affected package roots and Makefile. Run the cheapest
test/typecheck/lint command that covers the changed behavior; record exact
command, result, and coverage as `LOCK`. A red initial lock stops `/simplify`.
If no meaningful lock exists, discovery may run but structural/cross-file fixes
remain follow-ups.

## 1. Build one shared discovery manifest

The parent performs this deterministic prepass once, before model fan-out. Use
`git diff --unified=0`, `git ls-files`, workspace/package manifests, import
aliases, public barrels, and repository architecture instructions. Write a
compact JSON manifest to a local temporary `MANIFEST_PATH`; never paste source
or the full diff into child prompts.

```text
{
  version, cacheKey, range, focus,
  files: [{path, package, runtime, changedHunks, changedSymbols}],
  knowledgeSeeds: [{id, kind, location, identifiers, distinctiveLiterals,
                    memberOrFieldSet, operations, propertyPaths}],
  retrievalCandidates: [{seedId, signal, query, file, line, rank}],
  packageRoots: [{root, runtime, dependencies, publicEntries}],
  sharedBoundaries: [{owner, runtime, exports, consumerPackages}],
  excludedGenerated: [{path, reason}],
  lock: {command, result, coverage},
  workspace: {head, statusHash, diffHash, manifestHashes}
}
```

Normalize paths; sort arrays; deduplicate literals; omit generic tokens. A
knowledge seed or retrieval candidate is a lead, never proof. Include changed
predicates, mappers, constants/member sets, schemas/DTOs, validation, error
maps, route/wire values, state derivations, and repeated I/O shapes. Run exact
identifier/export and distinctive literal/member-set searches once here;
record their bounded hits in `retrievalCandidates`. Reviewers verify those hits
and broaden only when their angle leaves a specific seed unresolved. When
fallow resolves (load skill `fallow-gate`), merge its `dupes --near
--changed-since` clone groups into `retrievalCandidates` as deterministic
leads — same status as any lead, never proof.

`cacheKey = hash(version + range + focus + files + workspace)`, where
`workspace` includes HEAD, status/diff hashes, and package/alias/architecture
manifest hashes. Reuse the manifest and completed angle artifacts only when the
entire fingerprint still matches. Keep cache artifacts outside the repository.
Record prepass commands, elapsed time, files/hunks/seeds/hits indexed, candidate
caps reached, and cache hit/miss.

## 2. Four parallel semantic readers


Search allocation is asymmetric by design: reuse gets the largest budget
because wider semantic-clone discovery has the highest recall value. The other
lanes remain independent safeguards. **Do not rerun manifest searches.** Reuse
owns repository-wide export/clone broadening; quality inspects local/cross-layer
same-knowledge candidates; efficiency follows only execution/I/O seeds;
altitude follows only owner/mechanism candidates. A lane broadens a search only
for an unresolved seed relevant to its angle and logs why. Pass paths and IDs,
never transcripts or source dumps.


`FINDINGS_SCHEMA` must enforce this compact shape:

```text
{
  angle,
  findings: [{
    id, concept, class: "cleanup"|"follow-up",
    cost: "trivial"|"local"|"cross-file",
    confidence: "high"|"medium"|"low",
    locations: [{file, line, symbol?}],
    evidence: [{query, fact}],
    owner: {file?, package?, symbol?, boundaryLegal: true|false},
    differences: [string]
  }],
  coverage: {
    changedUnits: [{id, checkedStages: [string]}],
    rootsSearched: [string], queries: [string],
    gaps: [string], truncated: boolean,
    rejected: {semanticMismatch, boundaryViolation, weakSignal, clearerLocal}
  }
}
```

Empty findings are valid; empty or vague **coverage is not**. A lane is complete
only if each changed knowledge seed records the applicable discovery stages, or
an explicit gap. If a lane truncates, omits files/seeds, or fails, resume that
same run first. If no resumable run or valid artifact exists, restart the same
named agent/model with only the uncovered units. Never lower timeout, substitute
an angle, or silently accept partial coverage.

## 3. Canonicalize before verification

The parent merges actual structured data, not prose labels:

1. Normalize paths, symbols, owners, and location order.
2. Reject malformed findings, locations outside searched evidence, missing
   counterpart proof, or illegal boundaries.
3. Group by `owner symbol`, else by normalized concept plus the union of
   locations. Never deduplicate by wording alone.
4. Merge reuse/altitude or quality/reuse reports about the same knowledge;
   preserve all angles, evidence, differences, and dissent.
5. Stable key:
   `class | owner(package,file,symbol) | concept | sorted(locations)`.
6. Rank existing compatible exports first; then identical knowledge with an
   existing shared owner; then follow-ups. Literal-only similarity never wins.

This step must produce counts for raw, malformed/rejected, deduplicated,
conflicting, and verification candidates. It is the cost gate: do not pay for a
second model pass over duplicates.

## 4. Verify cross-cut candidates

The parent verifies every surviving cleanup with `read`/`grep` against source.
For candidates crossing package, frontend/backend, schema/enum, test/production,
or runtime boundaries, also prove all of the following:

- values, optionality, defaults, aliases, serialization, errors, and lifecycle
  mean the same thing;
- both consumers change for the same domain reason;
- the proposed owner is an **existing legal shared boundary**, runtime-neutral
  for every consumer, and dependency direction remains valid;
- tests retain independent assertions and do not import another consumer's
  implementation merely to look DRY;
- no behavior adaptation, flag-heavy abstraction, or clarity loss is hidden.

Conflicting evidence requires focused re-reading of only the cited locations,
not another repository-wide pass. Any unresolved semantic or boundary question
becomes `follow-up`/`skip`; similarity is retrieval evidence, never proof.

## 5. Apply the smallest verified set

Load `coding` plus the relevant language/UI skills before editing. Start
`APPLY_FILES` with `FILES`. It may expand only to:

1. an existing smallest legal shared owner chosen during verification; and
2. the minimum live consumers that must switch to that canonical source.

This permits a real front/back/schema consolidation when two or more live
consumers already encode one invariant and the repository already has a proper
shared owner. It does **not** permit creating a speculative `shared/` package,
rewriting unrelated callers, or bundling nearby cleanup.

Apply one independent cleanup set at a time, favoring deletion and existing
exports before extraction. Clarity beats line count: no nested ternaries,
flag-driven mega-helpers, collapsed concerns, removed error handling, or clever
one-liners. Preserve public contracts unless the canonical source is already
that contract.

After each set, rerun `LOCK`. If it fails, revert only that set, classify it as
follow-up, and restore green. If the workspace fingerprint changed since Phase
1, invalidate the cache and rediscover before applying stale evidence. After
the last set, also run the fallow audit gate (skill `fallow-gate`) when the
binary resolves: findings introduced by an applied set revert that set, like a
red `LOCK`. Leave changes unstaged unless the caller's active workflow owns
commits.

## Cost and telemetry

Report measured values when available; use `null`, never estimates, otherwise:
manifest cache hit, prepass time, per-lane elapsed/input/output/cached tokens and
searches, raw/deduplicated/verified/accepted findings, coverage gaps, retries,
and cost per accepted cleanup. The optimization order is:

1. deterministic manifest and cache;
2. compact artifact handoffs;
3. bounded candidate ranking;
4. merge before verification;
5. focused cross-cut reads only for survivors.

Do not suppress a semantic angle merely to save money. Save tokens by sharing
facts and narrowing evidence, not by lowering recall.

## Failure recovery and output

On timeout, inspect child status/artifacts; preserve completed structured output
and any `patch.changed === true`; resume only missing/incomplete work. Never
replace failed research with parent intuition.

Final output: `LOCK` before/after; range/files/generated exclusions; cache key
and hit; four-angle coverage/gaps/retries; canonicalized findings with angle
provenance; fixes; follow-ups/skips and reasons; `APPLY_FILES`; telemetry; and
residual risk.

## Boundaries

- Correctness bugs belong to review, not `/simplify`.
- Repository architecture redesign belongs to `/architecture`.
- In `ship` / `stack` / `accor-ship`: run `maillon`, then `global`, before
  submitting the stack.
