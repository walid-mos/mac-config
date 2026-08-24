# Same-knowledge discovery

Use this protocol before classifying duplication. The parent runs repository
mapping and bounded lexical retrieval once into the shared manifest. Reviewers
verify those hits and run only angle-relevant unresolved structural/cross-layer
searches. Search broadly where evidence requires it; never repeat broad work by
rote. Consolidate only under the taxonomy's ownership and clarity rules.

## 1. Map ownership

1. List repository/workspace roots, packages, apps, services, shared libraries,
   schema/API directories, and test/fixture roots from workspace manifests and
   package metadata.
2. Record each candidate's runtime (browser, server, worker, shared), public
   exports/barrels, dependency direction, and legal import boundaries.
3. Treat generated code, snapshots, vendored files, build output, and fixtures
   as evidence only unless they are the authoritative owner.

## 2. Retrieve candidates once

For every changed predicate, mapper, validation, error mapping, field set, or
constant, run these searches in order and log paths inspected. Steps 1–2 belong
to the parent's manifest prepass; reviewers consume their recorded hits. Steps
3–5 run only for unresolved seeds relevant to the reviewer's angle:

1. **Exact symbols:** function/type/constant names, imports, exports, and known
   aliases; search definitions and call sites.
2. **Literals and members:** distinctive strings, enum values, error codes,
   route fragments, property names, and 2–4-field combinations.
3. **Structural fingerprint:** normalize renamed locals and search the ordered
   operations: inputs read, guards, field transforms, defaults, validation,
   error/result shape, and side effects. Search short distinctive operation
   pairs when a full fingerprint has no hit.
4. **Cross-layer counterparts:** search UI/client, server/service, tests, and
   schema/API/serialization directories for the same domain terms, fields, and
   wire values. Compare semantic ownership, not spelling.
5. **Existing boundary:** inspect nearby exports, barrels, package manifests,
   path aliases, and dependency rules to find the smallest already-legal shared
   owner. Confirm every consumer can import it without reversing dependencies or
   importing a browser-only module on the server (or the reverse).

## 3. Rank and cap candidates

Keep at most 12 candidates per knowledge unit: rank exact semantic matches
first, then matching field sets and operation fingerprints, then literal-only
matches. For each retained candidate, record consumer, owner, runtime, matching
evidence, differences, and whether the boundary is legal. Stop expanding a
candidate after a material semantic difference (different rule owner, lifecycle,
input/output contract, or side effect) proves it is not the same knowledge.

## 4. Maintain a coverage ledger

For every changed knowledge unit, record:

- unit and changed location;
- searches run and directories/layers covered;
- retained candidates and rejected near-matches with the reason;
- shared boundary/export checked and dependency result;
- classification: cleanup, follow-up, or no finding.

Do not report a no-duplication conclusion without exact-symbol, literal/member,
structural, cross-layer, and boundary checks in the ledger.

## Stop rules and safety

Stop when the ledger is complete, candidates are capped and ranked, and each
candidate is classified. Do not broaden from one domain into unrelated
look-alikes. Do not consolidate frontend and backend code merely because their
shapes match: share only runtime-neutral knowledge at an existing legal boundary;
leave rendering, transport, authorization, environment access, and lifecycle
handling local. Tests may reveal duplicated domain knowledge, but retain
independent test setup and assertions; never make tests depend on another
consumer's implementation just to remove duplication.
