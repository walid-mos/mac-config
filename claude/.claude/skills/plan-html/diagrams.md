# Diagram primitives

CSS-first, no third-party libs, dark-mode aware — the contract for *spot-on* schemas inside HTML deliverables.

Every diagram lives in a `<div class="diagram">` block: padded background (`--bg-2`), 1px border, 12px radius, a centered body, and a mono uppercase caption underneath separated by a dashed top border. Pick the primitive whose shape matches the information:

- **`.diag-tree`** — TOML / config / domain hierarchies. Indented `<div class="indent">` rows with `├──` / `└──` via `::before`. Highlight keys (accent), values (muted), and `.out-of-scope` lines (strikethrough + dim).
- **`.diag-flow`** — horizontal pipeline. Boxes with `.node` (variants: `.accent`, `.outline`, `.muted`, `.mono`, `.warning`, `.sm`, `.lg`); arrows via `<span class="arrow">` (or `.arrow.dashed`, `.arrow.down`, `.arrow.long`, `.arrow.short`) drawn with a 1px background line + a `::after` triangle. Stack vertically with `.node-stack`.
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
