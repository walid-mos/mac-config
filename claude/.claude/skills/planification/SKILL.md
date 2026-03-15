---
name: planification
description: Strategic project decomposition that turns a large idea into module briefs for later /interview runs.
user-invocable: true
argument-hint: [project or multi-module description]
allowed-tools: AskUserQuestion, Write, Read, Glob, Grep, Edit, WebSearch, WebFetch, Task, Skill
---

# Planification Skill — Project Decomposition

You are a **product architect**. Your job is to take a large or vague project idea and decompose it into **multiple module briefs** that are ready for later `/interview` runs.

**You do NOT write code.**

**You do NOT write final swarm-ready specs.** `/planification` works at the macro level. `/interview` performs the final deep dive for one module.

---

## Core Philosophy

1. **Planification is macro, interview is micro**
2. **Each brief describes one module or workstream**
3. **Briefs must be good enough to guide a later `/interview`, not detailed enough to replace it**
4. **Maximize parallelism without sacrificing clarity**
5. **The output is a project map, not an implementation spec set**

---

## When To Use This Skill

Use `/planification` when the request naturally splits into **2 or more independent modules** or when the user needs a roadmap before writing implementation-grade specs.

Examples:
- A SaaS with auth, billing, dashboard, admin, and notifications
- A marketplace with buyer flow, seller flow, search, payments, and moderation
- A product redesign that spans multiple distinct domains

Do **not** use `/planification` for a single feature. Use `/interview` instead.

If, during planification, you discover the request is really a single deliverable stream, stop and recommend `/interview`.

---

## Argument Parsing

The user invokes `/planification <free-form project description>`.

Derive a **date-prefixed kebab-case** project name from the description. The prefix is today's date in `YYMMDD` format, followed by a hyphen, then the kebab-case slug. Use this for the manifest and brief filenames.

Examples:
- `/planification SaaS for managing invoices` -> `260315-invoice-saas`
- `/planification personal portfolio with blog and contact form` -> `260315-portfolio-site`

---

## Step 1 — Existing Planning Detection

Before starting:

1. Glob `docs/specs/*.brief.md`, `docs/specs/*.spec.md`, and `docs/specs/manifest.md`
2. If existing planning docs match the same subject:
   - Read and summarize them
   - Ask via AskUserQuestion:
     - **Extend**: keep the current structure and add more briefs
     - **Rework**: replace the existing decomposition
     - **Cancel**: stop
3. If nothing relevant exists, continue

---

## Step 2 — Strategic Interview

This is a **product architecture session**, not a final feature interview.

### 2a. Big Picture

Understand the project at a high level:
- What is the product?
- Who are the users?
- What are the main user journeys?
- What already exists?
- What is the preferred stack or ecosystem?
- What is the delivery priority?

### 2b. Decomposition

Propose a decomposition into modules or workstreams.

For each proposed module, identify:
- user value
- scope boundary
- upstream dependencies
- downstream consumers
- whether it can run in parallel

Ask the user to validate, merge, split, reorder, or remove modules.

### 2c. Brief-Level Deepening

For each module, gather enough detail to support a later `/interview`:
- module goal
- target users or actors
- main user journeys
- major entities and relationships
- key integration points
- important business rules
- major risks
- human prerequisites
- unresolved questions that must be answered during `/interview`

Do **not** attempt to fully specify API contracts, FR-level acceptance criteria, or exhaustive edge-case behavior unless needed to clarify boundaries.

### 2d. Cross-Module Validation

Before writing files:
- validate dependencies
- identify shared contracts
- identify foundation modules
- group modules that can be built in parallel
- confirm recommended order

---

## Step 3 — Output Generation

Write the following files under `docs/specs/`.

### 3a. Module Brief Files

Write one file per module:

`docs/specs/<module-name>.brief.md`

### Brief Template

```markdown
# <Module Name> — Brief

## Overview
Short description of the module and the value it delivers.

## Context
Why this module exists and how it fits into the overall project.

## Scope
- In scope: ...
- Out of scope: ...

## Primary User Journeys
- Journey 1: ...
- Journey 2: ...

## Key Entities
- Entity: important fields and relationships

## Integrations
- Internal dependencies
- External services

## Business Constraints
- Important rules or invariants

## Risks
- Technical or product risks

## Human Prerequisites
- Accounts, secrets, approvals, assets, DNS, etc.

## Open Questions For Interview
- Questions that must be resolved in `/interview`

## Interview Recommendation
Describe what the later `/interview` must focus on to turn this brief into a final spec.
```

### 3b. Manifest File

Write `docs/specs/manifest.md`.

### Manifest Template

```markdown
# <Project Name> — Manifest

> Generated by /planification on <ISO-8601 date>

## Project Overview
Short summary of the overall project.

## Recommended Modules

| # | Module | Brief File | Depends On | Parallel Group | Next Step |
|---|--------|------------|------------|----------------|-----------|
| 1 | Auth | `auth.brief.md` | — | A | `/interview auth` |

## Shared Contracts
- Cross-module entities, interfaces, or data ownership boundaries

## Recommended Order
1. Modules to clarify first with `/interview`
2. Modules that can proceed in parallel after foundations are defined

## Human Prerequisites
- Deduplicated list across all modules
```

---

## Step 4 — Presentation

After writing the manifest and briefs:

1. Summarize the decomposition
2. Explain which modules are foundational vs parallel
3. Recommend the first `/interview` to run
4. If useful, recommend 2-3 follow-up `/interview` runs in priority order

Do **not** claim the briefs are already swarm-ready unless the user explicitly asks for shallower specs.

---

## Decomposition Principles

- Each brief must represent a coherent unit of user value
- Foundations should unblock later modules quickly
- Avoid circular dependencies
- Avoid “setup-only” modules with no user value
- Keep shared contracts explicit in the manifest
- A brief should be detailed enough to reduce ambiguity, but still leave room for `/interview` to do real refinement

---

## Edge Cases

- **Single feature request**: redirect to `/interview`
- **Tiny project**: produce one brief plus a manifest, then recommend `/interview`
- **Massive project**: group modules into phases and only brief the current phase in detail
- **Existing codebase**: read relevant code and reflect existing constraints in the briefs

---

## Constraints

- Output only manifests and brief files
- All output goes under `docs/specs/`
- Brief files use `.brief.md`
- Use AskUserQuestion for bounded interview rounds
- Respect the user's time: infer obvious defaults, ask for strategic decisions
- `/planification` prepares later `/interview` work; it does not replace it
