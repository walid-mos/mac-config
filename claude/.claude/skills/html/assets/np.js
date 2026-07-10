/* ============================================================
   np.js — NextNode HTML deliverables runtime
   Inlined at end of <body> by scripts/build.sh.
   Every module is a no-op when its target markup is absent.
   Zero CDN except lazy-loaded highlight.js / mermaid, and only
   when the page actually contains their target blocks.
   ============================================================ */
(function () {
  'use strict';
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };

  /* ---------- 1. theme toggle (button auto-injected; anti-FOUC ran in <head>) ---------- */
  var toggle = document.createElement('button');
  toggle.className = 'np-theme-toggle';
  toggle.type = 'button';
  toggle.setAttribute('aria-label', 'Toggle theme');
  function paintToggle() {
    toggle.textContent = (document.documentElement.getAttribute('data-theme') === 'dark') ? '☀' : '☾';
  }
  paintToggle();
  toggle.addEventListener('click', function () {
    var next = (document.documentElement.getAttribute('data-theme') === 'dark') ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('np-theme', next); } catch (e) {}
    paintToggle();
    document.dispatchEvent(new CustomEvent('np:theme-change', { detail: { theme: next } }));
  });
  document.body.appendChild(toggle);

  /* ---------- 2. arrows — empty .arrow spans get the canonical SVG ---------- */
  var ARROW = '<svg width="34" height="10" viewBox="0 0 34 10" aria-hidden="true"><line x1="0" y1="5" x2="26" y2="5" stroke="currentColor" stroke-width="1.5"/><path d="M26 1 L32 5 L26 9 Z" fill="currentColor"/></svg>';
  var ARROW_DASHED = '<svg width="34" height="10" viewBox="0 0 34 10" aria-hidden="true"><line x1="0" y1="5" x2="26" y2="5" stroke="currentColor" stroke-width="1.5" stroke-dasharray="4 3"/><path d="M26 1 L32 5 L26 9 Z" fill="currentColor"/></svg>';
  $$('.arrow').forEach(function (el) {
    if (el.textContent.trim() === '') el.innerHTML = el.classList.contains('dashed') ? ARROW_DASHED : ARROW;
  });

  /* ---------- 3. navigation — scrollspy sidebar OR multipage router ----------
     scroll mode : anchor links + scrollspy. Short / sequential docs.
     pages mode  : each domain (section[data-group]) — or each section when
                   no groups — becomes a swappable page. The sidebar is a
                   router, not a scrollbar: one viewport per view, no long
                   scroll. Auto-on when any section carries data-group or
                   there are >=6 sections; force with body[data-nav].         */
  (function () {
    var layout = $('.layout'), main = $('.main'), aside = $('.sidebar');
    if (!layout || !main || !aside) return;
    var secs = $$(':scope > section[id]', main).filter(function (s) { return s.querySelector('h2'); });
    var want = document.body.getAttribute('data-sidebar');   // on | off | (auto)
    var navAttr = document.body.getAttribute('data-nav');    // pages | scroll | (auto)
    if (want === 'off') return;
    var hasGroups = secs.some(function (s) { return s.getAttribute('data-group'); });
    var paged = navAttr === 'pages' || (navAttr !== 'scroll' && hasGroups);  // domains drive multipage
    if (!paged && want !== 'on' && secs.length < 6) return;   // tiny scroll doc: no chrome

    var brand = document.body.getAttribute('data-brand') || 'NextNode';
    function secTitle(s) {
      var h = s.querySelector('h2').cloneNode(true);
      var n = h.querySelector('.num'); if (n) n.remove();
      return h.textContent.trim();
    }
    function slug(s) {
      return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    var head = '<div class="brand">' + esc(brand) + '<span class="dot">.</span></div>'
             + '<div class="sub">' + esc(document.title) + '</div>';

    /* ---- scroll mode ---- */
    if (!paged) {
      layout.classList.add('has-sidebar');
      var html = head + '<nav>';
      secs.forEach(function (s, i) {
        html += '<a href="#' + s.id + '"><span class="n">' + String(i + 1).padStart(2, '0') + '</span>' + esc(secTitle(s)) + '</a>';
      });
      aside.innerHTML = html + '</nav>';
      var links = $$('nav a', aside), map = {};
      links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
      var obs = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (l) { l.classList.remove('active'); });
          if (map[e.target.id]) map[e.target.id].classList.add('active');
        });
      }, { rootMargin: '-20% 0px -70% 0px' });
      secs.forEach(function (s) { obs.observe(s); });
      return;
    }

    /* ---- pages mode: partition main's children into pages ----
       A section with data-group joins/continues that group's page; a run
       of same-group sections is one page. Sections without a group are one
       page each. The header + any loose intro blocks (tldr, strip) become
       the first "overview" page. style/script stay global (unwrapped).      */
    var pages = [], cur = null, curKey = null;
    $$(':scope > *', main).forEach(function (node) {
      var tag = node.tagName;
      if (tag === 'STYLE' || tag === 'LINK') return;
      if (tag === 'SCRIPT' && node.getAttribute('data-np') !== 'board') return;
      if (tag === 'SECTION' && node.id && node.querySelector('h2')) {
        var g = node.getAttribute('data-group');
        var key = g || ('__' + node.id);
        if (!cur || key !== curKey) { cur = { label: g || secTitle(node), group: g, nodes: [], sections: [] }; curKey = key; pages.push(cur); }
        cur.sections.push(node); cur.nodes.push(node);
      } else {
        if (!cur) { cur = { label: '', group: null, nodes: [], sections: [] }; curKey = '__intro'; pages.push(cur); }
        cur.nodes.push(node);
      }
    });
    if (pages.length < 2) return;   // nothing to page — leave as plain scroll
    layout.classList.add('has-sidebar');
    document.body.classList.add('np-paged');

    var seen = {};
    pages.forEach(function (p, i) {
      if (!p.label) { var h1 = p.nodes.map(function (n) { return n.querySelector ? n.querySelector('h1') : null; }).filter(Boolean)[0]; p.label = h1 ? h1.textContent.trim() : 'Aperçu'; }
      var base = 'page-' + (slug(p.label) || (i + 1)), id = base, k = 2;
      while (seen[id]) id = base + '-' + (k++);
      seen[id] = 1; p.id = id;
      var wrap = document.createElement('div');
      wrap.className = 'np-page'; wrap.id = id;
      p.nodes[0].parentNode.insertBefore(wrap, p.nodes[0]);
      p.nodes.forEach(function (n) { wrap.appendChild(n); });
      p.el = wrap;
    });

    var nhtml = head + '<nav class="np-router">';
    pages.forEach(function (p, i) {
      nhtml += '<a class="pg" href="#' + p.id + '" data-page="' + p.id + '"><span class="n">' + String(i + 1).padStart(2, '0') + '</span>' + esc(p.label) + '</a>';
      if (p.sections.length > 1) {
        nhtml += '<div class="subs">';
        p.sections.forEach(function (s) { nhtml += '<a class="sub" href="#' + s.id + '" data-page="' + p.id + '" data-sec="' + s.id + '">' + esc(secTitle(s)) + '</a>'; });
        nhtml += '</div>';
      }
    });
    aside.innerHTML = nhtml + '</nav>';

    pages.forEach(function (p, i) {
      var f = document.createElement('nav'); f.className = 'np-page-nav';
      f.innerHTML = (i > 0 ? '<a class="prev" href="#' + pages[i - 1].id + '" data-page="' + pages[i - 1].id + '"><span class="hint">Précédent</span>' + esc(pages[i - 1].label) + '</a>' : '<span></span>')
                  + (i < pages.length - 1 ? '<a class="next" href="#' + pages[i + 1].id + '" data-page="' + pages[i + 1].id + '"><span class="hint">Suivant</span>' + esc(pages[i + 1].label) + '</a>' : '<span></span>');
      p.el.appendChild(f);
    });

    var byId = {}; pages.forEach(function (p) { byId[p.id] = p; });
    var pgLinks = $$('a.pg[data-page]', aside);
    function show(id, secId, push) {
      var p = byId[id] || pages[0]; id = p.id;
      pages.forEach(function (q) { q.el.classList.toggle('active', q === p); });
      pgLinks.forEach(function (a) { a.classList.toggle('active', a.getAttribute('data-page') === id); });
      if (push !== false) { try { history.replaceState(null, '', '#' + (secId || id)); } catch (e) {} }
      var target = secId && document.getElementById(secId);
      if (target) target.scrollIntoView({ block: 'start' }); else window.scrollTo(0, 0);
      document.dispatchEvent(new CustomEvent('np:tab-shown', { detail: { panel: p.el } }));
      document.dispatchEvent(new CustomEvent('np:page-shown', { detail: { page: p.el, id: id } }));
    }
    function resolve() {
      var h = location.hash.slice(1);
      if (byId[h]) return show(h, null, false);
      var el = h && document.getElementById(h);
      var wrap = el && el.closest('.np-page');
      if (wrap) return show(wrap.id, h, false);
      show(pages[0].id, null, false);
    }
    document.addEventListener('click', function (ev) {
      var a = ev.target.closest('a[data-page]'); if (!a) return;
      ev.preventDefault();
      show(a.getAttribute('data-page'), a.getAttribute('data-sec') || null, true);
    });
    window.addEventListener('hashchange', resolve);
    resolve();
  })();

  /* ---------- 4. code-block heads — built from data-file / data-lang ---------- */
  $$('figure.code-block').forEach(function (fig) {
    if (fig.querySelector('.code-block__head')) {
      if (!fig.querySelector('.code-block__copy')) {
        var head = fig.querySelector('.code-block__head');
        var b = document.createElement('button');
        b.className = 'code-block__copy'; b.type = 'button'; b.textContent = 'Copy';
        head.appendChild(b);
      }
      return;
    }
    var cap = document.createElement('figcaption');
    cap.className = 'code-block__head';
    var file = fig.getAttribute('data-file');
    var lang = fig.getAttribute('data-lang')
            || (fig.querySelector('code[class*="language-"]') || { className: '' }).className.replace(/.*language-(\w+).*/, '$1');
    cap.innerHTML = (file ? '<span class="code-block__file"></span>' : '<span class="code-block__file" style="opacity:.5">snippet</span>')
                  + (lang ? '<span class="code-block__lang"></span>' : '')
                  + '<button class="code-block__copy" type="button" aria-label="Copy code">Copy</button>';
    if (file) cap.querySelector('.code-block__file').textContent = file;
    if (lang) cap.querySelector('.code-block__lang').textContent = lang;
    fig.insertBefore(cap, fig.firstChild);
  });
  function flashCopied(btn, label) {
    var prev = btn.textContent;
    btn.textContent = label || 'Copié ✓';
    btn.classList.add('is-copied');
    setTimeout(function () { btn.textContent = prev; btn.classList.remove('is-copied'); }, 1300);
  }
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest('.code-block__copy');
    if (!btn) return;
    var code = btn.closest('.code-block');
    code = code && code.querySelector('pre code');
    if (!code) return;
    navigator.clipboard.writeText(code.innerText).then(function () { flashCopied(btn, 'Copied'); }).catch(function () {});
  });

  /* ---------- 5. diff parser ---------- */
  $$('.diff').forEach(function (el) {
    var raw = el.textContent.replace(/^\n/, '').trimEnd();
    el.innerHTML = raw.split('\n').map(function (l) {
      var cls = l.indexOf('@@') === 0 ? 'hunk' : l.charAt(0) === '+' ? 'add' : l.charAt(0) === '-' ? 'del' : 'ctx';
      var body = (cls === 'add' || cls === 'del') ? l.slice(1) : l;
      return '<span class="line ' + cls + '">' + esc(body) + '</span>';
    }).join('');
  });

  /* ---------- 5b. tabs — <div class="tabs" data-np="tabs"> ----------
     Children carry data-tab="Label"; the runtime builds the tab-list.
     data-active on a child preselects it (default: first). Without JS
     the panels stack, labelled via CSS ::before.                      */
  $$('.tabs[data-np="tabs"]').forEach(function (box) {
    var panels = $$(':scope > [data-tab]', box);
    if (!panels.length) return;
    var list = document.createElement('div');
    list.className = 'tab-list';
    list.setAttribute('role', 'tablist');
    var btns = panels.map(function (p, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'tab-btn';
      b.setAttribute('role', 'tab');
      b.textContent = p.getAttribute('data-tab');
      b.addEventListener('click', function () { activate(i); });
      list.appendChild(b);
      p.setAttribute('role', 'tabpanel');
      return b;
    });
    function activate(i) {
      panels.forEach(function (p, j) {
        p.classList.toggle('active', j === i);
        btns[j].classList.toggle('active', j === i);
        btns[j].setAttribute('aria-selected', j === i ? 'true' : 'false');
      });
      document.dispatchEvent(new CustomEvent('np:tab-shown', { detail: { panel: panels[i] } }));
    }
    list.addEventListener('keydown', function (ev) {
      if (ev.key !== 'ArrowLeft' && ev.key !== 'ArrowRight') return;
      var cur = btns.indexOf(document.activeElement);
      if (cur < 0) return;
      var next = (cur + (ev.key === 'ArrowRight' ? 1 : btns.length - 1)) % btns.length;
      btns[next].focus();
      activate(next);
    });
    box.insertBefore(list, box.firstChild);
    box.classList.add('tabs-ready');
    var pre = panels.filter(function (p) { return p.hasAttribute('data-active'); });
    activate(pre.length ? panels.indexOf(pre[0]) : 0);
  });

  /* ---------- 6. generic copy buttons ----------
     <button class="copy-btn" data-copy="#selector">  → copies innerText of target
     <button class="copy-btn" data-copy-text="...">   → copies the literal payload   */
  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest('[data-copy], [data-copy-text]');
    if (!btn) return;
    var txt = btn.getAttribute('data-copy-text');
    if (txt == null) {
      var target = $(btn.getAttribute('data-copy'));
      if (!target) return;
      txt = target.innerText;
    }
    navigator.clipboard.writeText(txt).then(function () { flashCopied(btn); }).catch(function () {});
  });

  /* ---------- 7. highlight.js — lazy CDN, only if a language-tagged block exists ---------- */
  (function () {
    if (!$('pre > code[class*="language-"]')) return;
    var base = 'https://cdn.jsdelivr.net/gh/highlightjs/cdn-release@11/build/';
    ['light', 'dark'].forEach(function (t) {
      var l = document.createElement('link');
      l.id = 'hljs-' + t; l.rel = 'stylesheet';
      l.href = base + 'styles/atom-one-' + t + '.min.css';
      document.head.appendChild(l);
    });
    function applyTheme(t) {
      $('#hljs-light').disabled = (t === 'dark');
      $('#hljs-dark').disabled = (t !== 'dark');
    }
    var s = document.createElement('script');
    s.src = base + 'highlight.min.js';
    s.onload = function () {
      window.hljs.highlightAll();
      applyTheme(document.documentElement.getAttribute('data-theme') || 'light');
    };
    document.head.appendChild(s);
    document.addEventListener('np:theme-change', function (e) { if (window.hljs) applyTheme(e.detail.theme); });
  })();

  /* ---------- 8. mermaid — lazy CDN, only if a .mermaid block exists ---------- */
  (function () {
    if (!$('.mermaid')) return;
    import('https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs').then(function (mod) {
      var mermaid = mod.default;
      function themed(t) {
        mermaid.initialize({
          startOnLoad: false,
          theme: t === 'dark' ? 'dark' : 'default',
          themeVariables: { fontFamily: 'DM Sans, sans-serif' }
        });
        mermaid.run({ querySelector: '.mermaid' });
      }
      themed(document.documentElement.getAttribute('data-theme') || 'light');
      document.addEventListener('np:theme-change', function (e) {
        $$('.mermaid').forEach(function (el) {
          var src = el.getAttribute('data-source') || el.textContent;
          el.removeAttribute('data-processed');
          el.setAttribute('data-source', src);
          el.textContent = src;
        });
        themed(e.detail.theme);
      });
      /* diagrams rendered while their tab was hidden have a broken size — re-render on first show */
      document.addEventListener('np:tab-shown', function (e) {
        var stale = $$('.mermaid', e.detail.panel).filter(function (el) {
          var svg = el.querySelector('svg');
          return svg && svg.getBoundingClientRect().width === 0;
        });
        if (!stale.length) return;
        stale.forEach(function (el) {
          var src = el.getAttribute('data-source') || el.textContent;
          el.removeAttribute('data-processed');
          el.setAttribute('data-source', src);
          el.textContent = src;
        });
        mermaid.run({ nodes: stale });
      });
    }).catch(function () {});
  })();

  /* ---------- 9. board — rendered from a JSON data-island ----------
     script[type="application/json"][data-np="board"] containing
     {"columns":["Now","Next"], "cards":[{id,title,desc?,tags?,col}]}
     Drag cards between columns; export as markdown or JSON.
     NOTE: this file is inlined inside a script tag — never write a
     literal closing script tag anywhere in it, comments included.  */
  $$('script[type="application/json"][data-np="board"]').forEach(function (island, bi) {
    var data;
    try { data = JSON.parse(island.textContent); } catch (e) { return; }
    var wrap = document.createElement('div');
    var board = document.createElement('div');
    board.className = 'board';
    var byId = {};
    (data.cards || []).forEach(function (c) { byId[c.id] = c; });
    data.columns.forEach(function (col) {
      var bcol = document.createElement('div');
      bcol.className = 'bcol';
      bcol.setAttribute('data-col', col);
      bcol.innerHTML = '<h4><span>' + esc(col) + '</span><span class="cnt"></span></h4>';
      (data.cards || []).filter(function (c) { return c.col === col; }).forEach(function (c) {
        bcol.appendChild(renderCard(c));
      });
      bcol.addEventListener('dragover', function (ev) { ev.preventDefault(); bcol.classList.add('drag-over'); });
      bcol.addEventListener('dragleave', function () { bcol.classList.remove('drag-over'); });
      bcol.addEventListener('drop', function (ev) {
        ev.preventDefault();
        bcol.classList.remove('drag-over');
        var id = ev.dataTransfer.getData('text/plain');
        var card = board.querySelector('[data-id="' + id + '"]');
        if (card) { bcol.appendChild(card); if (byId[id]) byId[id].col = col; counts(); }
      });
      board.appendChild(bcol);
    });
    function renderCard(c) {
      var el = document.createElement('div');
      el.className = 'bcard';
      el.draggable = true;
      el.setAttribute('data-id', c.id);
      el.innerHTML = '<div class="ttl"></div>'
        + (c.desc ? '<div class="desc"></div>' : '')
        + (c.tags && c.tags.length ? '<div class="tags">' + c.tags.map(function (t) { return '<span class="pill mono">' + esc(t) + '</span>'; }).join('') + '</div>' : '');
      el.querySelector('.ttl').textContent = c.title;
      if (c.desc) el.querySelector('.desc').textContent = c.desc;
      el.addEventListener('dragstart', function (ev) { ev.dataTransfer.setData('text/plain', c.id); });
      return el;
    }
    function counts() {
      $$('.bcol', board).forEach(function (bcol) {
        bcol.querySelector('.cnt').textContent = $$('.bcard', bcol).length;
      });
    }
    function state() {
      return data.columns.map(function (col) {
        var bcol = board.querySelector('[data-col="' + col + '"]');
        return { column: col, cards: $$('.bcard', bcol).map(function (el) { return byId[el.getAttribute('data-id')]; }) };
      });
    }
    var actions = document.createElement('div');
    actions.className = 'board-actions';
    actions.innerHTML = '<button class="copy-btn" type="button" data-board-md>Copier en markdown</button>'
                      + '<button class="copy-btn" type="button" data-board-json>Copier en JSON</button>';
    actions.querySelector('[data-board-md]').addEventListener('click', function (ev) {
      var md = state().map(function (g) {
        return '## ' + g.column + '\n' + g.cards.map(function (c) { return '- ' + c.title + (c.desc ? ' — ' + c.desc : ''); }).join('\n');
      }).join('\n\n');
      navigator.clipboard.writeText(md).then(function () { flashCopied(ev.target); }).catch(function () {});
    });
    actions.querySelector('[data-board-json]').addEventListener('click', function (ev) {
      navigator.clipboard.writeText(JSON.stringify(state(), null, 2)).then(function () { flashCopied(ev.target); }).catch(function () {});
    });
    wrap.appendChild(board);
    wrap.appendChild(actions);
    island.parentNode.replaceChild(wrap, island);
    counts();
    window.__npBoards = window.__npBoards || [];
    window.__npBoards[bi] = state;
  });

  /* ---------- 10. rich mode — <body data-mode="rich"> ----------
     Auto-instruments prose as contenteditable (outside skip-zones),
     collects forms .rich-question, [data-token] inputs, boards and
     edits, then POSTs to ./submit with approval_mode. Approve and
     Reject map to explicit next-action contracts for Claude.      */
  (function () {
    if (document.body.getAttribute('data-mode') !== 'rich') return;
    var SKIP = 'pre, table, .mermaid, .diff, .file-tree, .diagram, .mockup, form, .static, [contenteditable]';
    $$('section p, section li').forEach(function (el) {
      if (el.closest(SKIP)) return;
      el.setAttribute('contenteditable', 'true');
      el.setAttribute('data-np-orig', el.innerText);
      el.addEventListener('input', function () {
        el.setAttribute('data-np-edited', el.innerText !== el.getAttribute('data-np-orig') ? '1' : '0');
      });
    });
    function collectState() {
      var out = { decisions: {}, edits: {}, tokens: {}, freeform: '' };
      $$('form.rich-question').forEach(function (f, i) {
        var id = f.getAttribute('data-question-id') || (f.querySelector('[name]') || {}).name || 'q' + (i + 1);
        var radios = $$('input[type="radio"]:checked', f).map(function (r) { return r.value; });
        var checks = $$('input[type="checkbox"]:checked', f).map(function (c) { return c.value; });
        var text = $$('textarea', f).map(function (t) { return t.value.trim(); }).filter(Boolean).join('\n');
        var v = {};
        if (radios.length) v.choice = radios[0];
        if (checks.length) v.choices = checks;
        if (text) v.freetext = text;
        out.decisions[id] = v;
      });
      $$('[data-np-edited="1"]').forEach(function (el, i) {
        var id = el.id || (el.closest('section[id]') || {}).id || 'edit';
        out.edits[id + '/' + i] = el.innerText;
      });
      $$('[data-token]').forEach(function (inp) { out.tokens[inp.getAttribute('data-token')] = inp.value; });
      var ff = $('[data-freeform]');
      if (ff && ff.value.trim()) out.freeform = ff.value.trim();
      if (window.__npBoards) out.boards = window.__npBoards.map(function (fn) { return fn(); });
      return out;
    }
    function submit(mode) {
      var payload = collectState();
      payload.approval_mode = mode;
      fetch('./submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }).then(function (res) {
        if (!res.ok) throw new Error('submit failed');
        document.body.innerHTML = '<main style="padding:4rem;font-family:var(--np-sans)"><h1>✓ ' + (mode === 'rejected' ? 'Rejected' : 'Submitted') + '</h1><p>Return to Claude — you can close this tab.</p></main>';
      }).catch(function () {
        navigator.clipboard.writeText(JSON.stringify(payload, null, 2)).catch(function () {});
        alert('Pas de serveur ./submit — la submission JSON a été copiée dans le presse-papier, colle-la dans Claude.');
      });
    }
    var gate = document.createElement('footer');
    gate.className = 'rp-gate';
    gate.innerHTML = '<span class="rp-progress" aria-live="polite"></span>'
                   + '<button type="button" class="np-btn ghost" id="rp-reject">Reject</button>'
                   + '<button type="button" class="np-btn primary" id="rp-approve">Approve</button>';
    document.body.appendChild(gate);
    $('#rp-approve').addEventListener('click', function () { submit('approved'); });
    $('#rp-reject').addEventListener('click', function () { submit('rejected'); });

    /* ---- questions: pre-pick the recommendation, scannable overview, live
            progress. Answering becomes "review the defaults, override the few
            you disagree with" instead of "fill N blank forms". ---- */
    var main = $('.main');
    var qs = $$('form.rich-question');
    function answerOf(f) {
      var picks = $$('input:checked', f).map(function (inp) {
        var l = inp.closest('label'); var n = l && l.querySelector('.cax-name');  // compare-axes: read only the option name
        return ((n || l || inp).textContent || inp.value).trim();
      });
      var notes = $$('textarea', f).map(function (t) { return t.value.trim(); }).filter(Boolean);
      return picks.concat(notes).join(' · ') || '—';
    }
    qs.forEach(function (f, i) {
      f.setAttribute('data-qn', i + 1);
      if (!f.id) f.id = 'rq-' + (f.getAttribute('data-question-id') || (i + 1));
      var rec = $('label.opt[data-recommended] input', f);
      if (rec && !$$('input:checked', f).length) rec.checked = true;     // land on the reco
    });
    var snapshot = qs.map(answerOf);
    var idxMeta = null, prog = $('.rp-progress', gate), groups = null;
    function buildLi(f, i) {
      var qt = ((f.querySelector('.q') || {}).textContent || ('Décision ' + (i + 1))).trim();
      var li = document.createElement('li');
      li.innerHTML = '<a class="jump" href="#' + f.id + '" data-jump="' + f.id + '"><span class="dot"></span><span class="num">' + (i + 1) + '</span><span class="qt"></span></a><span class="ans"></span>';
      li.querySelector('.qt').textContent = qt;
      f._li = li;
      return li;
    }
    if (qs.length >= 3 && main) {
      var idx = document.createElement('details');
      idx.className = 'rq-index'; idx.open = true;
      idx.innerHTML = '<summary><b>' + qs.length + ' décisions</b> <span class="rq-meta"></span></summary>';
      // group by enclosing section[data-group] (fallback: section h2, then "Décisions")
      groups = []; var gmap = {};
      qs.forEach(function (f, i) {
        var sec = f.closest('section[data-group]') || f.closest('section[id]');
        var h2 = sec && sec.querySelector('h2');
        var key = (sec && sec.getAttribute('data-group')) || (h2 && h2.textContent.trim()) || (sec && sec.id) || 'Décisions';
        if (!gmap[key]) { gmap[key] = { name: key, items: [], meta: null }; groups.push(gmap[key]); }
        gmap[key].items.push({ f: f, i: i });
      });
      if (groups.length < 2) {                       // single domain → flat list
        var ol = document.createElement('ol');
        groups[0].items.forEach(function (it) { ol.appendChild(buildLi(it.f, it.i)); });
        idx.appendChild(ol);
      } else {                                        // many domains → collapsible per-domain index
        var collapsed = qs.length > 14;               // huge interview → folded by default
        groups.forEach(function (g) {
          var d = document.createElement('details');
          d.className = 'rq-group'; if (!collapsed) d.open = true;
          d.innerHTML = '<summary><span class="gname"></span><span class="gcount"></span></summary>';
          d.querySelector('.gname').textContent = g.name;
          var gol = document.createElement('ol');
          g.items.forEach(function (it) { gol.appendChild(buildLi(it.f, it.i)); });
          d.appendChild(gol); idx.appendChild(d);
          g.meta = d.querySelector('.gcount');
        });
      }
      var hdr = main.querySelector('header');
      if (hdr && hdr.parentNode) hdr.parentNode.insertBefore(idx, hdr.nextSibling);
      else main.insertBefore(idx, main.firstChild);
      idxMeta = $('.rq-meta', idx);
      document.addEventListener('click', function (ev) {
        var a = ev.target.closest('a[data-jump]'); if (!a) return;
        var f = document.getElementById(a.getAttribute('data-jump'));
        if (f) f.classList.add('rq-flash'), setTimeout(function () { f.classList.remove('rq-flash'); }, 900);
      });
    }
    function refresh() {
      var changed = 0;
      qs.forEach(function (f, i) {
        var now = answerOf(f), diff = now !== snapshot[i];
        if (diff) changed++;
        if (f._li) { f._li.classList.toggle('changed', diff); f._li.querySelector('.ans').textContent = now; }
      });
      var msg = qs.length + ' décision' + (qs.length > 1 ? 's' : '') + (changed ? ' · ' + changed + ' modifiée' + (changed > 1 ? 's' : '') : ' · toutes sur la reco');
      if (prog) prog.textContent = msg;
      if (idxMeta) idxMeta.textContent = changed ? changed + ' modifiée' + (changed > 1 ? 's' : '') : 'toutes sur la reco';
      if (groups) groups.forEach(function (g) {
        if (!g.meta) return;
        var ch = g.items.reduce(function (n, it) { return n + (answerOf(it.f) !== snapshot[it.i] ? 1 : 0); }, 0);
        g.meta.textContent = g.items.length + (ch ? ' · ' + ch + ' modif.' : '');
      });
    }
    if (qs.length) { document.addEventListener('input', refresh); document.addEventListener('change', refresh); refresh(); }
  })();
})();
