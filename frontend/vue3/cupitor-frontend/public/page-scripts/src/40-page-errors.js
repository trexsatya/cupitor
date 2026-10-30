// Page error capture.
//
// A page that renders nothing usually threw on the way there, and the console
// shim only forwards the snippet's own output — so the page's own failures are
// invisible from the app, which turns "it is blank" into guesswork.

  // ---- Page error capture -------------------------------------------------
  //
  // A page that renders nothing usually threw on the way. The console shim
  // only forwards snippet.js's own output, so the page's failures are
  // invisible from the app — which turns "it is blank" into guesswork.
  // Kept to a handful so an ad-heavy page cannot flood the log.
  (function pageErrors() {
    if (window.__cupPageErrors) return;
    const seen = [];
    window.__cupPageErrors = seen;
    const MAX = 10;
    // Repeats are counted, not listed. A page that throws the same thing on a
    // timer used to spend the whole budget on ten identical lines, so a
    // different error later in the page was never recorded at all — the cap
    // crowded out exactly what it existed to leave room for.
    const counts = Object.create(null);
    function note(kind, message, where) {
      const line = kind + ': ' + String(message || '').slice(0, 300) +
        (where ? ' @ ' + String(where).slice(0, 160) : '');
      const already = counts[line];
      if (already) {
        counts[line] = already + 1;
        // Powers of two, so a run that goes on reports a handful of times
        // rather than once a second forever.
        if ((already + 1) % 8 === 0) {
          console.warn('[pageerr]', line + '  (x' + (already + 1) + ')');
        }
        return;
      }
      if (seen.length >= MAX) return;
      counts[line] = 1;
      seen.push(line);
      console.warn('[pageerr]', line);
    }
    window.addEventListener('error', (ev) => {
      try {
        // A cross-origin script without CORS headers is reported as the bare
        // string "Script error." with no file and no line — the browser
        // withholds the rest on purpose, so a page cannot read error text out
        // of a third party it embeds. The stack is there for the ones that are
        // not withheld, and it is the only detail worth having when it is.
        const err = ev.error;
        const stack = (err && err.stack) ? String(err.stack).split('\n')[1] : '';
        note('error', ev.message || (err && err.message),
          (ev.filename || '') + ':' + (ev.lineno || '') +
          (stack ? ' ' + stack.trim() : ''));
      } catch (_) {}
    }, true);
    window.addEventListener('unhandledrejection', (ev) => {
      try {
        const r = ev.reason;
        note('unhandled', (r && (r.message || r)) || 'rejection',
          (r && r.stack) ? String(r.stack).split('\n')[1] || '' : '');
      } catch (_) {}
    });
  })();
