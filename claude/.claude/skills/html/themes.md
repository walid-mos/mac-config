# Theming — tokens, dark mode, skip-zones

The visual contract every `html` output respects. Load this whenever you generate an HTML deliverable that isn't a one-line preview.

## CSS tokens — single source of truth

**The brand source of truth is `nextnode-landing/src/styles/global.css`** (the @theme block, OKLCH). Always read it before defining tokens; never copy from outdated docs (the v2.0 Brand Guidelines table in `nextnode-design/colors.md` uses Tailwind hex that does **not** equal the current OKLCH accent — `accent-500 ≠ teal-500`). When in doubt, navigate to https://nextnode.fr and sample `getComputedStyle(document.documentElement).getPropertyValue('--color-accent-500')` — that's the law.

**Zero literals inside components.** Every color, shadow, radius lives as a `--np-*` custom property on `:root`, redefined under `[data-theme="dark"]`. Components reference tokens only (`var(--np-accent)`, never `oklch(70.4% …)` and never `#0D9488`). This is what makes dark mode free across every block, including custom ones added later.

Mandatory token names (extend if needed, but keep these) — values mirror `nextnode-landing/src/styles/global.css`:

```css
:root {
  /* Surfaces & text — base scale */
  --np-bg:          oklch(98.4% 0.003 247.86);  /* base-50 */
  --np-bg-soft:     oklch(96.8% 0.007 247.84);  /* base-100, card / soft surface */
  --np-bg-edit:     #FFF8C5;                     /* edited prose tint */
  --np-text:        oklch(20.8% 0.042 265.76);  /* base-900 */
  --np-text-muted:  oklch(55.4% 0.046 257.42);  /* base-500 */
  --np-border:      oklch(92.9% 0.013 255.51);  /* base-200 */
  --np-border-soft: oklch(96.8% 0.007 247.84);  /* base-100 */

  /* Brand accent — OKLCH from landing */
  --np-accent:      oklch(70.4% 0.14 182.503);  /* accent-500 — primary */
  --np-accent-bg:   oklch(95.3% 0.051 180.801); /* accent-100 — focus / selection / soft tint */
  --np-accent-hover:oklch(60% 0.118 184.704);   /* accent-600 — hover, accent text on light */

  --np-highlight:   #F97316;                     /* orange — accent only, never primary action */
  --np-success:     #16A34A;
  --np-warn:        #D97706;
  --np-danger:      #DC2626;
  --np-add-bg:      #DCFCE7;
  --np-add-text:    #166534;
  --np-add-border:  #BBF7D0;
  --np-del-bg:      #FEE2E2;
  --np-del-text:    #991B1B;
  --np-del-border:  #FECACA;
  --np-edit-bg:     #FFF8C5;
  --np-edit-text:   #854D0E;
  --np-edit-border: #FDE68A;
  --np-shadow-soft: 0 2px 6px rgba(0,0,0,.06);
  --np-shadow-pop:  0 4px 16px rgba(0,0,0,.12);
  --np-shadow-bar:  0 -2px 12px rgba(0,0,0,.04);
  --np-shadow-modal:0 8px 32px rgba(0,0,0,.20);
  --np-radius:      8px;
  --np-mono:        "JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace;
  --np-sans:        "DM Sans", -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
  --np-display:     "Plus Jakarta Sans", "DM Sans", sans-serif;
}

[data-theme="dark"] {
  --np-bg:          oklch(20.8% 0.042 265.76);  /* base-900 */
  --np-bg-soft:     oklch(27.9% 0.041 260.03);  /* base-800 */
  --np-bg-edit:     #3A2D04;
  --np-text:        oklch(98.4% 0.003 247.86);  /* base-50 */
  --np-text-muted:  oklch(70.4% 0.04 256.79);   /* base-400 */
  --np-border:      oklch(37.2% 0.044 257.29);  /* base-700 */
  --np-border-soft: oklch(27.9% 0.041 260.03);  /* base-800 */

  --np-accent:      oklch(77.7% 0.152 181.912); /* accent-400 — brighter for dark bg */
  --np-accent-bg:   oklch(38.6% 0.063 188.416); /* accent-900 — dark teal tint */
  --np-accent-hover:oklch(85.5% 0.138 181.071); /* accent-300 — hover lighter */

  --np-highlight:   #FB923C;
  --np-success:     #4ADE80;
  --np-warn:        #FBBF24;
  --np-danger:      #F87171;
  --np-add-bg:      rgba(74,222,128,.18);
  --np-add-text:    #86EFAC;
  --np-add-border:  rgba(74,222,128,.40);
  --np-del-bg:      rgba(248,113,113,.18);
  --np-del-text:    #FCA5A5;
  --np-del-border:  rgba(248,113,113,.40);
  --np-edit-bg:     rgba(251,191,36,.18);
  --np-edit-text:   #FCD34D;
  --np-edit-border: rgba(251,191,36,.40);
  --np-shadow-soft: 0 2px 6px rgba(0,0,0,.40);
  --np-shadow-pop:  0 4px 16px rgba(0,0,0,.55);
  --np-shadow-bar:  0 -2px 12px rgba(0,0,0,.35);
  --np-shadow-modal:0 8px 32px rgba(0,0,0,.65);
}
```

If a block needs a new color, **add a token, don't hardcode**. An OKLCH or hex literal in a component is the smell.

## Accent usage — saturation discipline

The single most common reason a NextNode-branded HTML deliverable reads as "flashy / fluo / wrong" is not the *palette* — it's the *density of saturated accent*. The brand teal is a signal, not a texture. Apply these rules without exception:

- **Saturated `--np-accent` is for the lone primary CTA and small indicators only.** What counts:
  - The single primary action button (`Submit`, `Approve`, `Next`). Exactly one per context — secondary CTAs use **outline**, not fill.
  - Thin accent indicators: focus rings (~3px `--np-accent-bg` ring + 1px `--np-accent` border), ~2px tab underlines, ~3-4px `border-left` strips, the dot of an active radio (`accent-color: var(--np-accent)`), the link underline.
- **Never fill large content blocks with `--np-accent-bg`.** A "recommended" callout, a "highlighted" prose block, a "primary option card" — none of these should be painted with `--np-accent-bg` (pastel teal). They use `background: var(--np-bg-soft)` + `border-left: 4px solid var(--np-accent)` + accent-colored label. The bg-soft fill keeps the surface neutral; the accent border carries the "this is the highlight" signal.
- **`--np-accent-bg` (pastel) is reserved for**: focus glow rings, the active state of a clicked radio/checkbox, very brief selection highlights, hairline tints. **Not** for prose backgrounds, not for `.opt-card.recommended`, not for big tab strips.
- **Secondary CTA = outline, not a second fill.** Two saturated teal buttons side by side double the visual weight, halve the hierarchy. Pattern: `background: transparent; border: 1px solid var(--np-accent); color: var(--np-accent-hover);` with `:hover { background: var(--np-accent-bg); }`. The primary stays filled; the secondary becomes a clear "alternative path" visually.
- **Orange (`--np-highlight`) is *never* primary action.** No orange Approve / Submit / Build buttons — orange is for badges, highlights, alerts that contrast *with* teal primary, not for replacing its role.
- **Audit before shipping.** After rendering, count the saturated `--np-accent` fills visible above the fold. If it's more than 2 (one primary CTA + one small indicator like a tab underline), you've over-painted — switch the extras to outline or border-only.

## Anti-FOUC bootstrap

Put this `<script>` first in `<head>`, *before* the stylesheet `<link>`. It resolves the theme synchronously and sets `data-theme` before the first paint — no flash of white when the user is in dark mode.

```html
<script>
(function () {
  try {
    var stored = localStorage.getItem('np-theme');
    var theme = stored || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    document.documentElement.setAttribute('data-theme', theme);
  } catch (e) {
    document.documentElement.setAttribute('data-theme', 'light');
  }
})();
</script>
```

Pair it with a small toggle (top-right floating button) that writes `localStorage.setItem('np-theme', next)` and emits a `np:theme-change` CustomEvent on `document`. Third-party widgets (Mermaid, highlight.js) re-theme on that event.

## Skip-zones — what the runtime never auto-edits

In rich mode, the editable convention auto-instruments `<p>` and `<li>` inside `<section>`. These containers are **skip-zones** (their interior is never made editable, by design): `<pre>`, `<table>`, `.mermaid`, `.diff`, `.file-tree`, `.decision`, `.rich-question`, `.rich-custom`. To opt a single paragraph out, use `<p class="static">`. To opt one back in, wrap content in a `<p>` outside any skip-zone.

## Forcing a single theme

To pin a doc to one theme regardless of user preference, set the attribute directly:

```html
<html data-theme="dark">
```

The toggle and `localStorage` still let the user switch. To remove the toggle entirely, hide it via inline CSS: `.np-theme-toggle { display: none; }`.
