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

  /* ---------- 3. sidebar — auto-generated from section[id] > h2 ---------- */
  (function () {
    var layout = $('.layout');
    var aside = $('.sidebar');
    if (!layout || !aside) return;
    var secs = $$('section[id]').filter(function (s) { return s.querySelector('h2'); });
    var want = document.body.getAttribute('data-sidebar');
    if (want === 'off' || (want !== 'on' && secs.length < 6)) return;
    layout.classList.add('has-sidebar');
    var brand = document.body.getAttribute('data-brand') || 'NextNode';
    var html = '<div class="brand">' + esc(brand) + '<span class="dot">.</span></div>'
             + '<div class="sub">' + esc(document.title) + '</div><nav>';
    secs.forEach(function (s, i) {
      var h = s.querySelector('h2').cloneNode(true);
      var num = h.querySelector('.num'); if (num) num.remove();
      html += '<a href="#' + s.id + '"><span class="n">' + String(i + 1).padStart(2, '0') + '</span>' + esc(h.textContent.trim()) + '</a>';
    });
    aside.innerHTML = html + '</nav>';
    var links = $$('nav a', aside);
    var map = {};
    links.forEach(function (a) { map[a.getAttribute('href').slice(1)] = a; });
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (l) { l.classList.remove('active'); });
        if (map[e.target.id]) map[e.target.id].classList.add('active');
      });
    }, { rootMargin: '-20% 0px -70% 0px' });
    secs.forEach(function (s) { obs.observe(s); });
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
    gate.innerHTML = '<button type="button" class="np-btn ghost" id="rp-reject">Reject</button>'
                   + '<button type="button" class="np-btn primary" id="rp-approve">Approve</button>';
    document.body.appendChild(gate);
    $('#rp-approve').addEventListener('click', function () { submit('approved'); });
    $('#rp-reject').addEventListener('click', function () { submit('rejected'); });
  })();
})();
