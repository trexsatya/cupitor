// Frame reach: run a feature in the top document and in every frame that can
// be reached from it.
//
// A same-origin frame is reachable through contentDocument. A cross-origin one
// is not, by design, and no JavaScript changes that — that case is what
// frame-boot.js exists for, injected natively at document start.
//
// Publishes window.cupInFrames(name, fn) and window.cupFrameReport().

  // ---- Frame reach -------------------------------------------------------
  //
  // snippet.js is injected with runJavaScript, which evaluates in the TOP
  // frame only. Anything living in an iframe — an e-book reader, an embedded
  // player — is therefore invisible to every feature in this file. Studora
  // renders its reader into <iframe id="readeriframe-...">, so nothing here
  // reaches the book text.
  //
  // A same-origin frame can be reached from the top document through
  // contentDocument. A cross-origin one cannot, by design, and no amount of
  // JavaScript changes that — that case needs WebView-level injection.
  //
  // Features register with cupInFrames(name, fn). fn(doc, win) runs once per
  // document: the top one, every reachable frame, frames that appear later,
  // and nested frames. Frames that cannot be reached are reported once each,
  // so the logs say plainly whether a site is workable.
  (function frameReach() {
    if (window.__cupFramesInstalled) return;
    window.__cupFramesInstalled = true;

    const MAX_DEPTH = 4;          // a reader inside a player is plausible; deeper is not
    const features = [];          // { name, fn, seen: WeakSet<Document> }
    const reportedBlocked = new Set();

    function label(frame) {
      try {
        return frame.getAttribute('src') || frame.id || frame.name || '(inline)';
      } catch (_) { return '(unreadable)'; }
    }

    // The try/catch IS the same-origin test: reading contentDocument across
    // origins throws.
    function reach(frame) {
      try { return frame.contentDocument || null; } catch (_) { return null; }
    }

    // Each feature tracks its own documents, so registering a second feature
    // does not re-run the first one where it has already installed.
    function install(doc, win, where, stats) {
      if (!doc || !doc.body) return;
      for (const f of features) {
        if (f.seen.has(doc)) continue;
        f.seen.add(doc);
        stats.installs++;
        try {
          f.fn(doc, win);
        } catch (e) {
          console.warn('[frames]', f.name, 'threw in', where, e);
        }
      }
    }

    function visit(doc, depth, stats) {
      if (depth > MAX_DEPTH) return;
      let frames;
      try { frames = doc.querySelectorAll('iframe, frame'); } catch (_) { return; }
      frames.forEach((frame) => {
        const name = label(frame);
        const inner = reach(frame);
        if (!inner) {
          stats.blocked++;
          if (!reportedBlocked.has(name)) {
            reportedBlocked.add(name);
            console.log('[frames] cross-origin, cannot reach:', name);
          }
          return;
        }
        // The element can exist before its document does. Install on load
        // rather than dropping the frame.
        if (!inner.body || inner.readyState === 'loading') {
          if (!frame.__cupFrameWait) {
            frame.__cupFrameWait = true;
            frame.addEventListener('load', sweep, { once: true });
          }
          stats.pending++;
          return;
        }
        install(inner, frame.contentWindow, name, stats);
        visit(inner, depth + 1, stats);
      });
    }

    function sweep() {
      const stats = { installs: 0, blocked: 0, pending: 0 };
      install(document, window, 'top', stats);
      visit(document, 0, stats);
      return stats;
    }

    window.cupInFrames = function (name, fn) {
      if (typeof fn !== 'function') return;
      features.push({ name: name, fn: fn, seen: new WeakSet() });
      const stats = sweep();
      console.log('[frames]', name, '→', stats.installs, 'document(s),',
        stats.blocked, 'blocked,', stats.pending, 'pending');
    };

    // Frames appear long after load on SPA sites.
    // Debounced: sweep() runs querySelectorAll across the top document and
    // every reachable frame, and this observer sees every mutation batch on
    // the page — including the ones our own panel makes when it re-renders.
    let sweepTimer = null;
    function sweepSoon() {
      if (sweepTimer) return;
      sweepTimer = setTimeout(() => { sweepTimer = null; sweep(); }, 250);
    }
    try {
      new MutationObserver(sweepSoon).observe(document.documentElement, {
        childList: true, subtree: true,
      });
    } catch (_) {}
    // A frame can also swap its document without its element being touched,
    // which no observer on this document reports. Cheap because it returns
    // immediately on the overwhelming majority of pages, which have no frames.
    setInterval(() => {
      if (!document.querySelector('iframe, frame')) return;
      sweep();
    }, 2000);

    // Diagnostic, for reading in the snippet logs while sizing up a site.
    window.cupFrameReport = function () {
      const rows = [];
      (function walk(doc, depth) {
        if (depth > MAX_DEPTH) return;
        let frames;
        try { frames = doc.querySelectorAll('iframe, frame'); } catch (_) { return; }
        frames.forEach((frame) => {
          const inner = reach(frame);
          rows.push({
            frame: label(frame),
            depth: depth,
            reachable: !!inner,
            ready: inner ? inner.readyState : null,
            chars: inner && inner.body ? (inner.body.innerText || '').length : 0,
          });
          if (inner) walk(inner, depth + 1);
        });
      })(document, 0);
      // Piggybacked here on purpose: the app's "Page & frame report" embeds
      // whatever this returns, so the page-capture counters reach the screen
      // without an app rebuild to add a field.
      try {
        rows.push({ pagecap: (window.__cupPcDiag && window.__cupPcDiag()) || 'not installed' });
      } catch (_) {}
      console.log('[frames] report ' + JSON.stringify(rows));
      return rows;
    };

    const first = sweep();
    console.log('[frames] reach installed —', first.blocked, 'blocked,',
      first.pending, 'pending,', document.querySelectorAll('iframe, frame').length,
      'frame(s) in top document');
  })();
