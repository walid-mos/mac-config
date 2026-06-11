---
name: javascript
user-invocable: false
description: >-
  JavaScript-specific judgment and idioms. Use when writing or modifying
  *.js, *.jsx, *.mjs, or *.cjs files, alongside the language-agnostic
  "coding" skill. Mechanical bans are enforced by oxlint via
  @nextnode-solutions/standards.
---

# JavaScript Best Practices - Mandatory Rules

These rules apply to ALL JavaScript code you write or modify. They build on top of the language-agnostic coding rules, which also apply.

## Enforced by the linter - do not re-derive, just comply

`var`, `==`/`!=` (**`value == null` is banned too** - write `value === null || value === undefined` or use `??`), `eval()`, `arguments`, string concatenation for dynamic strings, `.then()` chains (`.catch(handler)` detach is the sanctioned fire-and-forget form), `JSON.parse(JSON.stringify())`, in-place `.sort()` (use `toSorted()`), `||` defaults where `??` is meant, `for...in` on arrays, default exports, grab-bag module names, mutating function parameters.

## Deep-dive references

- [async.md](async.md) - `Promise.allSettled` vs `all` vs sequential: the concurrency decision tree
- [arrays.md](arrays.md) - declarative methods vs `for...of`, `Map`/`Set` over plain objects
- [error-handling.md](error-handling.md) - fetch status checks, custom error classes, never swallow

---

## Variable Declarations

- **Declare at the point of first use**, not at the top of the function.
- **One declaration per line.** No `const a = 1, b = 2`.
- **Use destructuring** to extract values: `const { name, email } = user`, `const [first, second] = items`.

## Arrow Functions

Arrow functions for callbacks; named function declarations at top level (hoisting + stack-trace names). Implicit return for one-expression arrows.

## Deep Copies

`structuredClone(obj)` for deep copies of **plain data only**. It THROWS (`DataCloneError`) on functions anywhere in the tree - top level AND nested - and on DOM nodes; class instances lose their prototype (methods silently gone). If the value isn't plain data, restructure instead of cloning.

## Nullish vs Falsy

`||` only for booleans. For defaults use `??` - `0`, `""`, `false` are valid values that `||` tramples (`config.port || 3000` breaks port 0).

Collapse conditional assignment with logical assignment, on **local state you own**, never on parameters (linted): `port ??= 3000` (null/undefined only - port 0 stays 0), `cache.tags ||= []` (only when falsy really means absent).

## Modules

- **ES modules** (`import`/`export`), not CommonJS, unless the runtime forces it.
- **Named exports.** Refactor-safe, auto-importable. (Default exports are linted; framework files like Next.js pages are exempted in the config.)
- **One module, one responsibility.** Name the module after its single concern (`tax.js`, `formatDate.js`). SRP rationale: `/coding` RULE 13; DRY: `/coding` RULE 12.

---

## Quick Reference - Judgment Beyond the Linter

| Pattern | Verdict | Instead |
|---|---|---|
| `for...of` doing only a boolean any/all check | AVOID | `.some()` / `.every()` ([arrays.md](arrays.md)) |
| Plain object used as a dynamic-key store | AVOID | `Map` / `Set` ([arrays.md](arrays.md)) |
| Sequential `await` for independent ops | NEVER | `Promise.allSettled` (default) or `Promise.all` ([async.md](async.md)) |
| Unchecked `fetch` response | NEVER | Check `res.ok` ([error-handling.md](error-handling.md)) |
| Swallowed / silently-logged caught error | NEVER | Recover or re-throw with `{ cause }` |
| `structuredClone` on non-plain data | NEVER | Plain data only (throws on functions, drops prototypes) |
| `\|\|` default on a non-boolean | AVOID | `??` / `??=` |
| Logical assignment mutating a parameter | NEVER | Copy first; operators are for local state |
