# Diagram primitives

CSS-first, dark-mode aware — the contract for *spot-on* schemas inside HTML deliverables.

**When to reach for what.** `.diag-*` primitives below give you pixel-perfect control of layout — use them when the *position* of each box carries meaning (compare, stack, kinds, pool, timeline, custom topology). For flowcharts / sequences / state machines where you just want a clean auto-layout, use `mermaid` instead (see `./blocks.md`). Don't replicate Mermaid by hand with `.diag-flow` when the flow has >4 nodes or any branching — Mermaid was built for that.

Every diagram lives in a `<div class="diagram">` block: padded background (`--np-bg-soft`), 1px border, 12px radius, a centered body, and a mono uppercase caption underneath separated by a dashed top border. Pick the primitive whose shape matches the information:

- **`.diag-tree`** — TOML / config / domain hierarchies. Indented `<div class="indent">` rows with `├──` / `└──` via `::before`. Highlight keys (accent), values (muted), and `.out-of-scope` lines (strikethrough + dim).
- **`.diag-flow`** — horizontal pipeline. Boxes with `.node` (variants: `.accent`, `.outline`, `.muted`, `.mono`, `.warning`, `.sm`, `.lg`); arrows via `<span class="arrow">` (or `.arrow.dashed`, `.arrow.down`, `.arrow.long`, `.arrow.short`). Stack vertically with `.node-stack`.

  **Arrow construction — strict, no improvisation** (the default "1px bg + ::after triangle" is a smell when ratios are off — looks like a fat bar with a hat):

  - The arrow `<span>` is `display:inline-flex; align-items:center;` and **transparent itself** — never give the span a `background` (that's the "thick bar" failure mode).
  - Shaft: a pseudo-element (`::before`) that is a **1.5px-tall** rectangle (`height: 1.5px`, not 2+, not 8), `background: currentColor` (so it inherits color from the parent), width ~28px (`.short` = 18px, `.long` = 48px), vertically centered.
  - Head: a pseudo-element (`::after`) drawn as a CSS triangle via borders:
    ```css
    border-style: solid;
    border-width: 4px 0 4px 6px;          /* 8px tall, 6px long */
    border-color: transparent transparent transparent currentColor;
    ```
    The head sits flush against the right end of the shaft (no gap, no overlap that would visually thicken the join).
  - `currentColor` for both shaft and head — set `color: var(--text-muted)` on the `.arrow` by default, `color: var(--accent)` on `.arrow.accent`, `color: var(--danger)` on blocking edges. Never paint shaft and head differently.
  - Dashed variant: `.arrow.dashed`'s `::before` uses `background: linear-gradient(to right, currentColor 50%, transparent 50%); background-size: 6px 1.5px;` — keeps the same 1.5px height, no chunky dashes.
  - Vertical variant (`.arrow.down`): rotate the whole span `transform: rotate(90deg);` rather than re-drawing pseudos — guarantees identical proportions across orientations.
  - The arrow span as a whole occupies ~36px wide × 8–10px tall (the head height + a hair of breathing room). It must visually read as "thin line ending in a small head", not "bar with a hat". If the shaft looks the same weight as the head, the rule is wrong — fix it before shipping.
  - **When in doubt, fall back to inline SVG** (`<svg viewBox="0 0 36 10"><line x1="0" y1="5" x2="28" y2="5" stroke="currentColor" stroke-width="1.5"/><path d="M28 1 L34 5 L28 9 Z" fill="currentColor"/></svg>`) — the SVG path renders consistently and removes the entire class of CSS-arrow proportion bugs. SVG is preferred when the diagram has more than 3 arrows or any rotation/curve.
- **`.diag-compare`** — side-by-side `<div class="pane">` panels separated by a centered `vs` cell. For "X vs Y" decisions (managed sidecars vs app services, mode A vs mode B). Stack to one column under 680px.
- **`.diag-kinds`** — grid of `<div class="kind-card">` for discriminated-union types: kind label (mono uppercase accent), one-line description, monospace fields block. Use when a decision picks N types with distinct fields.
- **`.diag-pool`** — `<div class="pool-box">` (dashed accent border) listing items as `.chip`s, plus a `.refs-row` of `<div class="ref-box">` for downstream per-target references. Use for global pools (secrets, env vars, registries) that fan out.
- **`.diag-stack`** — vertical `<div class="layer">` rows for layered architectures. Highlight a pure / accent layer with `.layer.pure`. Use to separate pure logic from target-specific adapters.
- **`.diag-timeline`** — horizontal `<div class="ver-tag">` chips connected by arrows for version bumps, migration steps, before/after states. Variants: `.old`, `.bump` (accent, "breaking"), `.new`.
- **Inline SVG (`<svg class="diag-svg" viewBox="…">`)** — network topology, host-with-silos diagrams, anything requiring free-form positioning. Use semantic classes (`.host-box`, `.silo-box`, `.svc`, `.svc-sidecar`, `.conn`, `.conn-dashed`, `.cross`, `.label-mono`, `.label-title`) styled in the main `<style>` block so dark mode works. Keep viewBox compact (≤560×220) and centered.

## Spot-on quality bar

The difference between "schema" and "merde":

- Boxes share the same border-radius, padding, and font-family. No mixing `<table>` with flexbox boxes in the same diagram.
- Mono font for technical identifiers (file paths, service names, hashes, versions). Sans for human labels.
- Accent color = the highlighted element of the diagram (current target, "this is the change"). Muted grey = relationships / metadata. Red only for "blocked / no route".
- Always centered horizontally inside the diagram body. Always a caption underneath naming what the reader is looking at.
- Never use Mermaid, Graphviz, or any CDN — `plan-html` is hermetic by spec.
