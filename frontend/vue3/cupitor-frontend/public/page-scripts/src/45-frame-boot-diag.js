
  // ---- What the frame agent did, read back from the page ------------------
  //
  // frame-boot.js runs at document start, when the log channel may not yet be
  // attached to the document — so a report that depends on that channel can go
  // missing and prove nothing. It also leaves a trail on `window`, and this
  // reads that trail from snippet.js, which runs later and definitely has the
  // channel.
  //
  // The absence of the trail is itself the finding. If snippet.js cannot see a
  // global that the frame agent wrote, the two are not running in the same
  // JavaScript world — which is the only other explanation for a flag set in
  // one being invisible to the other, and it needs a different fix entirely.
  (function frameBootDiag() {
    if (window.__cupFrameBootDiagReported) return;
    window.__cupFrameBootDiagReported = 1;
    try {
      // Reported alongside the trail rather than inferred from it: this is the
      // exact flag whose absence sent the host copy down the wrong branch.
      const flag = 'ytAdPruneInstalled=' + !!window._ytAdPruneInstalled;
      const trail = window.__cupFrameBootDiag;
      if (!trail || !trail.length) {
        console.warn('[frame-boot] no trail on this document — the agent did ' +
          'not run here, or it ran in another world. ' + flag);
        return;
      }
      console.log('[frame-boot] ' + trail.join(' | ') + ' | ' + flag);
    } catch (e) {
      try {
        console.warn('[frame-boot] trail unreadable: ' + (e && e.message));
      } catch (_) {}
    }
  })();
