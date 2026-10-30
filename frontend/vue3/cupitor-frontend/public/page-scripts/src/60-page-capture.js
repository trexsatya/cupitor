// Page sentence capture: collect sentences from any page — including inside a
// cross-origin e-book reader — and send them to the language webapp as manual
// playlist items.
//
// Rides the caption-capture pipeline: CaptionCollector -> the host -> a
// cupitorCaptionCapture event carrying source:'page'. One validated host path
// and one webapp listener serve both sources.
//
// Publishes window.__cupitorSetCaptureMode(bool) for the app's capture chip,
// window.__cupSelection() for the host's lookup button, and window.__cupPcDiag().

  // ---- Page sentence capture ---------------------------------------------
  //
  // Select text anywhere on the page — including inside a same-origin reader
  // iframe — collect it, and send the collection to the language webapp as
  // manual playlist items.
  //
  // It rides the caption-capture pipeline: CaptionCollector → the host →
  // a cupitorCaptionCapture event carrying source:'page'. So there is one
  // validated host path and one webapp listener for both sources.
  //
  // Deliberately built on the WebView's own text selection rather than on
  // tapping words. Selection needs no DOM mutation, which is what makes it
  // safe on a React-rendered page that rebuilds its nodes underneath us.
  (function pageCapture() {
    // The UI lives in the top frame: a panel rendered inside the reader
    // iframe would be clipped by it. Frames only contribute selections.
    if (window.top !== window) return;
    if (window.__cupPageCaptureInstalled) return;

    // Outside Cupitor there is nowhere to send, so the whole feature stays
    // invisible rather than offering dead controls.
    function canSend() {
      try {
        return !!(window.CaptionCollector &&
                  typeof window.CaptionCollector.postMessage === 'function');
      } catch (_) { return false; }
    }
    if (!canSend()) return;
    if (typeof window.cupInFrames !== 'function') return;
    window.__cupPageCaptureInstalled = true;

    const MIN_CHARS = 2;
    // tapMode is armed from the app's existing capture chip, via
    // __cupitorSetCaptureMode below — no extra floating button in the page.
    // pending / pendingPara are the two granularities offered for the current
    // selection. The raw pick is deliberately NOT among them: it goes to the
    // lookup buffer only. A button labelled "+ Sentence" has to add a sentence.
    const state = { pending: '', pendingPara: '', pendingFrom: null, items: [],
                    open: false, tapMode: false, hint: '' };
    // Bumped on every arm change, so a poller that already consumed a
    // selection re-considers it once the mode changes underneath it.
    let armGen = 0;
    let hintTimer = null;
    let root = null;
    // Where the user dragged the widget to, or null for the default corner.
    const POS_KEY = 'cupPcPos';
    let pos = null;

    // localStorage throws outright in some WebView configurations, so every
    // access is guarded and a failure just means the default corner.
    function loadPos() {
      try {
        const raw = localStorage.getItem(POS_KEY);
        if (!raw) return null;
        const p = JSON.parse(raw);
        if (p && typeof p.left === 'number' && typeof p.top === 'number') return p;
      } catch (_) {}
      return null;
    }

    function savePos() {
      try {
        if (pos) localStorage.setItem(POS_KEY, JSON.stringify(pos));
        else localStorage.removeItem(POS_KEY);
      } catch (_) {}
    }

    // Kept fully on screen. Rotating the device or resizing can otherwise
    // strand the widget outside the viewport with no way to reach it.
    function clampPos(left, top) {
      let w = 120;
      let h = 40;
      try {
        const r = root.getBoundingClientRect();
        if (r.width) w = r.width;
        if (r.height) h = r.height;
      } catch (_) {}
      const maxL = Math.max(4, (window.innerWidth || 320) - w - 4);
      const maxT = Math.max(4, (window.innerHeight || 480) - h - 4);
      return {
        left: Math.min(Math.max(4, left), maxL),
        top: Math.min(Math.max(4, top), maxT),
      };
    }

    function applyPos() {
      if (!root) return;
      if (pos) {
        root.style.left = pos.left + 'px';
        root.style.top = pos.top + 'px';
        root.style.right = 'auto';
        root.style.bottom = 'auto';
      } else {
        root.style.left = '';
        root.style.top = '';
        root.style.right = '';
        root.style.bottom = '';
      }
    }

    // The widget floats over the page, so on a reader it will sooner or later
    // cover the very text being read. Dragging the grip moves it, and the
    // position sticks for this origin.
    function installDrag(handle) {
      let drag = null;
      const begin = (x, y) => {
        let r;
        try { r = root.getBoundingClientRect(); } catch (_) { return; }
        drag = { dx: x - r.left, dy: y - r.top };
      };
      const move = (x, y) => {
        if (!drag) return;
        pos = clampPos(x - drag.dx, y - drag.dy);
        applyPos();
      };
      const end = () => {
        if (drag) savePos();
        drag = null;
      };
      // Touch events stay targeted at the element the gesture STARTED on, so
      // the move handler keeps firing once the finger leaves the grip.
      handle.addEventListener('touchstart', (ev) => {
        const t = ev.touches && ev.touches[0];
        if (!t) return;
        ev.preventDefault();
        ev.stopPropagation();
        begin(t.clientX, t.clientY);
      }, true);
      handle.addEventListener('touchmove', (ev) => {
        const t = ev.touches && ev.touches[0];
        if (!t || !drag) return;
        ev.preventDefault();
        ev.stopPropagation();
        move(t.clientX, t.clientY);
      }, true);
      handle.addEventListener('touchend', (ev) => {
        if (!drag) return;
        ev.preventDefault();
        ev.stopPropagation();
        end();
      }, true);
      handle.addEventListener('mousedown', (ev) => {
        ev.preventDefault();
        ev.stopPropagation();
        begin(ev.clientX, ev.clientY);
        const mm = (e) => move(e.clientX, e.clientY);
        const mu = () => {
          end();
          window.removeEventListener('mousemove', mm, true);
          window.removeEventListener('mouseup', mu, true);
        };
        window.addEventListener('mousemove', mm, true);
        window.addEventListener('mouseup', mu, true);
      }, true);
    }

    // Diagnostics, because there is no console to read inside a cross-origin
    // reader on a phone and "it doesn't work" has at least four distinct
    // causes: the frame agent never ran, arm never arrived, events never
    // reached it, or resolution failed. These counters surface in the app's
    // "Page & frame report".
    //
    // `msgs` is the decisive one: zero means no frame agent ever reached us,
    // so nothing downstream of it is worth reading.
    const topDiag = { msgs: 0, hellos: 0, adds: 0, sels: 0, misses: 0,
                      diags: 0, rejected: 0, ownAdds: 0, ownPolls: 0,
                      ownSel: 0 };
    const frameDiag = {};
    window.__cupPcDiag = () => ({
      armed: state.tapMode,
      items: state.items.length,
      pending: state.pending.slice(0, 60),
      open: state.open,
      top: topDiag,
      frames: frameDiag,
    });

    function ensureUi() {
      if (root) return;
      const st = document.createElement('style');
      st.textContent = `
        .cup-pc { position: fixed; right: 12px; bottom: 12px; z-index: 2147483000;
                  font: 13px/1.35 system-ui, -apple-system, sans-serif;
                  display: flex; flex-direction: column; align-items: flex-end; gap: 6px;
                  /* A page that blanket-disables pointer events must not take
                     our controls with it. */
                  pointer-events: auto; }
        .cup-pc * { pointer-events: auto; }
        /* The HTML hidden attribute works only through the UA stylesheet's
           display:none, which ANY author display rule outranks. .cup-pc-picks
           is display:flex, so setting .hidden on it did nothing at all and its
           buttons sat over the page permanently. Never remove this. */
        .cup-pc [hidden] { display: none !important; }
        .cup-pc button { font: inherit; border: 0; border-radius: 16px; padding: 8px 13px;
                  background: #1f6feb; color: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.35);
                  cursor: pointer; }
        .cup-pc button[data-act="basket"] { background: #444c56; }
        .cup-pc-panel { background: #0d1117; color: #e6edf3; border: 1px solid #30363d;
                  border-radius: 10px; padding: 8px; width: min(78vw, 340px);
                  max-height: 46vh; overflow: auto; box-shadow: 0 4px 18px rgba(0,0,0,.45); }
        .cup-pc-row { display: flex; gap: 6px; align-items: flex-start; padding: 5px 2px;
                  border-bottom: 1px solid #21262d; }
        .cup-pc-row:last-child { border-bottom: 0; }
        /* A picked sentence keeps the line breaks the page gave it, and the
           basket is where the user checks what they are about to send. */
        .cup-pc-row span { flex: 1 1 auto; white-space: pre-wrap !important; }
        .cup-pc-row button { background: transparent; color: #f85149; padding: 0 4px;
                  box-shadow: none; border-radius: 4px; }
        .cup-pc-foot { display: flex; gap: 6px; justify-content: flex-end; padding-top: 6px; }
        .cup-pc-picks { display: flex; gap: 6px; }
        .cup-pc button[data-act="addpara"] { background: #2d6a4f; }
        /* Pushed to the far left of the footer: it is a mode switch, not an
           action, and should not sit next to Clear and Send. */
        .cup-pc button[data-act="tap"] { background: #30363d; margin-right: auto; }
        .cup-pc button[data-act="tap"][data-on="1"] { background: #1f6feb; }
        .cup-pc-empty { opacity: .7; padding: 6px 2px; }
        /* touch-action:none, or the browser scrolls the page instead of
           letting us move the widget. */
        .cup-pc button[data-act="grip"] { background: #21262d; color: #8b949e;
                  padding: 6px 11px; border-radius: 12px; font-size: 15px;
                  line-height: 1; cursor: move; touch-action: none; }
      `;
      (document.head || document.documentElement).appendChild(st);

      root = document.createElement('div');
      root.className = 'cup-pc cup-nolookup';
      root.innerHTML =
        '<div class="cup-pc-panel" hidden>' +
          '<div data-r="list"></div>' +
          '<div class="cup-pc-foot">' +
            '<button data-act="tap"></button>' +
            '<button data-act="clear">Clear</button>' +
            '<button data-act="send">Send</button>' +
          '</div>' +
        '</div>' +
        '<button data-act="basket" hidden></button>' +
        '<div class="cup-pc-picks" hidden>' +
          '<button data-act="add">+ Sentence</button>' +
          '<button data-act="addpara">+ Paragraph</button>' +
        '</div>' +
        // Last, so it sits nearest the anchored corner and is the easiest
        // thing to reach.
        '<button data-act="grip" hidden title="Drag to move">⠿</button>';
      // Into <body>, NOT documentElement. A node parented to <html> outside
      // <body> paints correctly but hit-tests unreliably in Blink, which shows
      // up as a control you can see and cannot tap.
      (document.body || document.documentElement).appendChild(root);

      // Capture phase and touchend as well as click: readers install their own
      // aggressive gesture handlers, and a control that silently does nothing
      // is worse than no control.
      const on = (act, fn) => {
        const el = root.querySelector('[data-act="' + act + '"]');
        if (!el) return;
        const run = (ev) => { ev.preventDefault(); ev.stopPropagation(); fn(); };
        el.addEventListener('click', run, true);
        el.addEventListener('touchend', run, true);
      };
      // Deliberately leaves both the chip and the selection alone.
      //
      // One selection offers two granularities, and tearing the chip down
      // after banking one made the other unreachable: the poller has already
      // consumed that selection, so nothing re-raises it. It was worse from a
      // reader iframe: nothing in the top document can clear a selection
      // across origins, so the text stayed highlighted while its own controls
      // vanished. The chip now goes when the selection does, which is the only
      // moment the screen and the UI agree on.
      const bank = (text) => {
        if (!text) { showHint('nothing to add'); return; }
        if (!collect(text)) { showHint('already collected'); return; }
        state.open = true;
        showHint('added');
      };
      on('add', () => bank(state.pending));
      on('addpara', () => bank(state.pendingPara));
      // The grip is dragged, not tapped, so it gets none of on()'s click
      // wiring — it would fight the drag.
      pos = loadPos();
      applyPos();
      installDrag(root.querySelector('[data-act="grip"]'));
      // A rotation or a resize can leave a saved position off screen, which
      // would strand the widget where nothing can reach it.
      const reclamp = () => {
        if (!pos) return;
        pos = clampPos(pos.left, pos.top);
        applyPos();
      };
      window.addEventListener('resize', reclamp);
      window.addEventListener('orientationchange', reclamp);
      // Tapping words has to be a mode: an unarmed tap must not be swallowed,
      // or ordinary reading breaks. But burying the switch in the app's menu
      // made the feature look dead — a selection raised the chip while a tap
      // did nothing and said nothing. It belongs where the user already is.
      on('tap', () => {
        window.__cupitorSetCaptureMode(!state.tapMode);
        state.open = true;
        sync();
      });
      on('basket', () => { state.open = !state.open; sync(); });
      on('clear', () => { state.items = []; state.open = false; sync(); });
      on('send', send);
    }

    function sync() {
      ensureUi();
      // An SPA that replaces <body> takes our controls with it.
      if (root && !root.isConnected) {
        try { (document.body || document.documentElement).appendChild(root); } catch (_) {}
      }
      const picks = root.querySelector('.cup-pc-picks');
      const basket = root.querySelector('[data-act="basket"]');
      const panel = root.querySelector('.cup-pc-panel');
      picks.hidden = !state.pending;
      // Offered only when it would add something the sentence does not already
      // cover — a one-sentence paragraph needs no second button.
      root.querySelector('[data-act="addpara"]').hidden =
        !state.pendingPara || flat(state.pendingPara) === flat(state.pending);
      // Visible whenever armed, even at zero, so the mode announces itself.
      // Without this an armed page looks identical to an unarmed one until a
      // tap happens to land — and on a reader that eats taps, never.
      // Also shown for a pending selection: without that, a page where only
      // the chip has appeared offers no way to open the panel, and therefore
      // no way to find the Tap words switch inside it.
      // `|| state.open` keeps the invariant that an open panel always has its
      // toggle on screen. Without it, opening the panel and then dropping the
      // selection left the panel up with nothing to close it but Clear.
      basket.hidden = !state.items.length && !state.tapMode && !state.pending
        && !state.open;
      basket.textContent = state.hint
        ? state.hint
        : (state.items.length
            ? (state.tapMode ? '✎ ' : '▤ ') + state.items.length
            : (state.tapMode ? '✎ Tap sentences' : '▤ Basket'));
      const tap = root.querySelector('[data-act="tap"]');
      tap.textContent = (state.tapMode ? '◉' : '○') + ' Tap words';
      tap.dataset.on = state.tapMode ? '1' : '';
      tap.title = state.tapMode
        ? 'On — tapping a word collects its sentence. Tap again to give taps back to the page.'
        : 'Off — tapping a word does nothing. Turn on to collect by tapping.';
      panel.hidden = !state.open;
      // The grip must not become the thing that sits over the page forever —
      // it appears only alongside something worth moving.
      root.querySelector('[data-act="grip"]').hidden =
        picks.hidden && basket.hidden && panel.hidden;
      root.querySelector('[data-act="send"]').disabled = state.items.length === 0;
      const list = root.querySelector('[data-r="list"]');
      if (!panel.hidden) {
        list.textContent = '';
        state.items.forEach((text, i) => {
          const row = document.createElement('div');
          row.className = 'cup-pc-row';
          const span = document.createElement('span');
          span.textContent = text;
          const del = document.createElement('button');
          del.textContent = '✕';
          del.title = 'Remove';
          del.onclick = () => { state.items.splice(i, 1); sync(); };
          row.appendChild(span);
          row.appendChild(del);
          list.appendChild(row);
        });
        if (!state.items.length) {
          list.innerHTML = '<div class="cup-pc-empty">' + (state.tapMode
            ? 'Tap a sentence to collect it. Selecting text works too, where the page allows it.'
            : 'Select text, then tap “+ Add sentence”. To collect by tapping a '
              + 'single word, turn on Tap words below.') + '</div>';
        }
      }
    }

    function caretRangeAt(doc, x, y) {
      try {
        if (doc.caretRangeFromPoint) return doc.caretRangeFromPoint(x, y);
        if (doc.caretPositionFromPoint) {
          const p = doc.caretPositionFromPoint(x, y);
          if (!p) return null;
          const r = doc.createRange();
          r.setStart(p.offsetNode, p.offset);
          r.collapse(true);
          return r;
        }
      } catch (_) {}
      return null;
    }

    // The sentence under a tap, resolved without requiring a selection the
    // user may not be able to make. Blink exposes sentence granularity on
    // Selection.modify, which is exactly this job; the manual split is the
    // fallback for when that is missing or the markup defeats it.
    let lastWhy = '';

    function sentenceAt(doc, win, x, y) {
      // Taps land in line gaps and on padding, where caretRangeFromPoint
      // returns nothing, so probe a little above and below before giving up.
      let sawCaret = false;
      // resolveFrom rewrites the selection on every probe, so a tap that
      // resolves nothing would otherwise leave a stray one-word selection and
      // destroy whatever the user actually had selected.
      let saved = null;
      try {
        const s0 = win.getSelection();
        if (s0 && s0.rangeCount) saved = s0.getRangeAt(0).cloneRange();
      } catch (_) {}
      let found = '';
      for (const dy of [0, -6, 6, -12, 12]) {
        const range = caretRangeAt(doc, x, y + dy);
        if (!range) continue;
        sawCaret = true;
        const t = resolveFrom(win, range);
        if (t) { found = t; break; }
      }
      // ALWAYS, success included. Returning early on success used to leave the
      // selection set to the sentence resolveFrom had fabricated, and the
      // poller then read that back as if the user had selected it — feeding a
      // widened sentence to the host's lookup, which must only ever receive
      // text the user selected. The caller clears deliberately when it banks.
      try {
        const s1 = win.getSelection();
        if (s1) {
          s1.removeAllRanges();
          if (saved) s1.addRange(saved);
        }
      } catch (_) {}
      if (found) return found;
      // 'no caret' means the point is not over addressable text at all — a
      // canvas, an overlay, a shadow root. 'no text' means it is, but nothing
      // resolved. That distinction decides what to try next.
      lastWhy = sawCaret ? 'no text' : 'no caret';
      return '';
    }

    const SENT_RE = /[^.!?…]+[.!?…]*\s*/g;

    function norm(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

    // The same, but keeping the line breaks a selection already carries.
    // Selection.toString() puts a newline where the layout draws one, and on a
    // document that prints each line in its own block — a transcript, a poem,
    // a subtitle export — that break is the text, not formatting.
    function normLines(s) {
      return String(s || '')
        .replace(/\r\n?/g, '\n')
        .split('\n')
        .map((row) => row.replace(/[^\S\n]+/g, ' ').trim())
        .filter(Boolean)
        .join('\n');
    }

    // For comparing two readings of the same text when only the words matter.
    function flat(s) { return norm(String(s || '').replace(/\n/g, ' ')); }

    const NOT_TEXT = /^(?:SCRIPT|STYLE|NOSCRIPT|TEMPLATE)$/;
    const BLOCK_ISH =
      /^(?:ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|BR|DD|DIV|DL|DT|FIELDSET|FIGCAPTION|FIGURE|FOOTER|FORM|H[1-6]|HEADER|HR|LI|MAIN|NAV|OL|P|PRE|SECTION|TABLE|TR|UL)$/;
    const OWN_LINE_DISPLAY =
      /^(?:block|flex|grid|list-item|table|table-row|table-caption|flow-root)$/;

    // One style read per element per walk. This runs inside a 350ms poll, in
    // every document, twice per settled selection.
    let styleCache = null;
    function styleOf(el) {
      if (styleCache && styleCache.has(el)) return styleCache.get(el);
      let cs = null;
      try {
        const win = (el.ownerDocument && el.ownerDocument.defaultView) || window;
        cs = win.getComputedStyle(el);
      } catch (_) { cs = null; }
      if (styleCache) styleCache.set(el, cs);
      return cs;
    }

    // Keeps a box of its own but shares the line with its neighbours — a table
    // cell, an item in a flex row. The reader sees a gap there even when the
    // markup has nothing between them, so the words must not run together.
    function sharesLineOwnBox(el) {
      const cs = styleOf(el);
      const d = cs ? (cs.display || '') : '';
      if (!d) return /^(?:TD|TH|CAPTION)$/.test(el.tagName || '');
      if (d === 'none') return false;
      if (/^table-(?:cell|caption)$/.test(d)) return true;
      // A flex row blockifies its children, so their own display says nothing.
      const ps = el.parentElement ? styleOf(el.parentElement) : null;
      const pd = ps ? (ps.display || '') : '';
      if ((pd === 'flex' || pd === 'inline-flex') && !/^column/.test(ps.flexDirection || '')) {
        return true;
      }
      return false;
    }

    // Does this element start a line where it sits? The layout engine answers
    // first; the tag list is only for when it has nothing to say.
    function startsOwnLine(el) {
      const tag = el.tagName || '';
      const cs = styleOf(el);
      const d = cs ? (cs.display || '') : '';
      if (!d) return BLOCK_ISH.test(tag);
      if (d === 'none') return false;
      if (tag === 'BR') return true;            // no box of its own to report
      if ((cs.cssFloat || cs.float || 'none') !== 'none') return false;
      if (cs.position === 'absolute' || cs.position === 'fixed') return false;
      if (!OWN_LINE_DISPLAY.test(d)) return false;
      // A flex container blockifies its children whatever they are, so a
      // child's own display says nothing about lines: a row of them shares one.
      const ps = el.parentElement ? styleOf(el.parentElement) : null;
      const pd = ps ? (ps.display || '') : '';
      if (pd === 'flex' || pd === 'inline-flex') {
        return /^column/.test(ps.flexDirection || '');
      }
      return true;
    }

    // A block's text as it is READ, plus where a caret sits inside it.
    //
    // textContent cannot be asked this: it drops a <br> entirely and runs two
    // paragraphs together with nothing between them, so a sentence taken out
    // of it can glue the end of one line to the start of the next. This walks
    // the block instead, collapsing the whitespace the layout collapses and
    // keeping a break where the layout draws one.
    //
    // The caret is measured in the SAME pass that builds the text, so the
    // offset is still measured rather than searched for — the property the old
    // Range.toString() arithmetic relied on, and the reason this is safe where
    // matching the selected text against the block would find the wrong
    // occurrence of a repeated word.
    function readBlock(root, stopNode, stopOffset) {
      let text = '';
      let at = -1;
      const last = () => (text ? text[text.length - 1] : '');
      function addBreak() {
        if (!text) return;                       // nothing above it to break
        while (text && last() === ' ') text = text.slice(0, -1);
        if (last() !== '\n') text += '\n';
      }
      // `ws`: 'collapse' (the usual), 'lines' (white-space: pre-line — runs of
      // spaces still collapse, newlines are drawn), or 'keep' (pre, pre-wrap,
      // break-spaces — the text is laid out exactly as written).
      function addText(s, ws) {
        for (let i = 0; i < s.length; i++) {
          const ch = s[i];
          if (ws !== 'collapse' && ch === '\n') { addBreak(); continue; }
          if (ws !== 'keep' && /\s/.test(ch)) {
            if (!text || last() === ' ' || last() === '\n') continue;
            text += ' ';
            continue;
          }
          text += ch;
        }
      }
      function addGap() {
        if (!text || last() === ' ' || last() === '\n') return;
        text += ' ';
      }
      function walk(node) {
        if (node.nodeType === 3) {
          const parent = node.parentElement;
          const cs = parent ? styleOf(parent) : null;
          const white = cs ? (cs.whiteSpace || '') : '';
          // Text nobody can see is not part of the sentence. visibility is
          // inherited but a descendant can turn it back on, so it is asked of
          // the element holding the text rather than of its ancestors.
          if (cs && cs.visibility === 'hidden') return;
          const ws = /^(?:pre|pre-wrap|break-spaces)$/.test(white) ? 'keep'
            : (white === 'pre-line' ? 'lines' : 'collapse');
          const s = String(node.nodeValue || '');
          if (node === stopNode) {
            const cut = Math.max(0, Math.min(Number(stopOffset) || 0, s.length));
            addText(s.slice(0, cut), ws);
            at = text.length;
            addText(s.slice(cut), ws);
          } else {
            addText(s, ws);
          }
          return;
        }
        if (node.nodeType !== 1) return;
        if (NOT_TEXT.test(node.tagName || '')) return;
        const cs = styleOf(node);
        // display:none takes the whole subtree with it; visibility does not,
        // so it is decided per text node above.
        if (cs && cs.display === 'none') return;
        const ownLine = startsOwnLine(node);
        const ownBox = !ownLine && sharesLineOwnBox(node);
        if (ownLine) addBreak();
        if (ownBox) addGap();
        const kids = node.childNodes;
        for (let i = 0; i < kids.length; i++) {
          // A range can point at an element and a child index rather than into
          // a text node.
          if (node === stopNode && i === Number(stopOffset)) at = text.length;
          walk(kids[i]);
        }
        if (node === stopNode && Number(stopOffset) >= kids.length) at = text.length;
        if (ownLine) addBreak();
        if (ownBox) addGap();
      }
      styleCache = new Map();
      try { walk(root); } catch (_) { /* keep whatever was read */ }
      styleCache = null;
      text = text.replace(/\s+$/, '');
      // -1 means the caret was never reached — it sat in text this walk does
      // not read, or outside the block entirely. Saying "the end" there would
      // hand back the block's last sentence as if it had been measured, which
      // is the wrong-occurrence answer this whole approach exists to avoid.
      return { text: text, at: at < 0 ? -1 : Math.min(at, text.length) };
    }

    // The sentence spanning a character offset in a block of text.
    function sentenceAtOffset(raw, at) {
      if (!raw) return '';
      if (at >= raw.length) at = raw.length - 1;
      if (at < 0) return '';
      let m;
      SENT_RE.lastIndex = 0;
      while ((m = SENT_RE.exec(raw)) !== null) {
        if (at >= m.index && at < m.index + m[0].length) {
          // readBlock has already collapsed whatever the layout collapses —
          // everything except a preformatted block, where the runs are the
          // text — so only the ends need tidying here. Flattening would throw
          // away the breaks it kept.
          return m[0].replace(/^\s+|\s+$/g, '');
        }
      }
      return '';
    }

    // Expand a selection to its sentence WITHOUT touching the selection.
    //
    // The polling path below must not mutate what the page put there:
    // Selection.modify would fight a reader's own highlight palette and
    // re-trigger the very poll that called it. So this only reads.
    //
    // Readers routinely wrap each word in its own element, so the sentence is
    // almost never inside one text node — climb to an ancestor holding enough
    // text, then find where in it the selection starts.
    //
    // The position is MEASURED with a scratch range, never searched for. A
    // word occurs many times in a paragraph, so matching the selected text
    // against the block's text finds the first occurrence rather than the one
    // under the user's finger: selecting "cat" in "The cat is black. The cat
    // sat." would collect the wrong sentence every time. Range.toString() and
    // textContent share the same text-node semantics, so the length of the
    // text before the selection IS its offset — which also keeps this honest
    // where innerText would not, since innerText applies text-transform and
    // drops hidden subtrees while the selection's own text does neither.
    function sentenceAroundSelection(sel) {
      let range;
      let pick;
      try {
        if (!sel || sel.isCollapsed || !sel.rangeCount) return '';
        range = sel.getRangeAt(0);
        pick = normLines(sel.toString());
      } catch (_) { return ''; }
      if (pick.length < MIN_CHARS) return '';

      const node = range.startContainer;
      let block = node && (node.nodeType === 1 ? node : node.parentElement);
      // Climb past the per-word inline elements. A paged reader can make each
      // LINE its own block, so keep going until there is room for a sentence.
      for (let i = 0; block && i < 8; i++) {
        if (block.tagName === 'BODY') break;
        if ((block.textContent || '').length >= 80) break;
        if (!block.parentElement) break;
        block = block.parentElement;
      }
      if (!block) return pick;
      const read = readBlock(block, range.startContainer, range.startOffset);
      if (!read.text || read.at < 0) return pick;

      const found = sentenceAtOffset(read.text, read.at);
      // The sentence wins only if it actually contains what was selected.
      // Otherwise the selection spans more than one sentence and shrinking it
      // would throw away text the user deliberately picked. This one test
      // replaces the length and punctuation guesses that used to stand here —
      // a 70-character drag inside a single long sentence was treated as
      // multi-sentence and banked as a mid-sentence fragment.
      if (found.length >= MIN_CHARS && flat(found).indexOf(flat(pick)) !== -1) return found;
      return pick;
    }

    // Tags that genuinely mark a paragraph. ARTICLE / SECTION / MAIN are
    // deliberately absent: they are containers, and treating one as a paragraph
    // would hand back the whole chapter.
    const PARA_TAGS = /^(?:P|LI|BLOCKQUOTE|DD|DT|TD|TH|FIGCAPTION|H[1-6])$/;

    // The block of prose containing the selection, read without touching it.
    //
    // The nearest real paragraph tag wins. A reader that wraps every word — or
    // every LINE — in its own element would otherwise give back one line, so
    // the fallback is the nearest ancestor holding a paragraph's worth of text.
    function paragraphAroundSelection(sel) {
      let node;
      try {
        if (!sel || sel.isCollapsed || !sel.rangeCount) return '';
        node = sel.getRangeAt(0).startContainer;
      } catch (_) { return ''; }
      let el = node && (node.nodeType === 1 ? node : node.parentElement);
      let fallback = null;
      for (let i = 0; el && i < 12; i++) {
        if (el.tagName === 'BODY') break;
        if (PARA_TAGS.test(el.tagName || '')) {
          const t = readBlock(el).text;
          if (t.length >= MIN_CHARS) return t.slice(0, 4000);
        }
        // A ceiling as well as a floor. Without one, per-line markup with no
        // paragraph tag anywhere jumps straight from a 40-character line to
        // the chapter container, and "+ Paragraph" would bank 4000 characters
        // of chapter as a single card. Nothing paragraph-sized means the
        // button stays hidden, which is the honest answer.
        if (!fallback) {
          const len = (el.textContent || '').length;
          if (len >= 200 && len <= 2000) fallback = el;
        }
        if (!el.parentElement) break;
        el = el.parentElement;
      }
      return fallback ? readBlock(fallback).text.slice(0, 4000) : '';
    }

    function resolveFrom(win, range) {
      try {
        const sel = win.getSelection();
        if (sel) {
          sel.removeAllRanges();
          sel.addRange(range);
          sel.modify('move', 'backward', 'sentenceboundary');
          sel.modify('extend', 'forward', 'sentence');
          const t = normLines(sel.toString());
          if (t.length >= MIN_CHARS) return t;
        }
      } catch (_) {}
      try {
        const node = range.startContainer;
        if (!node || node.nodeType !== 3) return '';
        const raw = String(node.textContent || '');
        const off = range.startOffset;
        const re = /[^.!?…]+[.!?…]*\s*/g;
        let m;
        while ((m = re.exec(raw)) !== null) {
          if (off >= m.index && off <= m.index + m[0].length) {
            const t = m[0].replace(/\s+/g, ' ').trim();
            if (t.length >= MIN_CHARS) return t;
          }
        }
        return raw.replace(/\s+/g, ' ').trim();
      } catch (_) { return ''; }
    }

    // The last thing the user selected anywhere on the page, frames included.
    //
    // Cupitor's "open study app" button reads the selection by walking
    // window.frames and calling getSelection() on each — which THROWS for a
    // cross-origin frame, so a sentence picked inside an embedded reader is
    // invisible to it. This is the only route by which that text can reach the
    // host: the frame agent posts it here, and the host reads it from
    // window.__cupSelection().
    let lookupText = '';
    let lookupAt = 0;
    // Fed ONLY with text the user selected themselves, never with a sentence
    // we widened it to and never from a tap. Looking up a word has to look up
    // that word; feeding it our expansion turned every word lookup into a
    // sentence lookup.
    function noteLookup(text) {
      // A dictionary lookup wants the words, never the shape — and this is
      // fed from several places, so it flattens here rather than trusting
      // each of them to.
      const t = flat(text).slice(0, 4000);
      if (t.length < MIN_CHARS) return;
      lookupText = t;
      lookupAt = Date.now();
    }
    // Ten minutes: long enough that closing a reader's palette and then
    // opening the study app still works, short enough that a selection from
    // an earlier reading session never pre-fills a lookup.
    window.__cupSelection = function () {
      if (!lookupText || Date.now() - lookupAt > 600000) return '';
      return lookupText;
    };

    function collect(text) {
      if (!text || text.length < MIN_CHARS) return false;
      // Consecutive duplicates are almost always a double tap, not intent.
      // The tap path and the poll path can place the breaks differently, so
      // compare the words.
      const last = state.items[state.items.length - 1];
      if (last !== undefined && flat(last) === flat(text)) return false;
      state.items.push(text);
      return true;
    }

    // `state.pending` — the text behind the "+ Add sentence" chip — belongs to
    // whichever document put it there. Ownership is not decoration: without
    // it a selection collapsing in one frame wipes a chip another frame raised,
    // and the frame that raised it has no way to take it down again. Both
    // directions were real. `force` is for the user banking it by hand, which
    // clears it whoever owns it.
    function setPending(text, para, owner, force) {
      if (text) {
        state.pending = text;
        state.pendingPara = para || '';
        state.pendingFrom = owner;
      } else if (force || !state.pending || state.pendingFrom === owner) {
        state.pending = '';
        state.pendingPara = '';
        state.pendingFrom = null;
      }
      // Unconditional. Callers change other state — an added item, an opened
      // panel — before calling this, and returning early on a refused clear
      // left all of it unrendered.
      sync();
    }

    // Cross-origin frames run frame-boot.js, injected natively at document
    // start, and speak to us only through postMessage — a JavaScript channel
    // may or may not be exposed to them, but postMessage across origins always
    // is. Arm messages go down; sentences and selections come up.
    // A tap that resolves nothing must say so. Silence is indistinguishable
    // from a dead control, which is what "unreliable" actually felt like.
    function showHint(text) {
      state.hint = text;
      sync();
      if (hintTimer) clearTimeout(hintTimer);
      hintTimer = setTimeout(() => { state.hint = ''; sync(); }, 1600);
    }

    function broadcastArm() {
      const msg = { __cupPC: { op: 'arm', on: state.tapMode } };
      for (let i = 0; i < window.frames.length; i++) {
        try { window.frames[i].postMessage(msg, '*'); } catch (_) {}
      }
    }

    // Any frame can post here, so treat the text as untrusted input rather
    // than instruction — it only ever lands in a basket the user reviews and
    // sends by hand.
    window.addEventListener('message', (ev) => {
      const d = ev && ev.data && ev.data.__cupPC;
      if (!d || !d.op) return;
      topDiag.msgs++;
      if (d.op === 'diag') {
        topDiag.diags++;
        frameDiag[String((d.info && d.info.url) || '?')] = d.info;
        return;
      }
      if (d.op === 'hello') { topDiag.hellos++; broadcastArm(); return; }
      if (d.op === 'miss') {
        topDiag.misses++;
        showHint('no sentence (' + (d.why || 'empty') + ')');
        return;
      }
      if (d.op === 'add') {
        topDiag.adds++;
        // The frame sends `raw` — what was selected — beside the widened
        // sentence it banks. Lookup wants the former.
        if (d.raw) noteLookup(String(d.raw));
        if (collect(String(d.text || ''))) {
          // Show the list as soon as there is something in it. Relying on the
          // user finding a toggle is what made this feel broken.
          state.open = true;
        } else {
          topDiag.rejected++;
          showHint('already collected');
        }
        // Banking a sentence has to take down that frame's chip, or it sits
        // there offering to bank what was just banked — and tapping it then
        // hits the duplicate check and does nothing visible.
        setPending('', '', ev.source);
        return;
      }
      // Lookup only — never the chip, never the basket. A frame sends this
      // the moment it sees a selection, so the host's lookup button is not
      // waiting on the settling gate.
      if (d.op === 'lookup') {
        noteLookup(String(d.text || '').slice(0, 4000));
        return;
      }
      if (d.op === 'selection') {
        topDiag.sels++;
        const picked = String(d.text || '').slice(0, 4000);
        noteLookup(picked);
        // The frame resolves both granularities itself — only it can read its
        // own DOM. `text` stays the raw pick, which lookup wants.
        setPending(String(d.sentence || picked).slice(0, 4000),
                   String(d.paragraph || '').slice(0, 4000), ev.source);
      }
    });

    // Armed from the app's capture chip. The host has always pushed this call
    // to the main WebView; until now nothing on a web page defined it.
    window.__cupitorSetCaptureMode = function (active) {
      const was = state.tapMode;
      state.tapMode = !!active;
      window.__cupitorCaptureMode = state.tapMode;
      // On any real change, in either direction — what must not bump it is a
      // REPEAT of the same value, which the host re-pushes on each navigation
      // and every frame's `hello` re-broadcasts. Bumping only when arming left
      // the mirror broken: tap-mode collection deliberately keeps the
      // selection, so disarming with text still selected raised no chip ever
      // again. The unarmed branch only offers a chip, so it cannot re-bank.
      if (state.tapMode !== was) armGen++;
      // Unconditional. `root` is built by ensureUi(), which only sync() calls,
      // and nothing calls sync() at install — so `if (root)` meant the FIRST
      // arm on a page built no UI at all: no basket, no panel, and therefore
      // no way to see the mode or switch it off from the page. Exactly the
      // case the basket exists for, on a reader that eats taps.
      sync();
      broadcastArm();
      console.log('[pagecap] tap mode', state.tapMode ? 'armed' : 'off');
    };

    // The block one send puts on the wire, built by the same code the subtitle
    // sidebar uses so the two agree about what "the page" is. A video page
    // rewrites its own address as it plays, and sentences picked at 12:30
    // belong to the same page as sentences picked at the start — one identity,
    // or the webapp files the same sentence twice.
    //
    // The builder lives in 20-caption-sidebar.js and the site table in
    // 30-caption-sites.js, both read here at call time rather than at load.
    // Without them the address goes as it is, which is what it did before
    // they existed.
    function capturePayload(lines) {
      const shared = window.__cupShared || {};
      const site = typeof shared.resolveCaptionSite === 'function'
        ? shared.resolveCaptionSite()
        : null;
      if (typeof shared.capturePayload === 'function') {
        return shared.capturePayload(
          location.href, document.title, '', lines,
          site && site.timeParam, site && site.timeLinkOn);
      }
      return {
        title: (document.title || '').trim(),
        url: location.href,
        timeParam: '',
        lang: '',
        lines: lines,
      };
    }

    // Asked by the host when it sends ONE tagged sentence to the webapp. That
    // path builds its own block in Dart and would otherwise file the address
    // bar verbatim — a different identity for the same page, and the one the
    // player has been rewriting.
    window.__cupCaptureIdentity = function () {
      try {
        const p = capturePayload([]);
        return JSON.stringify({ url: p.url, timeParam: p.timeParam });
      } catch (_) {
        return JSON.stringify({ url: location.href, timeParam: '' });
      }
    };

    function send() {
      if (!state.items.length || !canSend()) return;
      // No timestamps: page sentences have no media time. The host coerces the
      // missing fields and its sort is stable, so this order is preserved.
      const lines = state.items.map((text) => ({ text: text }));
      const payload = capturePayload(lines);
      payload.source = 'page';
      try {
        window.CaptionCollector.postMessage(JSON.stringify(payload));
        console.log('[pagecap] sent', state.items.length, 'sentence(s)');
        state.items = [];
        state.pending = '';
        state.pendingPara = '';
        state.pendingFrom = null;
        state.open = false;
        sync();
      } catch (e) {
        console.warn('[pagecap] send failed', e);
      }
    }

    // One watcher per document, installed by the top frame reaching in. The
    // top document's own selection is covered by the same registration.
    window.cupInFrames('page-capture', function (doc, win) {
      // A frame already running the native document-start agent is covered.
      // Installing here too would double every listener on the same window,
      // and stopPropagation does not stop a sibling listener — that needs
      // stopImmediatePropagation — so both would run and fight.
      if (win !== window) {
        try { if (win.__cupFrameBoot) return; } catch (_) { return; }
      }
      // Readers routinely disable selection so long-press stays theirs for
      // page turns, which is why dragging to select fails in them. Re-enable
      // it where we can; the armed tap path below is the answer when even
      // this is not enough.
      try {
        const st = doc.createElement('style');
        st.textContent =
          '*, *::before, *::after { -webkit-user-select: text !important;' +
          ' user-select: text !important; }';
        (doc.head || doc.documentElement).appendChild(st);
      } catch (_) {}

      // On the WINDOW, in capture phase, on touch rather than click. Each of
      // those matters independently: window capture is the first stop in the
      // event path, so a reader binding there and stopping propagation makes a
      // document-level listener invisible; capture runs before the target's own
      // handlers; and a reader that preventDefaults for page turns cancels the
      // synthesized click outright.
      const handleTap = (ev, x, y) => {
        const el = ev.target;
        if (el && el.closest) {
          if (el.closest('.cup-pc')) return;
          if (el.closest('a,button,input,textarea,select,[role="button"]')) return;
        }
        const text = sentenceAt(doc, win, x, y);
        // Length checked as well as emptiness: resolveFrom's last fallback can
        // hand back a single character, which is not a sentence.
        if (!text || text.length < MIN_CHARS) {
          showHint('no sentence (' + (lastWhy || 'empty') + ')');
          return;
        }
        if (!collect(text)) { showHint('already collected'); return; }
        ev.preventDefault();
        ev.stopPropagation();
        state.open = true;
        try {
          const sel = win.getSelection();
          if (sel && sel.removeAllRanges) sel.removeAllRanges();
        } catch (_) {}
        setPending('', '', doc);
      };
      let tapStart = null;
      win.addEventListener('touchstart', (ev) => {
        if (!state.tapMode) return;
        const t = ev.changedTouches && ev.changedTouches[0];
        tapStart = t ? { x: t.clientX, y: t.clientY, at: Date.now() } : null;
      }, true);
      win.addEventListener('touchend', (ev) => {
        if (!state.tapMode || !tapStart) return;
        const t = ev.changedTouches && ev.changedTouches[0];
        if (!t) { tapStart = null; return; }
        const dx = Math.abs(t.clientX - tapStart.x);
        const dy = Math.abs(t.clientY - tapStart.y);
        const dt = Date.now() - tapStart.at;
        tapStart = null;
        // A drag is a scroll or page turn; a long press is a selection.
        if (dx > 12 || dy > 12 || dt > 600) return;
        handleTap(ev, t.clientX, t.clientY);
      }, true);
      win.addEventListener('click', (ev) => {
        if (!state.tapMode) return;
        handleTap(ev, ev.clientX, ev.clientY);
      }, true);

      // The event-independent path, and the one to trust inside a reader.
      //
      // Every tap-based approach has to win a fight with the reader's own
      // gesture handling, and loses it in at least one of its layout modes.
      // Polling the selection picks no fight: whatever the reader does with
      // the event, if the user ends up with text selected — including by the
      // reader's own long-press-then-palette behaviour, which selects a real
      // DOM range — this sees it.
      let pollLast = '';      // what the previous tick saw
      let pollDone = '';      // what has already been acted on
      let doneGen = -1;       // the arm generation it was acted on under
      const pollSelection = () => {
        topDiag.ownPolls++;
        let txt = '';
        let sel = null;
        try {
          sel = win && win.getSelection && win.getSelection();
          // rangeCount first: Selection.toString() flushes layout, and this
          // runs every 350ms in every document, almost always with nothing
          // selected.
          if (sel && sel.rangeCount && !sel.isCollapsed) {
            const node = sel.anchorNode;
            const el = node && (node.nodeType === 1 ? node : node.parentElement);
            // Selecting inside our own panel must not re-arm the chip.
            if (!(el && el.closest && el.closest('.cup-pc'))) txt = normLines(sel.toString());
          }
        } catch (_) {}
        if (txt.length < MIN_CHARS) {
          if (!pollLast && !pollDone) return;
          pollLast = '';
          pollDone = '';
          // Only this document's own chip comes down — setPending refuses to
          // clear one another document raised.
          setPending('', '', doc);
          return;
        }
        topDiag.ownSel = 1;
        // Noted on FIRST sight, ahead of the settling gate below. Collecting
        // has to wait for a stable selection; looking a word up does not, and
        // gating both left the host's lookup button up to two ticks behind
        // what was on screen.
        // A dictionary lookup wants the words on one line, whatever shape the
        // page gave them.
        noteLookup(txt);
        // Two identical ticks means the drag has finished. Without this every
        // intermediate selection during a drag would be collected.
        if (txt !== pollLast) { pollLast = txt; return; }
        // The generation check is what makes "select first, then arm" work:
        // the unarmed pass consumes the selection, and without this it would
        // stay consumed and never be collected.
        if (txt === pollDone && doneGen === armGen) return;
        pollDone = txt;
        doneGen = armGen;
        if (state.tapMode) {
          let sentence = '';
          try { sentence = sentenceAroundSelection(sel); } catch (_) {}
          if (!sentence) sentence = txt;
          // Collect without clearing: the selection belongs to the page, and
          // wiping it closes any palette the user is looking at. pollDone is
          // what stops the next tick adding the same sentence again.
          if (collect(sentence)) {
            topDiag.ownAdds++;
            state.open = true;
            setPending('', '', doc);
          } else {
            // Already the last thing banked. Saying so beats raising the chip,
            // which would offer to bank it again and then silently refuse.
            showHint('already collected');
            setPending('', '', doc);
          }
        } else {
          // Both granularities, resolved once from the settled selection. The
          // raw pick reaches the lookup buffer only.
          let sentence = '';
          let para = '';
          try { sentence = sentenceAroundSelection(sel); } catch (_) {}
          try { para = paragraphAroundSelection(sel); } catch (_) {}
          if (!sentence) sentence = txt;
          setPending(sentence, para, doc);
        }
      };
      doc.addEventListener('selectionchange', pollSelection);
      doc.addEventListener('mouseup', pollSelection);
      // selectionchange is unreliable on some WebView builds, and a reader can
      // swallow every gesture event, so the interval is the load-bearing one.
      setInterval(pollSelection, 350);
    });

    // How the page's text is read is where all the edge cases live — a <br>,
    // two paragraphs written with nothing between them, a flex row, a hidden
    // aside. db/js/page-capture.test.mjs drives these directly against a DOM;
    // the module already publishes __cupSelection and __cupPcDiag, so this is
    // one more handle of the same kind rather than a new surface.
    window.__cupPageCaptureRead = { readBlock: readBlock, normLines: normLines, flat: flat };

    console.log('[pagecap] installed');
  })();
