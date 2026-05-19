# Rich content primitives — code, diffs, file trees, pills, mermaid

The visual primitives that distinguish a "plan rendu pro" from a "wall of markdown". Each is a self-contained block: drop the markup, the runtime / library does the rest. **Don't roll your own** — these are stable, themed, and dark-mode aware. All tokens come from `./themes.md`.

## `code-block` — `<pre><code class="language-…">`

Syntax-highlighted code via **highlight.js** (CDN, version-pinned, lazy-loaded only when the page contains at least one `<pre><code>`).

```html
<pre><code class="language-typescript">export function issue(userId: string): string {
  return jwt.sign({ sub: userId }, SECRET, { algorithm: 'HS256' })
}
</code></pre>
```

Supported languages = whatever highlight.js handles. Common: `language-typescript`, `language-python`, `language-bash`, `language-json`, `language-html`, `language-css`, `language-diff`.

Loader pattern (put in the page footer, after the body content):

```html
<link id="hljs-light" rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/github.min.css">
<link id="hljs-dark"  rel="stylesheet" href="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/styles/github-dark.min.css" disabled>
<script src="https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/highlight.min.js"></script>
<script>
(function () {
  if (!document.querySelector('pre > code[class*="language-"]')) return
  function applyTheme(t) {
    document.getElementById('hljs-light').disabled = (t === 'dark')
    document.getElementById('hljs-dark').disabled  = (t !== 'dark')
  }
  hljs.highlightAll()
  applyTheme(document.documentElement.dataset.theme || 'light')
  document.addEventListener('np:theme-change', (e) => applyTheme(e.detail.theme))
})()
</script>
```

Don't load the script if no `<pre><code>` is on the page (early return above).

## `diff` — `<div class="diff" data-file="…">`

Unified-diff block. CSS-only rendering: each non-empty line gets a class via a tiny first-party parser. **No CDN.** Optional `data-file` renders a path header.

```html
<div class="diff" data-file="src/auth/middleware.ts">
@@ -1,4 +1,7 @@
 import type { Request } from 'fastify'
-import { loadSession } from './sessions'
+import { verify } from './jwt'
+import { loadSession } from './sessions' // legacy fallback
</div>
```

Required CSS (in the main `<style>` block):

```css
.diff {
  font-family: var(--np-mono);
  font-size: 12.5px;
  line-height: 1.5;
  background: var(--np-bg-soft);
  border: 1px solid var(--np-border);
  border-radius: var(--np-radius);
  overflow: hidden;
}
.diff[data-file]::before {
  content: attr(data-file);
  display: block;
  padding: 8px 12px;
  background: var(--np-bg);
  border-bottom: 1px solid var(--np-border);
  font-weight: 600;
}
.diff .line          { display:block; padding:0 12px; white-space:pre; }
.diff .line.hunk     { color: var(--np-text-muted); background: var(--np-bg); }
.diff .line.add      { background: var(--np-add-bg); color: var(--np-add-text); }
.diff .line.add::before { content: '+ '; opacity: .7; }
.diff .line.del      { background: var(--np-del-bg); color: var(--np-del-text); }
.diff .line.del::before { content: '- '; opacity: .7; }
.diff .line.ctx::before { content: '  '; }
```

Parser (runs once on `DOMContentLoaded`):

```js
document.querySelectorAll('.diff').forEach((el) => {
  const raw = el.textContent.trimEnd()
  el.innerHTML = raw.split('\n').map((l) => {
    const cls = l.startsWith('@@') ? 'hunk'
              : l.startsWith('+')  ? 'add'
              : l.startsWith('-')  ? 'del'
              : 'ctx'
    const body = cls === 'add' || cls === 'del' ? l.slice(1) : l
    return `<span class="line ${cls}">${body.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</span>`
  }).join('')
})
```

**Escape `<` / `>` in diff content** if your diff actually contains angle brackets (TSX, JSX, generics). Otherwise the browser parses them as tags.

## `file-tree` — `<div class="file-tree">`

Impacted-files tree with CREATE / EDIT / DELETE intent badges. Pure HTML, pure CSS. Use it for the blast-radius view in plans, audits, and code reviews.

```html
<div class="file-tree">
  <ul>
    <li class="dir">src/
      <ul>
        <li class="file">auth.ts <span class="action edit">EDIT</span></li>
        <li class="file">jwt.ts  <span class="action create">CREATE</span></li>
        <li class="file">legacy-session.ts <span class="action delete">DELETE</span></li>
      </ul>
    </li>
    <li class="file">tests/auth.test.ts <span class="action edit">EDIT</span></li>
  </ul>
</div>
```

Required CSS:

```css
.file-tree { font-family: var(--np-mono); font-size: 13px; line-height: 1.7; }
.file-tree ul { list-style: none; margin: 0; padding-left: 18px; }
.file-tree > ul { padding-left: 0; }
.file-tree li { position: relative; }
.file-tree li::before {
  position: absolute; left: -14px; color: var(--np-text-muted);
}
.file-tree li.dir::before  { content: '▸'; }
.file-tree li.file::before { content: '·'; }
.file-tree .action {
  display: inline-block;
  margin-left: 8px;
  padding: 1px 6px;
  font-size: 10px;
  font-weight: 700;
  border-radius: 3px;
  letter-spacing: .04em;
}
.file-tree .action.create { background: var(--np-add-bg);  color: var(--np-add-text);  border:1px solid var(--np-add-border); }
.file-tree .action.edit   { background: var(--np-edit-bg); color: var(--np-edit-text); border:1px solid var(--np-edit-border); }
.file-tree .action.delete { background: var(--np-del-bg);  color: var(--np-del-text);  border:1px solid var(--np-del-border); }
```

The tree replaces the prose answer to "which files does this touch". One `file-tree` per plan, near the top.

## `pill` — `<span class="pill">`

Inline status indicator. Generalized from the severity badge previously embedded in `risk-grid` — usable anywhere a 1-word semantic tag fits (header meta, table cells, inline annotations).

```html
<span class="pill">neutral</span>
<span class="pill success">low risk</span>
<span class="pill warn">touches prod data</span>
<span class="pill danger">irreversible</span>
<span class="pill accent">recommandé</span>
```

Required CSS:

```css
.pill {
  display: inline-block;
  padding: 1px 8px;
  font-size: 11px;
  font-weight: 600;
  line-height: 1.6;
  border-radius: 999px;
  border: 1px solid var(--np-border);
  background: var(--np-bg-soft);
  color: var(--np-text-muted);
  letter-spacing: .01em;
  white-space: nowrap;
}
.pill.success { background: var(--np-add-bg);    color: var(--np-add-text);  border-color: var(--np-add-border); }
.pill.warn    { background: var(--np-edit-bg);   color: var(--np-edit-text); border-color: var(--np-edit-border); }
.pill.danger  { background: var(--np-del-bg);    color: var(--np-del-text);  border-color: var(--np-del-border); }
.pill.accent  { background: var(--np-accent-bg); color: var(--np-accent);    border-color: var(--np-accent); }
```

Use sparingly. Pills used as decoration become noise; pills used as semantic tags carry information.

## `mermaid` — `<div class="mermaid">`

Auto-laid-out flowcharts / sequences / state diagrams via **Mermaid** (CDN, version-pinned). Use Mermaid when the value is layout *automation* — flows with >4 nodes, branching with merge points, sequences with N participants. For everything where you want pixel-perfect layout control, stay on `.diag-*` (see `./diagrams.md`).

```html
<div class="mermaid">
graph LR
  A[Request] --> B{Bearer token?}
  B -- yes --> C[Verify JWT]
  B -- no  --> D[401]
  C --> E[Proceed]
</div>
```

Loader (page footer, lazy):

```html
<script type="module">
  if (document.querySelector('.mermaid')) {
    const mod = await import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs')
    const mermaid = mod.default
    function themed(t) {
      mermaid.initialize({
        startOnLoad: false,
        theme: t === 'dark' ? 'dark' : 'default',
        themeVariables: {
          primaryColor:       'var(--np-accent-bg)',
          primaryTextColor:   'var(--np-text)',
          primaryBorderColor: 'var(--np-accent)',
          lineColor:          'var(--np-text-muted)',
          fontFamily:         'var(--np-sans)',
        },
      })
      mermaid.run({ querySelector: '.mermaid' })
    }
    themed(document.documentElement.dataset.theme || 'light')
    document.addEventListener('np:theme-change', (e) => {
      document.querySelectorAll('.mermaid').forEach((el) => {
        const src = el.getAttribute('data-source') || el.textContent
        el.removeAttribute('data-processed')
        el.setAttribute('data-source', src)
        el.textContent = src
      })
      themed(e.detail.theme)
    })
  }
</script>
```

**One diagram per concept.** Don't decorate. If the Mermaid source has fewer than 4 nodes and no branching, a `.diag-flow` is sharper.

## Block roles, side by side

| Block | Role | Picks |
|---|---|---|
| `code-block` | Verbatim code, syntax-highlighted | When the snippet is the design decision |
| `diff` | Before/after change | When the diff *is* the deliverable |
| `file-tree` | Impacted-files blast radius | Every plan with >2 files touched |
| `pill` | Inline semantic tag | Severity, status, recommendation |
| `mermaid` | Auto-laid-out flow / sequence | Branching flows >4 nodes, sequences |
| `.diag-*` | Pixel-controlled custom layout | Compare, stack, kinds, pool, timeline (see `./diagrams.md`) |
