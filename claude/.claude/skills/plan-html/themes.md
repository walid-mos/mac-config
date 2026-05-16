# Theming — tokens, dark mode, skip-zones

The visual contract every `plan-html` output respects. Load this whenever you generate an HTML deliverable that isn't a one-line preview.

## CSS tokens — single source of truth

**Zero hex literals inside components.** Every color, shadow, radius lives as a `--np-*` custom property on `:root`, redefined under `[data-theme="dark"]`. Components reference tokens only (`var(--np-accent)`, never `#0D9488`). This is what makes dark mode free across every block, including custom ones added later.

Mandatory token names (extend if needed, but keep these):

```css
:root {
  --np-bg:          #F8FAFC;
  --np-bg-soft:     #F1F5F9;          /* card / container */
  --np-bg-edit:     #FFF8C5;          /* edited prose tint */
  --np-text:        #141A30;
  --np-text-muted:  #5B6478;
  --np-border:      #E2E8F0;
  --np-border-soft: #EEF2F6;
  --np-accent:      #0D9488;          /* NextNode teal */
  --np-accent-bg:   #CCFBF1;
  --np-accent-hover:#0F766E;
  --np-highlight:   #F97316;          /* NextNode orange */
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
  --np-bg:          #141A30;
  --np-bg-soft:     #1E2540;
  --np-bg-edit:     #3A2D04;
  --np-text:        #F8FAFC;
  --np-text-muted:  #94A3B8;
  --np-border:      #2D3656;
  --np-border-soft: #232B47;
  --np-accent:      #2DD4BF;          /* teal-400 — lighter for dark bg */
  --np-accent-bg:   #0A332E;
  --np-accent-hover:#5EEAD4;
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

If a block needs a new color, **add a token, don't hardcode**. A hex in a component is the smell.

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
