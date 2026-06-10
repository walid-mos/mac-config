# Markup vocabulary

Everything below is already styled by `np.css` and wired by `np.js`. Write the markup, the runtime does the rest. The body fragment is content between `<main>` tags — start directly with `<header>` then `<section id="…">`s.

## Header

```html
<header>
  <div class="eyebrow">Audit · mac-config</div>
  <h1>Titre du document</h1>
  <p class="dek">Sous-titre en une phrase.</p>
  <div class="prompt-box"><b>Demande</b> — la formulation de l'utilisateur.</div>
</header>
```

## Prose & scan blocks

```html
<div class="tldr"><p>Résumé 2–4 phrases.</p></div>

<div class="strip">
  <div class="cell"><div class="k">effort</div><div class="v">3<small> j</small></div></div>
  <!-- 3–5 cells -->
</div>

<section id="contexte">
  <h2><span class="num">01</span>Contexte</h2>
  <p class="lead">Chapeau de section.</p>
  <p>Prose…</p>
</section>

<div class="callout"><span class="ttl">Décision</span> Une phrase.</div>  <!-- .warn .danger -->
<span class="pill accent">recommandé</span>  <!-- .success .warn .danger .alt .mono -->

<details class="fold"><summary>Titre repliable</summary><div class="fold-body">…</div></details>
```

## Code, diff, files

```html
<figure class="code-block" data-file="src/auth/jwt.ts" data-lang="ts">
<pre><code class="language-typescript">…code…</code></pre>
</figure>
<!-- header + copy button auto-built from data-file/data-lang -->

<div class="diff" data-file="src/auth/middleware.ts">
@@ -1,4 +1,7 @@
 import type { Request } from 'fastify'
-import { loadSession } from './sessions'
+import { verify } from './jwt'
</div>
<!-- raw unified diff inside; escape &lt; &gt; if content has angle brackets -->

<div class="file-tree"><ul>
  <li class="dir">src/<ul>
    <li class="file">auth.ts <span class="action edit">EDIT</span></li>
    <li class="file">jwt.ts <span class="action create">CREATE</span></li>
  </ul></li>
</ul></div>
```

## Diagrams

Every diagram: `<div class="diagram"><div class="body">…</div><div class="cap">légende</div></div>`.
Empty `<span class="arrow"></span>` auto-fills with the canonical SVG arrow (`.accent .alt .danger .dashed .down`).

```html
<!-- flow -->
<div class="diagram"><div class="body"><div class="flow-row">
  <div class="node">Source<span class="sk">input</span></div>
  <span class="arrow"></span>
  <div class="node primary">Transform</div>
  <span class="arrow accent"></span>
  <div class="node artifact">out.html</div>
</div></div><div class="cap">pipeline de build</div></div>
<!-- node variants: .accent .alt .primary .warning .muted .artifact .term .mono ; .node-stack for vertical -->

<!-- compare A vs B -->
<div class="diag-compare">
  <div class="pane a"><h4>Option A</h4><ul><li>…</li></ul></div>
  <div class="vs">vs</div>
  <div class="pane b"><h4>Option B</h4><ul><li>…</li></ul></div>
</div>

<!-- layered stack -->
<div class="diag-stack">
  <div class="layer pure"><div class="ttl">Core</div><div class="desc">…</div><div class="chips"><span class="chip">a.ts</span></div></div>
  <div class="layer muted"><div class="ttl">Adapters</div></div>
</div>

<!-- tree / hierarchy -->
<div class="diag-tree">
  <div>racine/</div>
  <div class="indent"><span class="key">clé</span> <span class="val">valeur</span></div>
  <div class="indent last out-of-scope">hors scope</div>
</div>

<!-- kinds grid --> <div class="kinds"><div class="kind-card b"><h4>kind</h4><div class="grp"><div class="gh">fields</div><div class="gl"><code>…</code></div></div></div></div>
<!-- pool + refs --> <div class="pool-box"><span class="chip">SECRET_A</span></div><div class="refs-row"><div class="ref-box">target 1</div></div>
<!-- version chips --> <div class="diag-timeline"><span class="ver-tag old">v1</span><span class="arrow"></span><span class="ver-tag bump">v2 breaking</span></div>

<!-- free-form SVG: class="dsvg", semantic classes only (.box .goodbox .badbox .conn .conn-dashed .t-mut .t-acc .t-dan .t-suc .t-txt .ax .disp), viewBox ≤ 560×220 -->

<!-- mermaid (auto-lazy-loaded): flows >4 nodes / branching / sequences -->
<div class="mermaid">graph LR
  A[Request] --> B{Token?}
  B -- yes --> C[Verify]</div>
```

### D2 — real architecture schemas (build-time rendered)

For any non-trivial topology (nested containers, services, data paths, sequence with N participants, SQL schemas), write D2 source — `build.sh` renders it to inline SVG, one light + one dark variant, no CDN, no runtime cost. Opening tag and closing `</div>` each alone on their line.

```html
<div data-np="d2" data-caption="topologie du déploiement">
direction: right
vpc: VPC prod {
  lb: ALB
  app: app-1..2 {shape: rectangle}
  db: Postgres {shape: cylinder}
  lb -> app -> db
}
client -> vpc.lb: https
</div>
```

Attributes (all optional): `data-caption` · `data-sketch` (hand-drawn look) · `data-layout` (default `elk`) · `data-theme-light`/`data-theme-dark` (default `0`/`200`) · `data-pad` (default `8`). The background is forced transparent — the figure surface comes from tokens.

Useful D2 idioms: `direction: right` · containers `a: Label { … }` · `shape: cylinder|page|queue|person|sql_table` · edge labels `a -> b: label` · dashed `a -> b: { style.stroke-dash: 3 }` · sequence diagrams `shape: sequence_diagram`.

**Picking the diagram tool**: `.diag-*` when the *position* of each box carries meaning and there are ≤6 elements; D2 for real architecture / topology / sequences (best layout quality, zero runtime); mermaid only when the doc is also viewed where D2 can't run or for quick 4-node flows. Don't hand-build a flow >4 nodes with branching.

## Tables & comparisons

```html
<div class="ctable">
  <div class="crow head"><div class="axis"></div><div class="ca">Avant</div><div class="cb">Après</div></div>
  <div class="crow"><div class="axis">Axe</div><div class="ca">…</div><div class="cb">…</div></div>
</div>

<div class="twocol">
  <div class="col good"><h4>✅ Ce qui marche</h4><ul><li>…</li></ul></div>
  <div class="col bad"><h4>⚠️ Ce qui coince</h4><ul><li>…</li></ul></div>
</div>

<div class="legend">
  <span class="item"><span class="swatch accent"></span> Nous</span>
  <span class="item"><span class="swatch alt"></span> Eux</span>
</div>
```

## Timeline, risks, next steps

```html
<ul class="timeline">
  <li><div class="when">S1</div><div class="dotcol"></div>
      <div class="body"><div class="ttl">Jalon</div><div class="desc">…</div>
      <div class="tags"><span class="pill mono">feat/x</span></div></div></li>
  <li class="muted">…</li>
</ul>

<div class="risk-grid">
  <div class="risk"><div class="ttl">Risque <span class="pill danger">haut</span></div>
    <div class="desc">…</div><div class="mit">Mitigation.</div></div>
</div>

<div class="next-steps">
  <ul><li><span class="mk">→</span> Étape actionnable</li></ul>
  <button class="copy-btn" type="button" data-copy="#next">Copier</button>
</div>
```

## Mockup tile

```html
<figure class="mockup">
  <div class="mk-bar"><i></i><i></i><i></i></div>
  <div class="mk-body"><!-- mini layout HTML/CSS, tokens only --></div>
  <figcaption>écran proposé</figcaption>
</figure>
```

## Copy / export

```html
<button class="copy-btn" type="button" data-copy="#section-id">Copier la section</button>
<button class="copy-btn" type="button" data-copy-text="texte littéral">Copier le prompt</button>
```

## Board (data-island — runtime renders drag-drop + exports)

```html
<script type="application/json" data-np="board">
{"columns": ["Now", "Next", "Later", "Cut"],
 "cards": [
   {"id": "k1", "title": "Titre", "desc": "Une ligne", "tags": ["perf"], "col": "Now"}
 ]}
</script>
```

## Rich mode (`build.sh -m rich`)

Prose auto-becomes editable; the Approve/Reject gate and submission protocol are injected. You only write the questions:

```html
<form class="rich-question" data-question-id="storage">
  <div class="q">Où stocker les sessions ?</div>
  <div class="recommended">Redis — TTL natif, déjà dans l'infra.</div>
  <label class="opt"><input type="radio" name="storage" value="redis" checked> Redis</label>
  <label class="opt"><input type="radio" name="storage" value="pg"> Postgres</label>
  <label class="opt"><input type="radio" name="storage" value="skip"> Skip · re-grill later</label>
  <textarea placeholder="Note libre (optionnel)"></textarea>
</form>
<!-- checkbox quand les options se combinent ; jamais d'option inventée pour arrondir une liste -->
<!-- exactement un checked par groupe radio ; name distinct par question -->

<input data-token="accent-saturation" type="range" min="0" max="100" value="60">  <!-- tunable -->
<textarea data-freeform placeholder="Notes libres"></textarea>  <!-- one per doc max -->
<p class="static">Paragraphe verrouillé (jamais éditable).</p>
```

Submission shape returned: `{decisions: {id: {choice|choices|freetext}}, edits, tokens, boards, freeform, approval_mode}`.
