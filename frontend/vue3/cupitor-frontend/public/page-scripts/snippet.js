// GENERATED FILE — DO NOT EDIT.
// Built by scripts/build-page-scripts.cjs; sidebar source: public/language/caption-sidebar.js.

// Riksdagen video pinner.
//
// riksdagen.se scrolls its player out of view while you read the transcript.
// Nothing else in the snippet depends on this, and it depends on nothing.
(function () {
  // ---------- riksdagen video pinner ----------
  function pinVideo() {
    let videoEl = null;
    let host = new URL(document.location.href).host;
    if (host === 'www.riksdagen.se') {
      videoEl = document.querySelector('video-js');
      let el = videoEl?.parentElement?.parentElement?.parentElement?.parentElement;
      console.log(el);
      if (el && el.style) {
        el.style.position = 'fixed';
        el.style.zIndex = 2000;
        el.style.top = '5px';
        el.style.left = '10px';
        el.style.width = '100%';
        el.style.height = '10%';
      }
      console.log(el.style.position);
    }
  }
  try { setTimeout(pinVideo, 3000); } catch (e) { alert('Error' + e); }
})();
// The caption sidebar: split view, draggable divider, time-synced highlight,
// click-to-seek rows, tappable words that post to CaptionHandler for lookup,
// selection + Send to a playlist, replay passes and translation.
//
// One factory over one shared `state`, which is why it is one file: its ~45
// functions are closures over that state, so they cannot be separated without
// threading a context object through all of them.
//
// Site modules feed it through the object it returns (addCue, buildSidebar,
// setSplit, setVideoElement); it knows nothing about any particular site.
(function () {
  const shared = window.__cupShared || (window.__cupShared = {});
  // YouTube enforces Trusted Types. Build DOM directly so opening a panel,
  // rendering a cue or changing settings never needs an HTML policy.
  function node(tag, attrs = {}, children = []) {
    const el = document.createElement(tag);
    for (const [name, value] of Object.entries(attrs)) {
      if (value != null && value !== false) el.setAttribute(name, value === true ? '' : String(value));
    }
    el.append(...children);
    return el;
  }
  // -----------------------------------------------------------------------
  // Shared subtitle UI: split-view sidebar with draggable divider, time-
  // synced highlight, click-to-seek on cue rows, and clickable words that
  // post to window.CaptionHandler → opens dialog1 for word lookup.
  // Site-specific modules (SVT Play below) populate state.cues via addCue.
  // -----------------------------------------------------------------------
  function createSubtitleUI(opts) {
    const state = {
      cues: [],
      // Selection for "send to the app". Holds stable cue ids, not indices:
      // addCue splices into the middle, so indices shift under us.
      picking: false,
      selected: new Set(),
      nextCueId: 1,
      sidebar: null,
      listEl: null,
      currentVideo: null,
      importBusy: false,
      importAvailable: true,
      activeIdx: -1,
      autoScroll: true,
      splitActive: false,
      bodyClass: opts.bodyClass || 'cup-sub-split',
      shrinkSelectors: opts.shrinkSelectors || ['video'],
      // The query parameter this player reads a start offset from, and where
      // a link to one is worth making, both named by the site entry. No
      // parameter means the player has no deep link, and a sent block then
      // carries the plain page address.
      timeParam: opts.timeParam || '',
      timeLinkOn: opts.timeLinkOn,

      // Translation state
      translationEnabled: false,
      translationSource: opts.translationSource || 'sv',
      translationTarget: opts.translationTarget || 'en',
      nextTrId: 1,
      pendingTr: Object.create(null), // id → cue index
      // Strategies:
      //   1 = play through, translate as cues arrive
      //   2 = pause until current cue is translated
      //   3 = chunked replay, single pass at 1x
      //   4 = chunked replay, configurable repeats and per-repeat speeds
      strategy: 1,
      linesPerChunk: 5,
      // Strategy 3/4/5 bookkeeping. Chunk progression is PLAYBACK-driven:
      // we count cues the playhead actually enters, NOT cues harvested into
      // the list. SVT streams text-track cues into the buffer ahead of the
      // playhead, so counting on arrival made chunks fire instantly and the
      // video skipped forward without ever playing.
      chunkStartIdx: null,     // cue index where the current chunk began
      chunkStart: null,        // time of the first cue in the current chunk
      chunkEnd: null,          // end time of the last cue in the current chunk
      chunkReplaying: false,   // true while paused or in replay phase
      // Don't start a fresh chunk before this time — set to chunkEnd after a
      // replay completes so we don't immediately re-chunk the region we just
      // replayed (which would loop forever).
      chunkFloor: 0,
      // Strategy 4 / 5
      repeatCount: 1,          // how many replays after the original pass
      replaySchedule: '1-0.7', // speed per pass, "-" separated; last value extends
      currentPass: 0,          // 0 = original; 1+ = replay pass #
      // Strategy 5 only — gap in seconds inserted between passes.
      replayGap: 1,
      gapTimer: null,
      // User-pause tracking — true if the user (not our code) paused the
      // video. We refuse to auto-resume in that case so manual pauses stick.
      userOverrode: false,
      // Count of programmatic pauses awaiting their `pause` event. Each
      // ourPause() increments; the pause handler decrements. >0 means
      // "this pause is ours". A counter is race-free; the previous
      // timestamp window lost under JS-thread stalls >300ms.
      expectedPauses: 0,
      // Same idea for play — ourPlay() bumps this so the play handler
      // doesn't misclassify a synthetic resume as user-initiated.
      expectedPlays: 0,
      // ourPlay() was asked to play while the app held the page's videos for
      // a lookup (window.__cupLookupHold); it plays on cupitorLookupRelease.
      playDeferred: false,
      // Timestamp of our last programmatic seek. replayTick uses
      // a 500 ms grace after this to avoid advancing on stale timeupdates
      // (currentTime can still read the pre-seek value for a brief moment).
      lastSeekAt: 0,
      // Listener bindings we attached to the current video — kept so we
      // can remove them when SVT swaps the <video> element (ad breaks /
      // source switches). Without cleanup, old listeners keep firing on
      // detached video elements and double-advance the strategy state.
      videoListeners: null,
      // Bumped every replay pass start; a passToken captured at schedule
      // time lets the gap timer abort if the user / a new chunk moved on.
      passToken: 0,
      // Debug flag. When true (toggle via window.cupSubDebug=true in the
      // console, or via the settings dialog), strategy transitions log to
      // the console so we can diagnose misbehavior from a real session.
      debug: false,
    };
    try {
      if (typeof window !== 'undefined' && window.cupSubDebug) state.debug = true;
    } catch (_) {}
    function dlog(){
      if (!state.debug) return;
      try { console.log.apply(console, ['[cup-sub]'].concat([].slice.call(arguments))); } catch (_) {}
    }

    // Restore persisted prefs early so the buttons start in the right state.
    try {
      const saved = JSON.parse(localStorage.getItem('cupSubPrefs') || '{}');
      if (typeof saved.translationEnabled === 'boolean') state.translationEnabled = saved.translationEnabled;
      if (typeof saved.strategy === 'number') state.strategy = saved.strategy;
      if (typeof saved.linesPerChunk === 'number') state.linesPerChunk = saved.linesPerChunk;
      if (typeof saved.translationSource === 'string') state.translationSource = saved.translationSource;
      if (typeof saved.translationTarget === 'string') state.translationTarget = saved.translationTarget;
      if (typeof saved.repeatCount === 'number') state.repeatCount = saved.repeatCount;
      if (typeof saved.replaySchedule === 'string') state.replaySchedule = saved.replaySchedule;
      if (typeof saved.replayGap === 'number') state.replayGap = saved.replayGap;
      if (typeof saved.debug === 'boolean') state.debug = saved.debug;
    } catch (_) {}

    function persistPrefs() {
      try {
        localStorage.setItem('cupSubPrefs', JSON.stringify({
          translationEnabled: state.translationEnabled,
          strategy: state.strategy,
          linesPerChunk: state.linesPerChunk,
          translationSource: state.translationSource,
          translationTarget: state.translationTarget,
          repeatCount: state.repeatCount,
          replaySchedule: state.replaySchedule,
          replayGap: state.replayGap,
          debug: state.debug,
        }));
      } catch (_) {}
    }

    // Parse a "1-0.5-0.7" style schedule into a list of positive numbers.
    // Falls back to [1] on garbage input. Last value extends.
    function parseSchedule(str) {
      const arr = (str || '1').split('-').map(s => {
        const n = parseFloat(s);
        return (isFinite(n) && n >= 0.25 && n <= 4) ? n : 1;
      });
      return arr.length ? arr : [1];
    }
    function speedForPass(passIdx) {
      // Strategy 3 is "play N lines then replay once at normal speed".
      if (state.strategy === 3) return 1;
      const sched = parseSchedule(state.replaySchedule);
      return sched[Math.min(passIdx, sched.length - 1)];
    }
    // Max replay passes for the active strategy. Strategy 3 = exactly one.
    function maxPasses() {
      return state.strategy === 3 ? 1 : Math.max(0, state.repeatCount);
    }

    function injectCss() {
      const existing = document.getElementById('cup-sub-css');
      if (existing && existing.dataset.version === '24') return;
      if (existing) existing.remove();
      const s = document.createElement('style');
      s.id = 'cup-sub-css';
      s.dataset.version = '24';
      // Build per-site CSS. The host module also marks the player wrapper
      // at runtime with .cup-shrink-target so we shrink the *container*
      // (which holds overlay controls) rather than just the <video>
      // element. Otherwise the player's bottom control bar lands behind
      // our sidebar.
      const shrinkRule = ['.cup-shrink-target'].concat(state.shrinkSelectors)
        .map(sel => 'body.' + state.bodyClass + ' ' + sel)
        .join(', ');
      s.textContent = `
        body.${state.bodyClass} { --cup-vid-h: 50vh; }
        ${shrinkRule} {
          height: var(--cup-vid-h) !important;
          max-height: var(--cup-vid-h) !important;
          bottom: auto !important;
        }
        /* YouTube's absolutely positioned video can live in a zero-height
           wrapper. A percentage cap resolves to zero there and hides it. */
        body.${state.bodyClass} video { max-height: var(--cup-vid-h) !important; }
        body.${state.bodyClass} .cup-sub-sidebar { display: flex !important; }

        .cup-sub-sidebar {
          display: none;
          position: fixed; left: 0; right: 0; bottom: 0;
          width: 100vw;
          height: calc(100vh - var(--cup-vid-h, 50vh));
          z-index: 2147483646;
          background: #111; color: #eee;
          font-family: system-ui, -apple-system, sans-serif;
          font-size: 15px;
          flex-direction: column;
          border-top: 1px solid rgba(255,255,255,0.15);
          box-shadow: 0 -2px 10px rgba(0,0,0,0.6);
        }
        .cup-sub-head {
          padding: 6px 8px; display: flex; flex-wrap: wrap; gap: 4px; align-items: center;
          background: #1a1a1a; border-bottom: 1px solid rgba(255,255,255,0.1);
          user-select: none; flex: 0 0 auto;
        }
        body.cup-sub-spotify .cup-sub-sidebar {
          bottom: var(--cup-spotify-footer-h, 96px);
          height: calc(100vh - var(--cup-vid-h, 50vh) - var(--cup-spotify-footer-h, 96px));
        }
        .cup-sub-head button {
          background: none; border: 1px solid rgba(255,255,255,0.18);
          color: #eee; cursor: pointer; padding: 3px 7px;
          font-size: 14px; line-height: 1; border-radius: 3px;
        }
        .cup-sub-head button:hover { background: rgba(255,255,255,0.12); }
        .cup-sub-head button.cup-on { background: rgba(120,200,120,0.25); border-color: rgba(120,200,120,0.5); }
        .cup-sub-status {
          font-size: 11px; color: #ffd479; padding: 0 6px;
          font-variant-numeric: tabular-nums;
        }
        .cup-sub-list { padding: 8px 10px; overflow-y: auto; flex: 1; line-height: 1.45; }
        .cup-sub-cue {
          display: flex; gap: 8px; align-items: flex-start;
          padding: 4px 6px; margin: 2px 0;
          border-radius: 4px; cursor: pointer;
          opacity: 0.55; transition: background 0.1s ease;
        }
        .cup-sub-cue:hover { background: rgba(255,255,255,0.06); opacity: 0.85; }
        .cup-sub-cue.cup-active { opacity: 1; background: rgba(255,255,255,0.12); }
        .cup-sub-time {
          flex: 0 0 auto; min-width: 56px;
          color: #7aa6e8; font-size: 12px; font-variant-numeric: tabular-nums;
          padding-top: 2px; user-select: none;
        }
        .cup-sub-text { flex: 1; word-break: break-word; }
        /* Selection checkboxes are always rendered but only shown while
           picking, so entering select mode costs no re-render. */
        .cup-sub-pick { display: none; flex: 0 0 auto; margin: 3px 0 0 0; cursor: pointer; }
        .cup-picking .cup-sub-pick { display: inline-block; width: 17px; height: 17px; }
        /* The whole row is the selection target while selecting, so it should
           look like one. */
        .cup-picking .cup-sub-cue { cursor: pointer; }
        .cup-sub-cue.cup-picked { background: rgba(120,200,120,0.18); opacity: 1; }
        .cup-sub-tr {
          margin-top: 2px; font-size: 13px; color: #b8d4ff;
          font-style: italic; opacity: 0.85;
        }
        .cup-sub-tr.cup-tr-pending { color: #888; }
        .cup-sub-modal {
          position: fixed; inset: 0; z-index: 2147483647;
          display: flex; align-items: center; justify-content: center;
          background: rgba(0,0,0,0.7);
        }
        .cup-sub-modal-box {
          background: #222; color: #eee; padding: 16px 18px;
          border-radius: 6px; min-width: 280px; max-width: 90vw;
          box-shadow: 0 6px 30px rgba(0,0,0,0.7);
        }
        .cup-sub-modal-box h3 { margin: 0 0 10px; font-size: 15px; }
        .cup-sub-modal-box label { display: block; margin: 8px 0; font-size: 13px; }
        .cup-sub-modal-box select, .cup-sub-modal-box input[type=number] {
          width: 100%; padding: 4px 6px; background: #1a1a1a; color: #eee;
          border: 1px solid rgba(255,255,255,0.2); border-radius: 3px;
          font-size: 13px;
        }
        .cup-sub-modal-actions {
          display: flex; gap: 8px; justify-content: flex-end; margin-top: 14px;
        }
        .cup-sub-modal-actions button { padding: 5px 12px; font-size: 13px; }
        .cup-w { cursor: pointer; padding: 0 1px; }
        .cup-w:hover, .cup-w:active {
          background: rgba(255,220,80,0.45); border-radius: 2px; color: #fff;
        }
        .cup-sub-drag {
          position: absolute; top: -6px; left: 0; right: 0;
          height: 12px; cursor: ns-resize;
          z-index: 2; touch-action: none;
          display: flex; justify-content: center; align-items: center;
        }
        .cup-sub-drag::before {
          content: ''; width: 60px; height: 4px;
          background: rgba(255,255,255,0.35); border-radius: 2px;
          transition: background 0.15s ease;
        }
        .cup-sub-drag:hover::before,
        .cup-sub-drag.cup-dragging::before { background: rgba(120,200,255,0.7); }
        body.cup-sub-dragging { cursor: ns-resize !important; user-select: none !important; }
      `;
      (document.head || document.documentElement).appendChild(s);
    }

    function buildSidebar() {
      if (state.sidebar && document.body.contains(state.sidebar)) return;
      injectCss();
      const sb = document.createElement('div');
      sb.className = 'cup-sub-sidebar';
      const buttons = [
        ['split', '⇋', 'Toggle split view'], ['scroll', '⇩', 'Auto-scroll'],
        ['translate', '🌐', 'Toggle translation'], ['download', '⤓CC', 'Download YouTube subtitles'],
        ['open-srt', 'Open SRT', 'Open a local SRT subtitle file'], ['settings', '⚙', 'Strategy & settings'],
        ['prev', '⟨', 'Previous cue'], ['next', '⟩', 'Next cue'], ['copy', '⧉', 'Copy transcript'],
        ['clear', '🗑', 'Clear transcript'], ['pick', '☑', 'Select lines'],
        ['all', '⊞', 'Select all / none'], ['send', '⤴', 'Send selected to Cupitor'],
      ].map(([act, label, title]) => node('button', {
        'data-act': act, title, type: 'button',
        class: ['split', 'scroll'].includes(act) ? 'cup-on' : null,
        style: ['download', 'open-srt', 'all', 'send'].includes(act) ? 'display:none' : null,
      }, [label]));
      sb.append(
        node('div', {class: 'cup-sub-drag', title: 'Drag to resize'}),
        node('div', {class: 'cup-sub-head'}, [...buttons,
          node('span', {class: 'cup-sub-status cup-nolookup', 'data-r': 'status'})]),
        node('div', {'data-r': 'notice', class: 'cup-nolookup', hidden: true,
          style: 'padding:10px 14px;flex:0 0 auto;font-size:14px'}),
        node('div', {class: 'cup-sub-list'}),
      );
      (document.body || document.documentElement).appendChild(sb);
      state.sidebar = sb;
      state.listEl = sb.querySelector('.cup-sub-list');

      sb.querySelector('[data-act="split"]').onclick = (e) => {
        setSplit(!state.splitActive);
        e.currentTarget.classList.toggle('cup-on', state.splitActive);
        if (typeof opts.onSplitChange === 'function') opts.onSplitChange(state.splitActive);
      };
      sb.querySelector('[data-act="scroll"]').onclick = (e) => {
        state.autoScroll = !state.autoScroll;
        e.currentTarget.classList.toggle('cup-on', state.autoScroll);
      };
      sb.querySelector('[data-act="translate"]').onclick = (e) => {
        state.translationEnabled = !state.translationEnabled;
        e.currentTarget.classList.toggle('cup-on', state.translationEnabled);
        persistPrefs();
        if (state.translationEnabled) {
          // Backfill: request translation for every cue that doesn't yet have one.
          for (let i = 0; i < state.cues.length; i++) {
            if (!state.cues[i].translation) requestTranslation(i);
          }
        }
      };
      syncPickUi();
      sb.querySelector('[data-act="settings"]').onclick = () => openSettingsDialog();
      const download = sb.querySelector('[data-act="download"]');
      if (typeof opts.onDownloadSubtitles === 'function') {
        download.style.display = '';
        download.onclick = () => opts.onDownloadSubtitles();
      }
      const openSrt = sb.querySelector('[data-act="open-srt"]');
      if (typeof opts.onOpenSubtitles === 'function') {
        openSrt.style.display = '';
        openSrt.disabled = state.importBusy || !state.importAvailable;
        openSrt.onclick = () => opts.onOpenSubtitles();
      }
      sb.querySelector('[data-act="prev"]').onclick = () => seekRelative(-1);
      sb.querySelector('[data-act="next"]').onclick = () => seekRelative(+1);
      sb.querySelector('[data-act="copy"]').onclick = () => {
        const txt = state.cues.map(c => {
          const line = fmtTime(c.start) + '\t' + c.text;
          return c.translation ? line + '\n\t' + c.translation : line;
        }).join('\n');
        try { navigator.clipboard && navigator.clipboard.writeText(txt); } catch (_) {}
      };
      sb.querySelector('[data-act="pick"]').onclick = (e) => {
        setPicking(!state.picking);
        e.currentTarget.classList.toggle('cup-on', state.picking);
      };
      sb.querySelector('[data-act="all"]').onclick = () => {
        // Every harvested cue, not just the ones that have played. On sites
        // whose whole track is fetched up front this is the full transcript.
        const all = state.cues.map(c => c.id);
        const full = all.length && all.every(id => state.selected.has(id));
        state.selected = full ? new Set() : new Set(all);
        syncPickUi();
      };
      sb.querySelector('[data-act="send"]').onclick = () => sendSelected();
      sb.querySelector('[data-act="clear"]').onclick = () => {
        clearCues();
        if (typeof opts.onClearCues === 'function') opts.onClearCues();
      };

      if (state.cues.length && state.listEl) {
        for (let i = 0; i < state.cues.length; i++) renderCue(state.cues[i], i);
      }
      installDragHandle(sb.querySelector('.cup-sub-drag'));
      // Reflect persisted prefs in the button states.
      sb.querySelector('[data-act="translate"]').classList.toggle('cup-on', state.translationEnabled);
    }

    function setSplit(on) {
      state.splitActive = on;
      document.body.classList.toggle(state.bodyClass, on);
      if (on) restoreSplitPosition();
      try { window.dispatchEvent(new Event('resize')); } catch (_) {}
    }

    const SPLIT_KEY = 'cupSubVidH';
    const MIN_VID_VH = 20, MAX_VID_VH = 85;
    function applySplitVh(vh) {
      vh = Math.max(MIN_VID_VH, Math.min(MAX_VID_VH, vh));
      document.body.style.setProperty('--cup-vid-h', vh + 'vh');
      try { window.dispatchEvent(new Event('resize')); } catch (_) {}
      return vh;
    }
    function restoreSplitPosition() {
      try {
        const saved = parseFloat(localStorage.getItem(SPLIT_KEY));
        if (isFinite(saved) && saved > 0) applySplitVh(saved);
      } catch (_) {}
    }
    function installDragHandle(handleEl) {
      if (!handleEl) return;
      let dragging = false;
      function onMove(clientY) {
        if (!dragging) return;
        applySplitVh((clientY / window.innerHeight) * 100);
      }
      function onDown(e) {
        dragging = true;
        handleEl.classList.add('cup-dragging');
        document.body.classList.add('cup-sub-dragging');
        e.preventDefault();
      }
      function onUp() {
        if (!dragging) return;
        dragging = false;
        handleEl.classList.remove('cup-dragging');
        document.body.classList.remove('cup-sub-dragging');
        try {
          const v = parseFloat(getComputedStyle(document.body).getPropertyValue('--cup-vid-h'));
          if (isFinite(v) && v > 0) localStorage.setItem(SPLIT_KEY, String(v));
        } catch (_) {}
      }
      handleEl.addEventListener('mousedown', onDown);
      handleEl.addEventListener('touchstart', onDown, { passive: false });
      document.addEventListener('mousemove', (e) => onMove(e.clientY));
      document.addEventListener('touchmove', (e) => {
        if (!dragging) return;
        e.preventDefault();
        const t = e.touches[0];
        if (t) onMove(t.clientY);
      }, { passive: false });
      document.addEventListener('mouseup', onUp);
      document.addEventListener('touchend', onUp);
      document.addEventListener('touchcancel', onUp);
    }

    function fmtTime(sec) {
      sec = Math.max(0, Math.floor(sec || 0));
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      const pad = n => (n < 10 ? '0' + n : '' + n);
      return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
    }

    function tokenize(text) {
      const fragment = document.createDocumentFragment();
      for (const tok of text.split(/(\s+)/)) {
        const m = tok.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}][\p{L}\p{N}'’\-]*)(.*)$/u);
        if (!m) fragment.append(tok);
        else fragment.append(m[1], node('span', {class: 'cup-w', 'data-w': m[2]}, [m[2]]), m[3]);
      }
      return fragment;
    }

    function renderCueText(block, cue) {
      block.replaceChildren(tokenize(cue.text));
      if (cue.translation) block.append(node('div', {class: 'cup-sub-tr'}, [cue.translation]));
      else if (cue.trPending) block.append(node('div', {class: 'cup-sub-tr cup-tr-pending'}, ['…']));
    }

    function attachWordClicks(scope) {
      scope.querySelectorAll('.cup-w').forEach(el => {
        if (el.__cupBound) return;
        el.__cupBound = true;
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          // Words swallow the click, so without this a tap on any word would
          // look the word up instead of selecting — leaving the checkbox as
          // the only target that worked.
          if (state.picking) { togglePickRow(el.closest('.cup-sub-cue')); return; }
          // The host's own word-wrapper saw this tap first and already sent
          // it, having rejoined any word broken across a hyphen — something
          // we cannot do from a single token. Sending the raw token now would
          // replace that better answer, because the host keeps only the last
          // query handed to it. When the host isn't wrapping this page there
          // is no inner span, and we are the only one who will send it.
          if (e.target !== el && e.target.closest &&
              e.target.closest('.clickable-word')) return;
          const w = el.getAttribute('data-w') || el.textContent || '';
          try {
            if (typeof opts.onWord === 'function') opts.onWord(w);
            else if (window.CaptionHandler) window.CaptionHandler.postMessage(w);
          } catch (_) {}
        });
      });
    }

    function normalizeText(s) {
      return (s || '').replace(/\s+/g, ' ').trim().toLowerCase();
    }

    // Is this cue a duplicate of an existing one within a small time window?
    // Scans backward through the sorted cue list. Matches:
    //   - exact normalized-text match within ±3s
    //   - containment within ±3s, but ONLY when the new text starts with
    //     the existing one (a prefix being extended in place — SVT's
    //     "first line, then full two-line" pattern). The old "either
    //     contains the other anywhere" check collapsed unrelated sentences
    //     that happened to share a substring, undercounting the chunk and
    //     making linesPerChunk drift.
    function findDup(cue) {
      const norm = normalizeText(cue.text);
      if (!norm) return true;
      const WINDOW = 3;
      for (let i = state.cues.length - 1; i >= 0; i--) {
        const c = state.cues[i];
        if (c.start < cue.start - 30) break;
        if (Math.abs(c.start - cue.start) > WINDOW) continue;
        const ct = normalizeText(c.text);
        if (ct === norm) return true;
        // Same speaker continuing — only treat as same cue if one string
        // is a strict PREFIX of the other and the shorter has at least
        // 8 chars (otherwise short common openers like "ja" / "och" would
        // eat unrelated lines).
        const shorter = ct.length < norm.length ? ct : norm;
        const longer  = ct.length < norm.length ? norm : ct;
        if (shorter.length >= 8 && longer.startsWith(shorter)) {
          if (norm.length > ct.length) {
            state.cues[i] = Object.assign({}, c, { text: cue.text, translation: '', trPending: false });
            rerenderCue(i);
            if (state.translationEnabled) requestTranslation(i);
          }
          return true;
        }
      }
      return false;
    }

    // Storyboard / thumbnail tracks are WEBVTT too, and their cue payload is
    // an image URL — usually with a #xywh= spatial fragment picking one frame
    // out of a sprite sheet. They are timed, so they parse perfectly as cues,
    // but they are not speech and must never reach the panel.
    function isThumbnailCue(text) {
      const t = (text || '').trim();
      if (!t) return true;
      if (/#xywh=/i.test(t)) return true;
      // A cue that is nothing but an image reference. Anchored and
      // whitespace-free, so a spoken line that merely mentions a filename
      // ("open cat.jpg then") still gets through.
      if (/^\S+\.(jpe?g|png|webp|avif|gif)(\?|#|$)/i.test(t)) return true;
      return false;
    }

    function addCue(cue) {
      if (!normalizeText(cue.text)) return;
      if (isThumbnailCue(cue.text)) return;
      if (findDup(cue)) return;
      // Stable identity for selection — list positions shift as cues are
      // spliced in, but this doesn't.
      if (cue.id == null) cue.id = state.nextCueId++;
      let i = state.cues.length;
      while (i > 0 && state.cues[i - 1].start > cue.start) i--;
      state.cues.splice(i, 0, cue);
      // Keep pendingTr's indices in sync — inserting at position i bumps
      // every later index by one.
      const newPending = Object.create(null);
      for (const id in state.pendingTr) {
        const oldIdx = state.pendingTr[id];
        newPending[id] = oldIdx >= i ? oldIdx + 1 : oldIdx;
      }
      state.pendingTr = newPending;
      // activeIdx is recomputed every syncHighlight, so we don't bump it. But
      // chunkStartIdx is a stored anchor — shift it if we inserted before it
      // so it keeps pointing at the same cue.
      if (state.chunkStartIdx != null && i <= state.chunkStartIdx) state.chunkStartIdx++;
      if (state.listEl) renderCue(cue, i);
      if (state.translationEnabled) requestTranslation(i);
      // NOTE: chunk progression is intentionally NOT driven from here — see
      // onPlayheadCue(). Harvested cues stream ahead of the playhead; counting
      // them on arrival made chunks fire on unwatched cues.
    }

    // Replace a complete downloaded track in one pass. Unlike the streaming
    // addCue path, no repeated insertion/duplicate scan is needed per line.
    function replaceCues(cues, language, options) {
      clearCues(options);
      buildSidebar();
      if (language) state.translationSource = language;
      state.cues = cues.map(cue => ({ ...cue, id: state.nextCueId++ }));
      if (state.listEl) {
        for (let i = 0; i < state.cues.length; i++) renderCue(state.cues[i], i);
      }
      if (state.translationEnabled) {
        for (let i = 0; i < state.cues.length; i++) requestTranslation(i);
      }
    }

    // Selection is only offered inside Cupitor: without the channel there is
    // nowhere to send, so the button would be a dead control in a browser.
    function canSend() {
      if (typeof opts.onCapture === 'function') return true;
      try {
        return !!(window.CaptionCollector &&
                  typeof window.CaptionCollector.postMessage === 'function');
      } catch (_) { return false; }
    }

    function setPicking(on) {
      state.picking = !!on;
      // Leaving select mode drops the selection; re-entering starts clean
      // rather than resurrecting ticks the user can no longer see.
      if (!state.picking) state.selected = new Set();
      syncPickUi();
    }

    function syncPickUi() {
      const sb = state.sidebar;
      if (!sb) return;
      sb.classList.toggle('cup-picking', state.picking);
      // In select mode a tap on a line means "tick this one", so the whole
      // sidebar opts out of word lookups for as long as it lasts. Without
      // this the host's word handler fires first and opens a dictionary
      // dialog on top of the selection the user was making.
      const wasOptedOut = sb.classList.contains('cup-nolookup');
      sb.classList.toggle('cup-nolookup', state.picking);
      // Cues that arrived while opted out were never word-wrapped, because
      // the host skips the subtree. Leaving select mode has to hand them
      // back, or their translation lines — which carry no markup of our own —
      // would stay untappable for the rest of the session. Class attributes
      // are not observed, so nothing notices on its own.
      if (wasOptedOut && !state.picking && state.listEl &&
          typeof window._wordWrapEnqueue === 'function' &&
          typeof window._wordWrapFlush === 'function') {
        try {
          window._wordWrapEnqueue(state.listEl);
          window._wordWrapFlush();
        } catch (_) {}
      }
      // Outside Cupitor there is nowhere to send, so selecting is a dead end
      // — hide the entry point rather than offering a button that does nothing.
      const pickBtn = sb.querySelector('[data-act="pick"]');
      if (pickBtn) pickBtn.style.display = canSend() ? '' : 'none';
      const allBtn = sb.querySelector('[data-act="all"]');
      const sendBtn = sb.querySelector('[data-act="send"]');
      // Both are meaningless outside select mode, so they stay out of the
      // header entirely and normal use looks exactly as it did.
      if (allBtn) allBtn.style.display = state.picking ? '' : 'none';
      if (sendBtn) sendBtn.style.display = (state.picking && canSend()) ? '' : 'none';
      if (sendBtn) sendBtn.disabled = state.selected.size === 0;
      if (state.listEl) {
        const rows = state.listEl.children;
        for (let i = 0; i < rows.length; i++) {
          const row = rows[i];
          const id = Number(row.dataset.cueId);
          const on = state.selected.has(id);
          const box = row.querySelector('.cup-sub-pick');
          if (box) box.checked = on;
          row.classList.toggle('cup-picked', state.picking && on);
        }
      }
      const status = sb.querySelector('[data-r="status"]');
      if (status) {
        status.textContent = state.picking ? state.selected.size + ' selected' : state.cues.length + ' cues';
      }
    }

    // Flip one line's selection. syncPickUi repaints the checkbox and the
    // count, so callers don't touch either.
    function togglePickRow(row) {
      if (!row) return;
      const id = Number(row.dataset.cueId);
      if (!Number.isFinite(id)) return;
      if (state.selected.has(id)) state.selected.delete(id);
      else state.selected.add(id);
      syncPickUi();
    }

    function sendSelected() {
      if (!state.selected.size || !canSend()) return;
      const lines = state.cues
        .filter(c => state.selected.has(c.id))
        .map(c => {
          const line = { start: c.start, end: c.end, text: c.text };
          if (c.translation) line.translation = c.translation;
          return line;
        });
      if (!lines.length) return;
      const payload = capturePayload(
        typeof opts.mediaUrl === 'function' ? opts.mediaUrl() : location.href,
        document.title, state.translationSource,
        lines, state.timeParam, state.timeLinkOn);
      try {
        if (typeof opts.onCapture === 'function') opts.onCapture(payload);
        else window.CaptionCollector.postMessage(JSON.stringify(payload));
        console.log('[caps] sent', lines.length, 'lines');
        setPicking(false);
        const pickBtn = state.sidebar && state.sidebar.querySelector('[data-act="pick"]');
        if (pickBtn) pickBtn.classList.remove('cup-on');
      } catch (e) {
        console.warn('[caps] send failed', e);
      }
    }

    function renderCue(cue, idx) {
      if (!state.listEl) return;
      const row = document.createElement('div');
      row.className = 'cup-sub-cue';
      row.dataset.start = String(cue.start);
      row.dataset.end = String(cue.end);
      row.dataset.cueId = String(cue.id);
      const textBlock = node('div', {class: 'cup-sub-text'});
      renderCueText(textBlock, cue);
      row.append(node('input', {type: 'checkbox', class: 'cup-sub-pick'}),
        node('span', {class: 'cup-sub-time cup-nolookup'}, [fmtTime(cue.start)]), textBlock);
      const pick = row.querySelector('.cup-sub-pick');
      pick.checked = state.selected.has(cue.id);
      // Outside select mode a row tap seeks and a word tap looks the word up.
      // Inside it, every tap anywhere on the row toggles that line: the
      // checkbox alone is too small a target to be the only way in.
      pick.addEventListener('click', (e) => {
        e.stopPropagation();
        if (pick.checked) state.selected.add(cue.id);
        else state.selected.delete(cue.id);
        syncPickUi();
      });
      row.addEventListener('click', (e) => {
        // The checkbox has already handled itself.
        if (e.target === pick) return;
        if (state.picking) { togglePickRow(row); return; }
        // Don't seek when the tap was a word lookup. The host wraps every
        // word on the page in .clickable-word and that inner span is what a
        // tap actually lands on, so checking for .cup-w alone misses — and
        // misses entirely in a translation line, which has no .cup-w at all.
        if (e.target.closest && e.target.closest('.cup-w, .clickable-word')) return;
        if (!seekAndPlay(cue.start)) return;
        // Find this row's current index (insertion may have shifted things).
        const children = state.listEl.children;
        for (let i = 0; i < children.length; i++) if (children[i] === row) { focusCueRow(i); break; }
      });
      attachWordClicks(row);
      const children = state.listEl.children;
      if (idx >= children.length) state.listEl.appendChild(row);
      else state.listEl.insertBefore(row, children[idx]);
    }

    function rerenderCue(idx) {
      if (!state.listEl) return;
      const cue = state.cues[idx];
      const row = state.listEl.children[idx];
      if (!cue || !row) return;
      const wasActive = row.classList.contains('cup-active');
      // Cheaper than re-creating: rewrite the inner blocks.
      const textBlock = row.querySelector('.cup-sub-text');
      if (textBlock) {
        renderCueText(textBlock, cue);
        attachWordClicks(textBlock);
      }
      if (wasActive) row.classList.add('cup-active');
    }

    function focusCueRow(idx) {
      if (!state.listEl) return;
      if (state.activeIdx >= 0) {
        const prev = state.listEl.children[state.activeIdx];
        if (prev) prev.classList.remove('cup-active');
      }
      state.activeIdx = idx;
      const el = state.listEl.children[idx];
      if (el) {
        el.classList.add('cup-active');
        try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
      }
    }

    function seekRelative(delta) {
      if (!state.currentVideo || !state.cues.length) return;
      const t = state.currentVideo.currentTime;
      if (!Number.isFinite(t)) return;
      let cueIdx = -1;
      if (delta > 0) {
        cueIdx = state.cues.findIndex(c => c.start > t + 0.3);
        if (cueIdx < 0) cueIdx = state.cues.length - 1;
      } else {
        for (let i = state.cues.length - 1; i >= 0; i--) {
          if (state.cues[i].start < t - 0.3) { cueIdx = i; break; }
        }
        if (cueIdx < 0) cueIdx = 0;
      }
      const cue = state.cues[cueIdx];
      if (cue) {
        if (!seekAndPlay(cue.start)) return;
        // Don't wait for timeupdate — scroll + highlight right now.
        focusCueRow(cueIdx);
      }
    }

    function seekAndPlay(time) {
      const media = state.currentVideo;
      if (!media) return false;
      try {
        if (typeof media.seekTo === 'function') {
          if (media.seekTo(time) === false) return false;
        } else media.currentTime = time;
        const playing = media.play();
        if (playing && typeof playing.catch === 'function') playing.catch(() => {});
        return true;
      } catch (_) { return false; }
    }

    // -------- translation bridge --------
    function requestTranslation(idx) {
      const cue = state.cues[idx];
      if (!cue || cue.translation || cue.trPending) return;
      if (typeof opts.translateText !== 'function' &&
          (!window.TranslateRequest || typeof window.TranslateRequest.postMessage !== 'function')) return;
      const id = state.nextTrId++;
      state.pendingTr[id] = idx;
      cue.trPending = true;
      rerenderCue(idx);
      if (typeof opts.translateText === 'function') {
        Promise.resolve().then(() => opts.translateText(cue.text, state.translationSource, state.translationTarget))
          .then(result => receiveTranslation(id, result), error => receiveTranslation(id, null, String(error)));
        return;
      }
      try {
        window.TranslateRequest.postMessage(JSON.stringify({
          id,
          text: cue.text,
          source: state.translationSource,
          target: state.translationTarget,
        }));
      } catch (_) {
        delete state.pendingTr[id];
        cue.trPending = false;
      }
    }

    // Flutter calls this back. (Optional 3rd arg is an error message.)
    function receiveTranslation(id, result, err) {
      const idx = state.pendingTr[id];
      delete state.pendingTr[id];
      if (idx == null) return;
      const cue = state.cues[idx];
      if (!cue) return;
      cue.trPending = false;
      if (err) { cue.translation = '(err)'; }
      else cue.translation = String(result || '');
      rerenderCue(idx);
      onTranslationDone(idx);
    }
    if (typeof opts.translateText !== 'function') window.__cupTranslated = receiveTranslation;

    // -------- strategy hooks (PLAYBACK-driven) --------
    // Called from syncHighlight when the playhead ENTERS cue `idx` (the
    // active cue changed). This is the single trigger for chunk progression
    // — replacing the old cue-arrival trigger, which fired off buffered
    // cues the user hadn't watched yet and made the video skip forward.
    function onPlayheadCue(idx) {
      if (idx < 0) return;
      const cue = state.cues[idx];
      if (!cue || !state.currentVideo) return;

      if (state.strategy === 2) {
        if (!state.translationEnabled) return;
        // Pause if the cue under the playhead isn't translated yet.
        if (!cue.translation) { dlog('strategy2: untranslated cue', idx, '→ pause'); ourPause(); }
        return;
      }
      if (state.strategy !== 3 && state.strategy !== 4 && state.strategy !== 5) return;
      if (state.currentVideo.canSeek === false) return;
      if (state.chunkReplaying) return;
      // Ignore cues inside a region we already replayed this session.
      if (cue.start < state.chunkFloor - 0.01) return;

      // (Re)anchor the chunk to this cue if we have no anchor, the anchor is
      // ahead of us (shouldn't happen), or the anchor predates the floor.
      if (state.chunkStartIdx == null ||
          idx < state.chunkStartIdx ||
          !state.cues[state.chunkStartIdx] ||
          state.cues[state.chunkStartIdx].start < state.chunkFloor - 0.01) {
        state.chunkStartIdx = idx;
      }
      const watched = idx - state.chunkStartIdx + 1;
      dlog('playhead@cue', idx, 'watched', watched, '/', state.linesPerChunk);
      if (watched >= state.linesPerChunk) {
        state.chunkStart = state.cues[state.chunkStartIdx].start;
        state.chunkEnd = cue.end || cue.start + 3;
        state.chunkReplaying = true;
        state.currentPass = 0;
        dlog('chunk full [', state.chunkStart.toFixed(2), ',', state.chunkEnd.toFixed(2), '] → replay');
        ourPause();
        // Translations for this chunk may already be in (fast translator), in
        // which case no onTranslationDone fires — try to start the replay now.
        checkChunkAndReplay();
      }
    }

    // Empty the list and everything that points into it by position: the
    // selection, translations still on their way, and the chunk being played.
    // Used by the clear button, and when the page moves on to another video,
    // whose timeline starts over.
    function clearCues({resume = true} = {}) {
      state.cues = []; state.activeIdx = -1;
      state.selected = new Set();
      state.pendingTr = Object.create(null);
      // A replay in progress may have slowed the video down, or paused it to
      // wait for translations or between passes. The chunk it belonged to is
      // gone, so leave the video at normal speed and playing — unless the
      // pause was the viewer's own, which ourPlay leaves alone.
      const replaying = state.chunkReplaying || state.currentPass > 0;
      if (replaying && state.currentVideo) {
        try { state.currentVideo.playbackRate = 1; } catch (_) {}
      }
      resetChunk();
      if (resume && replaying && state.currentVideo && state.currentVideo.paused) ourPlay();
      state.chunkFloor = 0;
      if (state.listEl) state.listEl.replaceChildren();
      syncPickUi();
    }

    // Reset the in-flight chunk/replay state. Does NOT clear chunkFloor — the
    // caller decides whether the just-replayed region should be re-chunkable.
    function resetChunk() {
      dlog('resetChunk (was pass', state.currentPass, '/', maxPasses(), ')');
      state.chunkReplaying = false;
      state.chunkStartIdx = null;
      state.chunkStart = null;
      state.chunkEnd = null;
      state.currentPass = 0;
      // Invalidate any in-flight gap-timer callback.
      state.passToken++;
      if (state.gapTimer != null) {
        clearTimeout(state.gapTimer);
        state.gapTimer = null;
      }
    }

    function startReplayPass(passIdx) {
      const rate = speedForPass(passIdx);
      state.currentPass = passIdx;
      state.lastSeekAt = Date.now();
      dlog('startReplayPass', passIdx, '/', state.repeatCount, 'rate=', rate,
           'seek→', state.chunkStart);
      try {
        state.currentVideo.currentTime = state.chunkStart;
        state.currentVideo.playbackRate = rate;
      } catch (_) {}
      ourPlay();
    }

    // Schedule starting a replay pass after an optional gap. Strategy 5 uses
    // the configured replayGap; strategies 3/4 fire immediately. A passToken
    // captured at schedule time lets the timer abort if the user / a reset
    // moved on while we were waiting.
    function startReplayPassWithGap(passIdx) {
      const gapSec = (state.strategy === 5) ? Math.max(0, state.replayGap || 0) : 0;
      if (gapSec <= 0) { startReplayPass(passIdx); return; }
      ourPause();
      if (state.gapTimer != null) clearTimeout(state.gapTimer);
      const token = ++state.passToken;
      dlog('gap', gapSec, 's before pass', passIdx, '(token', token, ')');
      state.gapTimer = setTimeout(() => {
        state.gapTimer = null;
        if (token !== state.passToken) { dlog('gap fired but token stale; abort'); return; }
        if (!state.chunkReplaying || state.chunkStart == null) return;
        startReplayPass(passIdx);
      }, gapSec * 1000);
      updateStatus();
    }

    // Start replaying the current chunk once every cue inside it is
    // translated (when translation is on). Shared by strategies 3/4/5 —
    // strategy 3 is just maxPasses()===1 at 1x. Pass progression past the
    // first pass is driven by replayTick() as each pass reaches chunkEnd.
    function checkChunkAndReplay() {
      if (state.strategy !== 3 && state.strategy !== 4 && state.strategy !== 5) return;
      if (!state.chunkReplaying || !state.currentVideo || state.chunkStart == null) return;
      if (state.translationEnabled) {
        for (let i = 0; i < state.cues.length; i++) {
          const c = state.cues[i];
          if (c.start < state.chunkStart - 0.01) continue;      // before chunk
          if (c.start > state.chunkEnd + 0.01) break;            // past chunk
          if (c.trPending) { dlog('replay waiting on translations'); return; }
        }
      }
      startReplayPassWithGap(1);
    }

    // Replay-pass progression for strategies 3/4/5: invoked from syncHighlight
    // on every timeupdate. When the current pass crosses chunkEnd, either
    // advance to the next pass (more repeats configured) or wrap up: set
    // chunkFloor to chunkEnd (so we don't re-chunk this region) and resume
    // 1x forward play. Also detects user seeks outside the chunk and abandons
    // the replay so navigation works freely.
    function replayTick() {
      if (state.strategy !== 3 && state.strategy !== 4 && state.strategy !== 5) return;
      if (!state.chunkReplaying) return;
      if (state.currentPass < 1) return;
      if (state.chunkEnd == null || state.chunkStart == null || !state.currentVideo) return;
      // Don't double-fire while we're waiting out a strategy-5 gap.
      if (state.gapTimer != null) return;
      // Defensive: re-apply our expected rate every timeupdate. SVT's player
      // has its own speed selector that can reset video.playbackRate
      // mid-pass; without this our schedule silently stops being honored.
      const expectedRate = speedForPass(state.currentPass);
      if (Math.abs((state.currentVideo.playbackRate || 1) - expectedRate) > 0.01) {
        try { state.currentVideo.playbackRate = expectedRate; } catch (_) {}
      }
      // Skip the post-seek window — stale timeupdates can fire with the
      // pre-seek currentTime and falsely trip the chunkEnd check.
      if (Date.now() - state.lastSeekAt < 500) return;
      const t = state.currentVideo.currentTime;
      // User dragged the scrubber outside the chunk → exit replay cleanly and
      // allow re-chunking from wherever they landed.
      if (t < state.chunkStart - 5 || t > state.chunkEnd + 5) {
        dlog('playhead left chunk (t=', t.toFixed(2), ') → abandon replay');
        try { state.currentVideo.playbackRate = 1; } catch (_) {}
        state.chunkFloor = 0;
        resetChunk();
        return;
      }
      if (t < state.chunkEnd) return;
      const next = state.currentPass + 1;
      dlog('chunkEnd reached at t=', t.toFixed(2), '→ pass', next, '/', maxPasses());
      if (next > maxPasses()) {
        // All repeats done; resume normal forward play at 1x. Block this
        // region from re-triggering a chunk so we move on instead of looping.
        try { state.currentVideo.playbackRate = 1; } catch (_) {}
        state.chunkFloor = state.chunkEnd;
        resetChunk();
        return;
      }
      // Mark currentPass = next BEFORE scheduling. Otherwise a second
      // timeupdate from the same boundary (browsers can deliver two with
      // the same currentTime) would also see currentPass=old and bump
      // again, double-advancing through the schedule.
      state.currentPass = next;
      startReplayPassWithGap(next);
    }

    function onTranslationDone(idx) {
      if (state.strategy === 2) {
        // If nothing is still pending for any cue at-or-before currentTime, play.
        if (!state.currentVideo) return;
        const t = state.currentVideo.currentTime;
        let blocking = false;
        for (let i = 0; i < state.cues.length; i++) {
          const c = state.cues[i];
          if (c.start > t + 0.5) break;
          if (c.trPending) { blocking = true; break; }
        }
        if (!blocking) ourPlay();
      } else if (state.strategy === 3 || state.strategy === 4 || state.strategy === 5) {
        checkChunkAndReplay();
      }
    }

    // Update the small status indicator in the header (`Pass i/N · Zx`).
    // Shown only while in a replay phase; cleared when forward play resumes.
    function updateStatus() {
      if (!state.sidebar) return;
      // While selecting, the status span carries the selection count; the
      // replay indicator would otherwise clear it on the next tick.
      if (state.picking) return;
      const el = state.sidebar.querySelector('[data-r="status"]');
      if (!el) return;
      const inReplay = state.chunkReplaying && state.currentPass >= 1;
      if (!inReplay) {
        if (el.textContent) el.textContent = '';
        return;
      }
      const total = state.repeatCount;
      const rate = state.currentVideo
        ? (state.currentVideo.playbackRate || 1)
        : speedForPass(state.currentPass);
      const gap = (state.strategy === 5 && state.gapTimer != null) ? ' · gap' : '';
      const txt = 'Pass ' + state.currentPass + '/' + total + ' · ' +
                  rate.toFixed(2).replace(/\.?0+$/, '') + '×' + gap;
      if (el.textContent !== txt) el.textContent = txt;
    }

    // -------- settings modal --------
    function openSettingsDialog() {
      injectCss();
      const wrap = document.createElement('div');
      wrap.className = 'cup-sub-modal cup-nolookup';
      const field = (label, name, type, value, attrs = {}, labelAttrs = {}) =>
        node('label', labelAttrs, [label, node('input', {
          type, 'data-f': name, ...attrs,
          ...(type === 'checkbox' ? {checked: !!value} : {value}),
        })]);
      const strategies = [
        'Keep playing, translate as cues arrive', 'Pause until current cue is translated',
        'Play N lines, then replay with translations', 'Like 3, but configurable replay speed & repeats',
        'Like 4, plus configurable gap between passes',
      ];
      wrap.append(node('div', {class: 'cup-sub-modal-box'}, [
        node('h3', {}, ['Subtitles · settings']),
        field('Translation', 'enabled', 'checkbox', state.translationEnabled),
        field('Source language', 'source', 'text', state.translationSource, {placeholder: 'sv'}),
        field('Target language', 'target', 'text', state.translationTarget, {placeholder: 'en'}),
        node('label', {}, ['Strategy', node('select', {'data-f': 'strategy'},
          strategies.map((label, i) => node('option', {value: i + 1, selected: state.strategy === i + 1},
            [(i + 1) + ' · ' + label])))]),
        field('Lines per chunk', 'lines', 'number', state.linesPerChunk,
          {min: 1, max: 50}, {'data-show-for': '3 4 5'}),
        field('Repeats', 'repeatCount', 'number', state.repeatCount,
          {min: 0, max: 10}, {'data-show-for': '4 5'}),
        field('Speed schedule', 'schedule', 'text', state.replaySchedule, {placeholder: '1-0.7'},
          {'data-show-for': '4 5', title: 'Hyphen-separated speeds, one per pass; last value extends. Example: 1-0.7'}),
        field('Gap seconds', 'gap', 'number', state.replayGap, {min: 0, max: 30, step: 0.5},
          {'data-show-for': '5', title: 'Pause this many seconds between consecutive passes.'}),
        field('Debug logging', 'debug', 'checkbox', state.debug, {},
          {title: 'Log strategy transitions to the console.'}),
        node('div', {class: 'cup-sub-modal-actions'}, [
          node('button', {'data-act': 'cancel', type: 'button'}, ['Cancel']),
          node('button', {'data-act': 'save', type: 'button'}, ['Save']),
        ]),
      ]));
      document.body.appendChild(wrap);
      wrap.addEventListener('click', (e) => { if (e.target === wrap) wrap.remove(); });
      // Per-strategy field visibility — update on initial render and whenever
      // the strategy <select> changes so unused inputs disappear cleanly.
      const stratSel = wrap.querySelector('[data-f="strategy"]');
      function applyVisibility() {
        const cur = String(stratSel.value);
        wrap.querySelectorAll('[data-show-for]').forEach(el => {
          const allowed = el.getAttribute('data-show-for').split(/\s+/);
          el.style.display = allowed.includes(cur) ? '' : 'none';
        });
      }
      stratSel.addEventListener('change', applyVisibility);
      applyVisibility();
      wrap.querySelector('[data-act="cancel"]').onclick = () => wrap.remove();
      wrap.querySelector('[data-act="save"]').onclick = () => {
        const get = sel => wrap.querySelector('[data-f="' + sel + '"]');
        state.translationEnabled = get('enabled').checked;
        state.translationSource  = (get('source').value || 'sv').trim();
        state.translationTarget  = (get('target').value || 'en').trim();
        state.strategy           = parseInt(get('strategy').value, 10) || 1;
        state.linesPerChunk      = Math.max(1, Math.min(50, parseInt(get('lines').value, 10) || 5));
        state.repeatCount        = Math.max(0, Math.min(10, parseInt(get('repeatCount').value, 10) || 1));
        state.replaySchedule     = (get('schedule').value || '1-0.7').trim();
        state.replayGap          = Math.max(0, Math.min(30, parseFloat(get('gap').value) || 0));
        state.debug              = !!get('debug').checked;
        try { window.cupSubDebug = state.debug; } catch (_) {}
        // Changing strategy/chunk settings starts fresh: drop any in-flight
        // chunk and let a new one anchor from the current playhead.
        if (state.currentVideo) { try { state.currentVideo.playbackRate = 1; } catch (_) {} }
        state.chunkFloor = 0;
        resetChunk();
        persistPrefs();
        wrap.remove();
        // Reflect on the translate button
        const btn = state.sidebar && state.sidebar.querySelector('[data-act="translate"]');
        if (btn) btn.classList.toggle('cup-on', state.translationEnabled);
        if (state.translationEnabled) {
          for (let i = 0; i < state.cues.length; i++) {
            if (!state.cues[i].translation) requestTranslation(i);
          }
        }
      };
    }

    function syncHighlight() {
      if (!state.currentVideo) return;
      if (!Number.isFinite(state.currentVideo.currentTime)) {
        const previous = state.listEl && state.listEl.children[state.activeIdx];
        if (previous) previous.classList.remove('cup-active');
        state.activeIdx = -1;
        return;
      }
      // Pass-progression for an in-flight replay runs first so a chunk-end
      // transition takes effect immediately.
      replayTick();
      updateStatus();
      // Find the cue under the playhead (binary search on sorted cues). This
      // drives BOTH chunk progression (onPlayheadCue) and the row highlight,
      // so it runs even when there's no list element.
      const t = state.currentVideo.currentTime;
      let lo = 0, hi = state.cues.length - 1, idx = -1;
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const c = state.cues[mid];
        if (t < c.start) hi = mid - 1;
        else if (t > c.end) lo = mid + 1;
        else { idx = mid; break; }
      }
      if (idx === state.activeIdx) return;
      // Active cue changed → advance chunk progression for the new cue.
      onPlayheadCue(idx);
      if (!state.listEl) { state.activeIdx = idx; return; }
      if (state.activeIdx >= 0) {
        const prev = state.listEl.children[state.activeIdx];
        if (prev) prev.classList.remove('cup-active');
      }
      state.activeIdx = idx;
      if (idx >= 0) {
        const el = state.listEl.children[idx];
        if (el) {
          el.classList.add('cup-active');
          if (state.autoScroll) {
            try { el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } catch (_) {}
          }
        }
      }
    }

    function setVideoElement(v) {
      if (v === state.currentVideo) return;
      // SVT swaps the <video> across ad breaks / source switches. Strip
      // listeners from the previous element so they don't fire on a
      // detached node and double-advance the strategy state.
      if (state.currentVideo && state.videoListeners) {
        const old = state.currentVideo, l = state.videoListeners;
        try { old.removeEventListener('timeupdate', l.timeupdate); } catch (_) {}
        try { old.removeEventListener('pause', l.pause); } catch (_) {}
        try { old.removeEventListener('play', l.play); } catch (_) {}
      }
      // Swap aborts any in-flight chunk — its indices/floor belong to the old
      // element's timeline and would mis-fire against the new one.
      if (state.chunkReplaying || state.chunkStartIdx != null) {
        dlog('video element swapped; resetting chunk state');
        resetChunk();
      }
      state.chunkFloor = 0;
      state.expectedPauses = 0;
      state.expectedPlays = 0;
      state.playDeferred = false;
      state.userOverrode = false;
      state.currentVideo = v;
      state.videoListeners = null;
      if (!v) return;
      const listeners = {
        timeupdate: syncHighlight,
        pause: () => {
          if (state.expectedPauses > 0) {
            state.expectedPauses--;
            dlog('pause: ours (remaining expected =', state.expectedPauses, ')');
            return;
          }
          // The app paused it for a lookup and plays it again on release —
          // not the user stopping playback.
          if (v.__cupLookupHeld) { dlog('pause: lookup hold'); return; }
          state.userOverrode = true;
          dlog('pause: user → userOverrode=true');
        },
        play: () => {
          // Checked first so the mark is always used up by the play it
          // belongs to, never left for the user's next one.
          if (v.__cupLookupResuming) {
            v.__cupLookupResuming = false;
            dlog('play: lookup release');
            return;
          }
          if (state.expectedPlays > 0) {
            state.expectedPlays--;
            dlog('play: ours (remaining expected =', state.expectedPlays, ')');
            return;
          }
          // User resume — clear the override AND drop any pending replay
          // state so we don't fight them.
          if (state.chunkReplaying) {
            dlog('play: user during replay → abandoning replay');
            try { state.currentVideo.playbackRate = 1; } catch (_) {}
            resetChunk();
          }
          state.userOverrode = false;
        },
      };
      state.videoListeners = listeners;
      v.addEventListener('timeupdate', listeners.timeupdate);
      v.addEventListener('pause', listeners.pause);
      v.addEventListener('play', listeners.play);
    }

    // Wrappers that mark our own pause/play with a counter so the
    // listeners above can tell user actions from automation without a
    // racy time window.
    function ourPause() {
      if (!state.currentVideo) return;
      if (state.currentVideo.paused) {
        // No pause event will fire — don't bump the counter or a future
        // user pause will be mis-attributed to us.
        return;
      }
      state.expectedPauses++;
      try { state.currentVideo.pause(); } catch (e) { state.expectedPauses--; }
    }
    window.addEventListener('cupitorLookupRelease', () => {
      if (!state.playDeferred) return;
      state.playDeferred = false;
      if (state.currentVideo && state.currentVideo.isConnected) ourPlay();
    });
    function ourPlay() {
      if (!state.currentVideo) return;
      if (state.userOverrode) { dlog('ourPlay suppressed (userOverrode)'); return; }
      if (!state.currentVideo.paused) return; // already playing, no event would fire
      // Don't start playing behind the lookup dialog; release plays it.
      if (window.__cupLookupHold) { state.playDeferred = true; dlog('ourPlay deferred (lookup hold)'); return; }
      state.expectedPlays++;
      const p = state.currentVideo.play();
      if (p && typeof p.catch === 'function') p.catch(() => { state.expectedPlays = Math.max(0, state.expectedPlays - 1); });
    }

    return {
      addCue, clearCues, replaceCues, buildSidebar, setSplit, setVideoElement,
      setImportBusy(busy) {
        state.importBusy = !!busy;
        const button = state.sidebar && state.sidebar.querySelector('[data-act="open-srt"]');
        if (button) button.disabled = state.importBusy || !state.importAvailable;
      },
      setImportAvailable(available) {
        state.importAvailable = !!available;
        const button = state.sidebar && state.sidebar.querySelector('[data-act="open-srt"]');
        if (button) button.disabled = state.importBusy || !state.importAvailable;
      },
      showNotice(message) {
        buildSidebar();
        const notice = state.sidebar.querySelector('[data-r="notice"]');
        notice.textContent = message;
        notice.hidden = !message;
      },
      get currentVideo() { return state.currentVideo; },
      get element() { return state.sidebar; },
      get cueCount() { return state.cues.length; },
      get sourceLanguage() { return state.translationSource; },
    };
  }
  // ── The address a captured block is sent under ───────────────────────
  //
  // It is the block's identity: the webapp matches it to recognise lines it
  // has already filed from this video, so it has to mean the same thing every
  // time. A player rewrites its own address as it plays, so whatever start
  // offset the page is showing is taken OUT — a video watched to 12:30 and
  // the same video at 0:00 are one page.
  //
  // The card's link back to a moment is built by the webapp, from the same
  // parameter name and the lines it actually files.

  // Whether a link to one moment is worth making on this page. A site entry
  // says so with a predicate, or with a plain value read for truth, or says
  // nothing at all and means everywhere.
  //
  // One rule the whole way down: anything that is not a no is a yes. The host
  // and the webapp read the answer the same way, so a value that reads as
  // "link here" cannot become "don't" by crossing a layer. The configuration
  // is fetched at runtime, so a predicate that throws is a thing to survive
  // rather than a bug report — and there, with no answer at all, no link is
  // the one that cannot be wrong.
  function timeLinkWanted(timeLinkOn) {
    if (timeLinkOn == null) return true;
    if (typeof timeLinkOn !== 'function') return !!timeLinkOn;
    try {
      return !!timeLinkOn();
    } catch (_) {
      return false;
    }
  }

  // The parameter's name as the site entry spells it. Anything that is not a
  // name leaves us unable to find the offset, let alone write one.
  function timeParamName(timeParam) {
    return typeof timeParam === 'string' ? timeParam.trim() : '';
  }

  // Only an ordinary web page is rewritten. A relative address resolved
  // against the current page would become a link to wherever we happen to be
  // — which reads as a working link to the wrong place — and a blob: or
  // about: address is not somewhere anyone can be sent back to.
  function isWebPage(url) {
    try {
      const p = new URL(url).protocol;
      return p === 'http:' || p === 'https:';
    } catch (_) {
      return false;
    }
  }

  // Query surgery by hand, on purpose. Reading the query into URLSearchParams
  // and writing it back re-encodes every OTHER parameter — a bare `?flag`
  // comes back as `?flag=`, and characters it escapes differently change
  // shape — so the link would differ from the page in ways nobody asked for.
  // Splitting the string touches only the parameter named.
  function splitUrl(url) {
    const h = url.indexOf('#');
    const head = h >= 0 ? url.slice(0, h) : url;
    const q = head.indexOf('?');
    return {
      base: q >= 0 ? head.slice(0, q) : head,
      parts: q >= 0 ? head.slice(q + 1).split('&').filter(Boolean) : [],
      hash: h >= 0 ? url.slice(h) : '',
    };
  }

  function joinUrl(u) {
    return u.base + (u.parts.length ? '?' + u.parts.join('&') : '') + u.hash;
  }

  // Whether this piece of the query is the named parameter. A page writes the
  // name either way round, so both spellings count.
  function isParam(part, name) {
    const key = part.split('=')[0];
    return key === name || key === encodeURIComponent(name);
  }

  // The page without whatever start offset it happens to be showing. Done
  // whenever the player HAS such a parameter, whatever this particular page
  // thinks of linking at a moment: identity has to hold still even on the
  // pages where a link would be meaningless, or two sends from one video at
  // different moments de-duplicate against nothing.
  function stripTimeParam(url, timeParam) {
    const name = timeParamName(timeParam);
    if (!name || !isWebPage(url)) return url;
    const u = splitUrl(url);
    u.parts = u.parts.filter(p => !isParam(p, name));
    return joinUrl(u);
  }

  // The block one send puts on the wire. Pure, so the shape that leaves the
  // page can be checked without a player, a sidebar or a selection.
  //
  // The parameter is named rather than used. Only the webapp knows which of
  // these lines reach the card — it drops the ones already captured from this
  // video — and the link has to point at the earliest moment among those, not
  // among everything ticked, or it opens at a passage filed on another card.
  function capturePayload(href, title, lang, lines, timeParam, timeLinkOn) {
    const name = timeParamName(timeParam);
    return {
      title: (title || '').trim(),
      url: stripTimeParam(href, name),
      // Two separate facts, and they used to share a field, which cost the
      // webapp its ability to recognise an older card on any page where a
      // link was not wanted. The NAME goes out always: it is what lets the
      // webapp take the offset off an address a card stored before this, so
      // identity matches. Whether to LINK is its own answer.
      timeParam: name,
      timeLink: timeLinkWanted(timeLinkOn),
      lang: lang || '',
      lines,
    };
  }

  shared.createSubtitleUI = createSubtitleUI;
  shared.capturePayload = capturePayload;
  shared.stripTimeParam = stripTimeParam;
  shared.timeParamName = timeParamName;
})();
// Mobile Spotify can play an Audio() element that was never attached to the
// DOM, and can omit its desktop seek bar entirely. Observe the public media
// interfaces as Spotify uses them; retain its original methods and handlers.
(function () {
  const shared = window.__cupShared || (window.__cupShared = {});
  function getBridge() {
    if (window.__cupSpotifyPlaybackBridge) return window.__cupSpotifyPlaybackBridge;
    const bridge = {
      media: [], handlers: Object.create(null), position: null,
      playbackState: 'none', keyProvider: null,
    };
    window.__cupSpotifyPlaybackBridge = bridge;
    function remember(media) {
      if (!media || bridge.media.includes(media)) return;
      bridge.media.push(media);
      if (bridge.media.length > 8) bridge.media.shift();
    }
    bridge.remember = remember;
    const proto = window.HTMLMediaElement && window.HTMLMediaElement.prototype;
    if (proto) {
      for (const name of ['play', 'pause', 'load']) {
        const original = proto[name];
        if (typeof original !== 'function') continue;
        try {
          proto[name] = function (...args) {
            remember(this);
            return original.apply(this, args);
          };
        } catch (_) { /* Some engines expose non-writable media methods. */ }
      }
    }
    function elapsedPosition() {
      const p = bridge.position;
      if (!p) return null;
      const elapsed = bridge.playbackState === 'playing' ? (Date.now() - p.updatedAt) / 1000 : 0;
      return Math.max(0, Math.min(p.duration, p.position + elapsed * p.playbackRate));
    }
    function playbackChanged(next) {
      if (next === bridge.playbackState) return;
      const position = elapsedPosition();
      if (bridge.position && position != null) {
        bridge.position.position = position;
        bridge.position.updatedAt = Date.now();
      }
      bridge.playbackState = next;
    }
    let session;
    try { session = navigator.mediaSession; } catch (_) {}
    bridge.session = session;
    if (session) {
      bridge.playbackState = session.playbackState || 'none';
      try {
        const original = session.setActionHandler;
        if (typeof original === 'function') session.setActionHandler = function (action, handler) {
          const result = original.call(this, action, handler);
          bridge.handlers[action] = typeof handler === 'function' ? handler : null;
          return result;
        };
      } catch (_) {}
      try {
        const original = session.setPositionState;
        if (typeof original === 'function') session.setPositionState = function (state) {
          const result = original.apply(this, arguments);
          bridge.playbackState = session.playbackState || 'none';
          bridge.position = state && state.duration > 0 && Number.isFinite(state.position ?? 0)
            ? {duration: state.duration, position: state.position ?? 0,
              playbackRate: state.playbackRate || 1, updatedAt: Date.now(),
              key: bridge.keyProvider ? bridge.keyProvider() : ''}
            : null;
          return result;
        };
      } catch (_) {}
      // Anchor the clock when paused, rather than snapping back to the last
      // position Spotify reported or extrapolating through a long pause.
      try {
        let owner = session, descriptor;
        while (owner && !descriptor) {
          descriptor = Object.getOwnPropertyDescriptor(owner, 'playbackState');
          owner = Object.getPrototypeOf(owner);
        }
        if (descriptor && descriptor.get && descriptor.set) {
          Object.defineProperty(session, 'playbackState', {
            configurable: true,
            get() { return descriptor.get.call(this); },
            set(value) {
              descriptor.set.call(this, value);
              playbackChanged(value);
            },
          });
        }
      } catch (_) {}
    }
    bridge.readPosition = () => {
      if (session) playbackChanged(session.playbackState || 'none');
      const position = elapsedPosition();
      return bridge.position && position != null ? {...bridge.position, position} : null;
    };
    return bridge;
  }
  shared.getSpotifyPlaybackBridge = getBridge;
  // Runs before DOM readiness, before Spotify creates or starts its player.
  if (location.hostname === 'open.spotify.com') getBridge();
})();
// Spotify's audio can be hidden, replaced or playing on a Connect device.
// Adapt its visible player to the media-element interface used by the sidebar;
// no Spotify token or second player is needed.
(function () {
  const shared = window.__cupShared || (window.__cupShared = {});
  const playbackBridge = () => typeof shared.getSpotifyPlaybackBridge === 'function'
    ? shared.getSpotifyPlaybackBridge() : null;
  const playerRoot = () => document.querySelector(
    '[data-testid="now-playing-widget"], [data-testid="now-playing-bar"], .Root__now-playing-bar');
  function mediaUrl() {
    const root = playerRoot();
    const link = root && root.querySelector('a[href*="/track/"], a[href*="/episode/"]');
    const match = /\/(track|episode)\/([A-Za-z0-9]+)(?:[/?#]|$)/.exec(
      link ? link.getAttribute('href') : location.pathname);
    return match ? 'https://open.spotify.com/' + match[1] + '/' + match[2] : '';
  }
  const controls = () => document.querySelector('[data-testid="control-button-playpause"]:not(:disabled)');
  function progress() {
    const root = document.querySelector('[data-testid="playback-progressbar"]');
    if (!root) return null;
    if (root.matches('input, [role="slider"]')) return root;
    // A selector list uses DOM order, not selector priority: including the
    // wrapper in the same query always selected it before its real slider.
    return root.querySelector('input[type="range"]') || root.querySelector('[role="slider"]') ||
      root.querySelector('[data-testid="progress-bar"]') || root;
  }
  function clockSeconds(value) {
    if (!value || !/^\d+:\d{2}(?::\d{2})?$/.test(value)) return null;
    return value.split(':').reduce((total, part) => total * 60 + Number(part), 0);
  }
  function clock(selector) {
    const el = document.querySelector(selector);
    return clockSeconds(el && el.textContent.trim());
  }
  function accessibleDuration() {
    const text = progress()?.getAttribute('aria-valuetext') || '';
    const stamps = text.match(/\d+(?::\d{2}){1,2}/g) || [];
    return stamps.length === 2 ? clockSeconds(stamps[1]) : null;
  }
  function nativeMedia() {
    const bridge = playbackBridge();
    const candidates = [...new Set([...(bridge ? [...bridge.media].reverse() : []),
      ...document.querySelectorAll('audio, video')])];
    const hint = clock('[data-testid="playback-duration"]') || accessibleDuration();
    const usable = candidates.filter(media => Number.isFinite(media.currentTime) &&
      (media.readyState > 0 || media.currentTime > 0 || media.duration > 0) &&
      (!hint || !Number.isFinite(media.duration) || Math.abs(media.duration - hint) < 3));
    return usable.find(media => !media.paused && !media.ended) || usable[0] || null;
  }
  function sessionPosition() {
    const state = playbackBridge()?.readPosition();
    return state && (!state.key || state.key === mediaUrl()) ? state : null;
  }
  function observedPaused() {
    const media = nativeMedia();
    if (media) return media.paused;
    const state = playbackBridge()?.session?.playbackState;
    if (state === 'playing') return false;
    if (state === 'paused') return true;
    const button = controls();
    if (button) {
      const label = button.getAttribute('aria-label') || button.title || '';
      if (/pause|paus|pausa|暂停|一時停止|일시.*정지/i.test(label)) return false;
      if (/play|spela|reproducir|wiedergabe|lecture|riproduci|播放|再生|재생/i.test(label)) return true;
    }
    return nativeMedia()?.paused ?? true;
  }
  function createPlayer() {
    const bridge = playbackBridge();
    if (bridge) {
      bridge.keyProvider = mediaUrl;
      if (bridge.position && !bridge.position.key) bridge.position.key = mediaUrl();
    }
    const events = document.createDocumentFragment();
    let lastPaused = true;
    let pendingPause = null, pendingSeek = null;
    let boundKey = mediaUrl();
    let lastSource = '';
    function notifyPaused(paused) {
      if (paused === lastPaused) return;
      lastPaused = paused;
      events.dispatchEvent(new Event(paused ? 'pause' : 'play'));
    }
    function setPaused(paused) {
      if (player.paused === paused) return Promise.resolve();
      const button = controls(), media = nativeMedia();
      const action = paused ? 'pause' : 'play';
      const handler = bridge && bridge.handlers[action];
      if (!media && !handler && !button) return Promise.resolve();
      pendingPause = {value: paused, until: Date.now() + 1500};
      let result;
      if (media) result = paused ? media.pause() : media.play();
      else if (handler) result = handler({action});
      else button.click();
      // Deliver every programmatic pause/play, even a pause immediately
      // followed by replay. Polling only the final state would lose both.
      notifyPaused(paused);
      return result || Promise.resolve();
    }
    function rememberSeek(time) {
      pendingSeek = null;
      if (Math.abs(player.currentTime - time) > 1) pendingSeek = {time, until: Date.now() + 500};
    }
    const player = {
      get isConnected() { return !!controls() || !!nativeMedia() || !!sessionPosition(); },
      get duration() {
        const mediaDuration = nativeMedia()?.duration;
        return Number.isFinite(mediaDuration) && mediaDuration > 0 ? mediaDuration :
          sessionPosition()?.duration || clock('[data-testid="playback-duration"]') || accessibleDuration() || 0;
      },
      get currentTime() {
        if (pendingSeek && Date.now() < pendingSeek.until) return pendingSeek.time;
        pendingSeek = null;
        const media = nativeMedia();
        if (media) return media.currentTime;
        const session = sessionPosition();
        if (session) return session.position;
        const bar = progress();
        if (bar && !bar.disabled && player.duration > 0) {
          const min = Number(bar.getAttribute('aria-valuemin') || bar.min || 0);
          const max = Number(bar.getAttribute('aria-valuemax') || bar.max || 100);
          const now = Number(bar.getAttribute('aria-valuenow') ?? bar.value);
          if (Number.isFinite(now) && max > min) return (now - min) / (max - min) * player.duration;
        }
        // SRT cue boundaries contain milliseconds. Reading the rounded text
        // first could miss an entire short cue between two displayed seconds.
        return clock('[data-testid="playback-position"]') ?? NaN;
      },
      set currentTime(time) { player.seekTo(time); },
      seekTo(time) {
        if (!Number.isFinite(time) || time < 0) return false;
        const duration = player.duration;
        const target = duration > 0 ? Math.min(duration, time) : time;
        const media = nativeMedia();
        if (media) {
          media.currentTime = target;
          rememberSeek(target);
          return true;
        }
        if (bridge && typeof bridge.handlers.seekto === 'function') {
          bridge.handlers.seekto({action: 'seekto', seekTime: target, fastSeek: false});
          rememberSeek(target);
          return true;
        }
        const delta = target - player.currentTime;
        const action = delta < 0 ? 'seekbackward' : 'seekforward';
        if (Number.isFinite(delta) && bridge && typeof bridge.handlers[action] === 'function') {
          bridge.handlers[action]({action, seekOffset: Math.abs(delta)});
          rememberSeek(target);
          return true;
        }
        const bar = progress();
        if (!bar || bar.disabled || !duration) return false;
        if (bar.tagName === 'INPUT') {
          const min = Number(bar.min || 0), max = Number(bar.max || 100);
          const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
          setter.call(bar, String(min + target / duration * (max - min)));
          bar.dispatchEvent(new Event('input', {bubbles: true}));
          bar.dispatchEvent(new Event('change', {bubbles: true}));
          rememberSeek(target);
          return true;
        }
        const rect = bar.getBoundingClientRect();
        if (!rect.width) return false;
        const init = {bubbles: true, clientX: rect.left + rect.width * target / duration,
          clientY: rect.top + rect.height / 2, button: 0, view: window};
        // Spotify has used both pointer and mouse handlers for the seek bar.
        if (typeof PointerEvent === 'function') {
          bar.dispatchEvent(new PointerEvent('pointerdown', {...init, buttons: 1, pointerId: 1, pointerType: 'mouse'}));
          document.dispatchEvent(new PointerEvent('pointerup', {...init, pointerId: 1, pointerType: 'mouse'}));
        }
        bar.dispatchEvent(new MouseEvent('mousedown', {...init, buttons: 1}));
        document.dispatchEvent(new MouseEvent('mouseup', init));
        bar.dispatchEvent(new MouseEvent('click', init));
        rememberSeek(target);
        return true;
      },
      get canSeek() {
        return !!nativeMedia() || !!(bridge && (bridge.handlers.seekto ||
          (bridge.handlers.seekbackward && bridge.handlers.seekforward))) ||
          !!(progress() && !progress().disabled && player.duration > 0);
      },
      get statusMessage() {
        if (!Number.isFinite(player.currentTime)) return 'Spotify playback is not connected. Pause and resume the episode once to connect subtitles.';
        if (!player.canSeek) return 'Playback position detected, but seeking is not connected. Pause and resume Spotify once to connect its controls.';
        return '';
      },
      get paused() {
        const observed = observedPaused();
        if (pendingPause) {
          if (observed === pendingPause.value || Date.now() >= pendingPause.until) pendingPause = null;
          else return pendingPause.value;
        }
        return observed;
      },
      pause() { setPaused(true); },
      play() { return setPaused(false); },
      get playbackRate() { return nativeMedia()?.playbackRate || 1; },
      set playbackRate(rate) { const media = nativeMedia(); if (media) media.playbackRate = rate; },
      addEventListener: (...args) => events.addEventListener(...args),
      removeEventListener: (...args) => events.removeEventListener(...args),
      poll() {
        if (boundKey !== mediaUrl()) {
          boundKey = mediaUrl();
          pendingPause = null; pendingSeek = null;
          lastPaused = player.paused;
        }
        notifyPaused(player.paused);
        events.dispatchEvent(new Event('timeupdate'));
        const source = nativeMedia() ? 'audio/video' : sessionPosition() ? 'media-session' :
          progress() ? 'slider' : Number.isFinite(player.currentTime) ? 'clock-text' : 'unavailable';
        const diagnostic = source + ' seek=' + player.canSeek;
        if (diagnostic !== lastSource) { lastSource = diagnostic; console.log('[spotify] playback source=' + diagnostic); }
        const footer = document.querySelector('[data-testid="now-playing-bar"], .Root__now-playing-bar');
        const height = footer && footer.getBoundingClientRect().height;
        if (height > 0) document.body.style.setProperty('--cup-spotify-footer-h', height + 'px');
      },
    };
    lastPaused = player.paused;
    return player;
  }
  shared.spotifyMediaUrl = mediaUrl;
  shared.createSpotifyPlayer = createPlayer;
})();
// YouTube's mobile frame keeps an aspect-ratio wrapper around a separately
// positioned video. Resize the complete player stack together, so the native
// video's inline centering offsets cannot move its picture behind that wrapper.
(function () {
  const shared = window.__cupShared || (window.__cupShared = {});
  shared.createYouTubeSplitLayout = function (getVideo) {
    const marker = 'cup-youtube-frame';
    const properties = ['--cup-youtube-top', '--cup-youtube-left', '--cup-youtube-width'];
    const style = document.createElement('style');
    style.id = 'cup-youtube-split-css';
    style.textContent = `
      body.cup-sub-split #player-container-id.${marker},
      body.cup-sub-split #movie_player.${marker},
      body.cup-sub-split .html5-video-player.${marker} {
        position: fixed !important;
        top: var(--cup-youtube-top) !important;
        left: var(--cup-youtube-left) !important;
        right: auto !important; bottom: auto !important;
        width: var(--cup-youtube-width) !important;
        height: max(1px, calc(var(--cup-vid-h) - var(--cup-youtube-top))) !important;
        max-height: max(1px, calc(var(--cup-vid-h) - var(--cup-youtube-top))) !important;
        min-height: 0 !important; padding: 0 !important;
        box-sizing: border-box !important; overflow: hidden !important;
        transition: none !important;
      }
      body.cup-sub-split .${marker} #player,
      body.cup-sub-split .${marker} #movie_player,
      body.cup-sub-split .${marker} .html5-video-player,
      body.cup-sub-split .${marker} .html5-video-container {
        position: absolute !important; inset: 0 !important;
        width: 100% !important; height: 100% !important;
        max-height: 100% !important; min-height: 0 !important;
        padding: 0 !important; aspect-ratio: auto !important;
        transition: none !important;
      }
      /* Mobile controls are siblings of #player. Keep their native wrapper
         unexpanded: an empty full-frame wrapper intercepts video taps even
         while the actual controls are hidden. Order the visible overlay over
         the media without raising the whole player over YouTube's popups. */
      body.cup-sub-split #player-container-id.${marker} #player {
        z-index: 0 !important;
      }
      body.cup-sub-split #player-container-id.${marker} #player-control-overlay {
        z-index: 1 !important;
      }
      body.cup-sub-split .${marker} .html5-video-container {
        transform: none !important;
      }
      body.cup-sub-split .${marker} video {
        position: absolute !important; inset: 0 !important;
        width: 100% !important; height: 100% !important;
        max-width: 100% !important; max-height: 100% !important;
        margin: 0 !important; transform: none !important;
        object-fit: contain !important;
        transition: none !important;
      }
    `;
    (document.head || document.documentElement).appendChild(style);
    let frame = null, viewport = '', fullscreen = null, updating = false;

    function release() {
      if (!frame) return false;
      frame.classList.remove(marker);
      for (const property of properties) frame.style.removeProperty(property);
      frame = null;
      viewport = '';
      return true;
    }

    function update() {
      if (updating) return;
      updating = true;
      try {
        const video = getVideo();
        const next = video && (video.closest('#player-container-id') ||
          video.closest('#movie_player, .html5-video-player'));
        if (!document.body.classList.contains('cup-sub-split') || !next) {
          // Let YouTube recompute its normal inline geometry after our fixed
          // frame is released. The guard prevents a recursive resize loop.
          if (release()) window.dispatchEvent(new Event('resize'));
          return;
        }
        const size = window.innerWidth + ':' + window.innerHeight;
        if (next !== frame || size !== viewport || fullscreen !== document.fullscreenElement) {
          release();
          const rect = next.getBoundingClientRect();
          if (!(rect.width > 0)) return;
          frame = next;
          viewport = size;
          fullscreen = document.fullscreenElement;
          frame.style.setProperty(properties[0], Math.max(0, rect.top) + 'px');
          frame.style.setProperty(properties[1], rect.left + 'px');
          frame.style.setProperty(properties[2], rect.width + 'px');
          frame.classList.add(marker);
        }
      } finally { updating = false; }
    }

    window.addEventListener('resize', update);
    document.addEventListener('fullscreenchange', update);
    return {
      update,
      dispose() {
        window.removeEventListener('resize', update);
        document.removeEventListener('fullscreenchange', update);
        if (release()) window.dispatchEvent(new Event('resize'));
        style.remove();
      },
    };
  };
})();
// Which players the caption capture understands, and how to find their cues.
//
// This is the configuration surface. It is served from gh-pages and fetched
// at runtime, so adding a player or repairing a layout that changed is an
// edit here — never an app release.
(function () {
  const shared = window.__cupShared || (window.__cupShared = {});
  // -----------------------------------------------------------------------
  // Caption capture module
  //
  // Three capture paths, all running together:
  //   1) Read existing video.textTracks. If any has cues populated (or we
  //      can force mode='hidden' to populate them), we get the full
  //      transcript with accurate timing — best case.
  //   2) XHR/fetch hook: any response body starting with `WEBVTT` is a
  //      subtitle file. Parse it and push every cue.
  //   3) DOM observer fallback: mirror the on-screen cue container if the
  //      first two miss. This is the only path that needs per-site knowledge.
  //
  // CAPTION_SITES is the configuration surface. This file is served from
  // gh-pages and fetched at runtime, so adding a player or repairing a
  // changed layout is an edit here — no app release.
  //
  //   host          match the site by domain
  //   domProbe      match the site by the presence of this element, whatever
  //                 the domain (players identifiable by their own markup)
  //   domSelector   where the on-screen cue text lives, once matched
  //   cueSelector   optional inner element inside domSelector holding the cue
  //   shrinkSelectors  player frame(s) to shrink for split view
  //   isWatchPage   optional — restrict the sidebar to real video pages
  //   timeParam     optional — the query parameter this player reads a start
  //                 offset from, in whole seconds. Set it and a block sent to
  //                 the webapp links back to the moment the passage starts
  //                 instead of to the top of the video. Leave it out for a
  //                 player with no deep link: a parameter the player ignores
  //                 is worse than none, because the link still looks like it
  //                 should work.
  //   timeLinkOn    optional — a predicate (or a plain false) for pages where
  //                 that link is worth making, for a site whose player is
  //                 timed on some and live on others. It decides the link
  //                 only: `timeParam` is still sent, because naming the
  //                 parameter is what keeps the offset out of the page's
  //                 identity, and an identity that moved with playback would
  //                 de-duplicate against nothing.
  //
  // An entry needs `host` or `domProbe` to match. `domSelector` is only
  // needed for path 3; entries without one still get paths 1 and 2.
  // -----------------------------------------------------------------------
  const CAPTION_SITES = [
    {
      id: 'svt',
      host: /(^|\.)svtplay\.se$|(^|\.)svt\.se$/,
      // SVT uses obfuscated CSS-in-JS class names ("vp_b", "css-dgqlcd")
      // but reliable data-rt attributes for everything important.
      // Outermost player frame is data-rt="video-player-fullscreen".
      shrinkSelectors: [
        '[data-rt="video-player-fullscreen"]',
        '[data-rt="video-player-container"]',
        '[data-rt="video-player-frame"]',
      ],
      domSelector: '[data-rt="subtitles-container"]',
      cueSelector: '.vtt-cue-teletext',
      timeParam: 'position',
      // SVT Play's own videos and clips, and nothing else. A number on a live
      // channel's timeline means nothing to whoever opens the link an hour
      // later, and the svt.se article player — which this entry also matches
      // — is not known to read this at all. Anchored at the start of the path
      // so a `/klipp/` deeper inside a news article's address does not pass
      // for one, and the host is checked because svt.se has its own /video/.
      timeLinkOn: () =>
        /(^|\.)svtplay\.se$/.test(location.host) &&
        /^\/(video|klipp)\//.test(location.pathname),
      isWatchPage: () =>
        /\/video\//.test(location.pathname) ||
        /\/(klipp|kanaler)\//.test(location.pathname),
    },
    {
      id: 'urplay',
      host: /(^|\.)urplay\.se$/,
      domSelector: '.jw-text-track-display',
      shrinkSelectors: ['.jwplayer', '.jw-wrapper'],
    },
    {
      // Any JW Player page, whatever the domain — the markup identifies it.
      id: 'jwplayer',
      domProbe: '.jw-text-track-display',
      domSelector: '.jw-text-track-display',
      shrinkSelectors: ['.jwplayer', '.jw-wrapper'],
    },
    {
      id: 'youtube',
      host: /(^|\.)youtube(?:-nocookie)?\.com$|^youtu\.be$/,
      isWatchPage: () => {
        const url = new URL(location.href);
        return /^[A-Za-z0-9_-]{11}$/.test(url.searchParams.get('v') || '') ||
          /^\/(?:shorts|embed|live|v)\/[A-Za-z0-9_-]{11}(?:\/|$)/.test(url.pathname) ||
          (url.hostname === 'youtu.be' && /^\/[A-Za-z0-9_-]{11}(?:\/|$)/.test(url.pathname));
      },
      domSelector: '.ytp-caption-window-container',
      cueSelector: '.ytp-caption-segment',
      // Arrive at a video through a timed link and the address keeps `t`.
      // Naming it here is what stops that becoming a second identity for a
      // video already captured from its plain address.
      timeParam: 't',
      // Every video plays at /watch; the query names which one. Moving on to
      // another `v` is another video, and the caption list starts over.
      videoParams: ['v'],
      shrinkSelectors: ['#movie_player', '.html5-video-player'],
    },
    {
      id: 'spotify',
      host: /^open\.spotify\.com$/,
      timeParam: 't',
      // Podcast sharing supports a start time; music tracks do not. The
      // playing episode can differ from the Spotify page being browsed.
      timeLinkOn: () => /^https:\/\/open\.spotify\.com\/episode\//.test(shared.spotifyMediaUrl()),
      shrinkSelectors: [],
      mediaUrl: shared.spotifyMediaUrl,
      mediaKey: shared.spotifyMediaUrl,
      createPlayer: shared.createSpotifyPlayer,
      isWatchPage: () => !!shared.spotifyMediaUrl(),
    },
    {
      // Fallback: no DOM knowledge, but native TextTracks and sidecar WebVTT
      // still work, which covers most standard HTML5 players.
      id: 'native',
      domProbe: 'video',
    },
  ];

  function resolveCaptionSite() {
    const host = (location && location.host) || '';
    for (const s of CAPTION_SITES) {
      if (s.host && s.host.test(host)) return s;
    }
    // Host didn't match — fall back to identifying the player by its markup.
    for (const s of CAPTION_SITES) {
      if (s.domProbe) {
        try {
          if (document.querySelector(s.domProbe)) return s;
        } catch (_) {}
      }
    }
    return null;
  }
  shared.CAPTION_SITES = CAPTION_SITES;
  shared.resolveCaptionSite = resolveCaptionSite;
})();
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
// Caption capture: harvest a player's cues into the sidebar.
//
// Three paths run together — read video.textTracks; hook XHR/fetch for any
// WEBVTT body; mirror the on-screen cue container as a last resort.
//
// The only module with cross-file dependencies: it reads what
// 20-caption-sidebar.js and 30-caption-sites.js publish on window.__cupShared.

  (function captionCapture() {
    // The app also injects at onPageStarted. Do not mark this install as
    // complete before a body exists: otherwise onPageFinished cannot retry.
    if (!document.body) {
      document.addEventListener('DOMContentLoaded', captionCapture, {once: true});
      return;
    }
    // Published by 20-caption-sidebar.js and 30-caption-sites.js. build.sh
    // concatenates src/*.js in filename order, so both have already run — that
    // ordering is the whole reason these files are numbered.
    const shared = window.__cupShared || {};
    const createSubtitleUI = shared.createSubtitleUI;
    const CAPTION_SITES = shared.CAPTION_SITES;
    const resolveCaptionSite = shared.resolveCaptionSite;
    // The one behaviour this split adds. An earlier module failing at runtime
    // used to surface as a crash deep inside the harvest, a long way from the
    // cause; the bundle is fetched at runtime by every install, so say plainly
    // what is missing instead.
    if (typeof createSubtitleUI !== 'function' ||
        typeof resolveCaptionSite !== 'function' || !CAPTION_SITES) {
      console.warn('[captions] not installed — an earlier module in the bundle '
        + 'did not run (need 20-caption-sidebar.js and 30-caption-sites.js)');
      return;
    }
    const host = (location && location.host) || '';
    let site = resolveCaptionSite();
    // A DOM probe can miss on first run if the player hasn't rendered yet.
    // Bail only when there is no <video> either — re-injection on navigation
    // gives us another chance.
    if (!site && !document.querySelector('video')) return;
    if (!site) site = CAPTION_SITES[CAPTION_SITES.length - 1];
    // Version tag: bump whenever the snippet changes in a way that requires
    // tearing down the previous install (new UI, new state shape, etc).
    // The previous install's tear-down hook clears its sidebar + intervals.
    const CAPS_VERSION = 31;
    const prev = window.__cupCapsInstalled;
    if (prev && typeof prev === 'object' && prev.version >= CAPS_VERSION) return;
    if (prev && typeof prev === 'object' && typeof prev.teardown === 'function') {
      try { prev.teardown(); } catch (_) {}
    }
    const intervalIds = [];
    const installToken = { version: CAPS_VERSION, intervalIds, teardown };
    window.__cupCapsInstalled = installToken;
    function teardown() {
      for (const id of intervalIds) { try { clearInterval(id); } catch (_) {} }
      intervalIds.length = 0;
      const oldSidebar = document.querySelector('.cup-sub-sidebar');
      if (oldSidebar) oldSidebar.remove();
      document.body.classList.remove('cup-sub-split');
      document.body.classList.remove('cup-sub-spotify');
      if (youtubeLayout) youtubeLayout.dispose();
      const launcher = document.getElementById('cup-spotify-srt-toggle');
      if (launcher) launcher.remove();
      const youtubeLauncher = document.getElementById('cup-youtube-srt-toggle');
      if (youtubeLauncher) youtubeLauncher.remove();
      if (window.__cupOpenSubtitlePanel === openSubtitlePanel) delete window.__cupOpenSubtitlePanel;
      // CSS-in-JS marker class we may have left on a player wrapper.
      document.querySelectorAll('.cup-shrink-target').forEach(el => el.classList.remove('cup-shrink-target'));
      if (window.__cupImportYouTubeSubtitles === importYouTubeSubtitles) {
        delete window.__cupImportYouTubeSubtitles;
      }
      if (window.__cupLocalSubtitlesResult === localSubtitlesResult) {
        delete window.__cupLocalSubtitlesResult;
      }
      if (window.__cupCaptionPlayer === adaptedPlayer) delete window.__cupCaptionPlayer;
    }
    // Wrap setInterval so every timer this install starts can be cleared
    // by teardown later. Keeps the install fully self-contained.
    const ownSetInterval = (fn, ms) => {
      const id = setInterval(fn, ms);
      intervalIds.push(id);
      return id;
    };

    // Read behind a guard: the entry comes from a file fetched at runtime, so
    // a property that throws on access is the mirror of the predicate that
    // throws when called — which is already survived a layer down. Losing the
    // deep link is a cost; losing the whole caption sidebar is not.
    let timeParam;
    let timeLinkOn;
    try {
      timeParam = site.timeParam;
      timeLinkOn = site.timeLinkOn;
    } catch (e) {
      console.warn('[captions] site entry could not be read', e);
    }
    const adaptedPlayer = typeof site.createPlayer === 'function' ? site.createPlayer() : null;
    const getPlayer = () => adaptedPlayer || document.querySelector('video');
    const youtubeLayout = site.id === 'youtube' && typeof shared.createYouTubeSplitLayout === 'function'
      ? shared.createYouTubeSplitLayout(getPlayer) : null;
    const hasLocalPicker = !!(window.LocalSubtitles && typeof window.LocalSubtitles.postMessage === 'function');
    let spotifyPanelOpen = null;
    if (adaptedPlayer) window.__cupCaptionPlayer = adaptedPlayer;
    if (site.id === 'spotify') document.body.classList.add('cup-sub-spotify');
    const ui = createSubtitleUI({
      bodyClass: 'cup-sub-split',
      shrinkSelectors: site.shrinkSelectors,
      timeParam: timeParam,
      timeLinkOn: timeLinkOn,
      mediaUrl: site.mediaUrl,
      onOpenSubtitles: hasLocalPicker ? openLocalSubtitles : null,
      onSplitChange: on => {
        if (!adaptedPlayer && site.id !== 'youtube') return;
        spotifyPanelOpen = on;
        updateSpotifyControls();
      },
      onDownloadSubtitles: site.id === 'youtube' && window.YouTubeSubtitles &&
        typeof window.YouTubeSubtitles.postMessage === 'function'
        ? () => window.YouTubeSubtitles.postMessage(JSON.stringify({op: 'download'}))
        : null,
      onClearCues: () => {
        const id = currentYouTubeId();
        importedMediaKey = null;
        writeLocalTracks(readLocalTracks().filter(t => t && t.mediaKey !== pageKey()));
        if (id) {
          try {
            sessionStorage.setItem(cacheKey, JSON.stringify(readDownloads().filter(t => t.videoId !== id)));
          } catch (_) {}
        }
      },
    });

    function openSubtitlePanel() {
      if (!isWatchPage() && !adaptedPlayer) return false;
      spotifyPanelOpen = true;
      ui.buildSidebar();
      ui.setVideoElement(getPlayer());
      ui.setSplit(true);
      updateSpotifyControls();
      return true;
    }
    window.__cupOpenSubtitlePanel = openSubtitlePanel;

    function updateSpotifyControls() {
      const youtube = site.id === 'youtube';
      if (!adaptedPlayer && !youtube) return;
      const id = youtube ? 'cup-youtube-srt-toggle' : 'cup-spotify-srt-toggle';
      let button = document.getElementById(id);
      if (!button) {
        button = document.createElement('button');
        button.id = id;
        button.type = 'button';
        button.textContent = youtube ? 'SRT · Capture' : 'SRT';
        button.title = 'Show or hide the SRT subtitle panel';
        button.setAttribute('aria-label', 'SRT subtitle panel');
        button.className = 'cup-nolookup';
        button.style.cssText = 'position:fixed;right:12px;top:12px;z-index:2147483647;' +
          'background:#151515;color:#fff;border:1px solid #1ed760;border-radius:16px;' +
          'padding:9px 14px;font:bold 14px system-ui;cursor:pointer';
        button.onclick = () => {
          spotifyPanelOpen = !(spotifyPanelOpen ?? isWatchPage());
          ui.buildSidebar();
          ui.setSplit(spotifyPanelOpen);
          updateSpotifyControls();
        };
        document.body.appendChild(button);
      }
      button.setAttribute('aria-expanded', String(spotifyPanelOpen ?? isWatchPage()));
      button.hidden = youtube && !isWatchPage();
      if (youtube) {
        ui.showNotice(!window.YouTubeSubtitles
          ? 'Update Cupitor to download a full YouTube SRT. Live captions can still be selected and sent.'
          : !ui.cueCount ? 'Use ⤓CC to download subtitles, then ☑ to select lines and ⤴ to capture them.' : '');
        return;
      }
      const hasMedia = !!site.mediaKey();
      ui.setImportAvailable(hasMedia);
      ui.showNotice(!hasLocalPicker
        ? 'Update Cupitor to the latest app build to open local SRT files.'
        : !hasMedia ? 'Start a track or episode in Spotify, then select Open SRT.' : adaptedPlayer.statusMessage || '');
    }

    function currentYouTubeId() {
      if (site.id !== 'youtube') return null;
      const url = new URL(location.href);
      const id = url.searchParams.get('v') ||
        (/^\/(?:shorts|embed|live|v)\/([^/?#]+)/.exec(url.pathname) || [])[1] ||
        (url.hostname === 'youtu.be' ? url.pathname.slice(1).split('/')[0] : '');
      return /^[A-Za-z0-9_-]{11}$/.test(id || '') ? id : null;
    }
    const defaultSourceLanguage = ui.sourceLanguage;
    let importedMediaKey = null;
    let pendingLocal = null;
    const localCacheKey = 'cupitorLocalSubtitles';
    function readLocalTracks() {
      try {
        const tracks = JSON.parse(sessionStorage.getItem(localCacheKey) || '[]');
        return Array.isArray(tracks) ? tracks.slice(-5) : [];
      } catch (_) { return []; }
    }
    function writeLocalTracks(tracks) {
      try { sessionStorage.setItem(localCacheKey, JSON.stringify(tracks.slice(-5))); } catch (_) {}
    }
    function openLocalSubtitles() {
      if (pendingLocal) return;
      pendingLocal = {requestId: Date.now().toString(36) + '-' + Math.random().toString(36).slice(2), mediaKey: pageKey()};
      ui.setImportBusy(true);
      try {
        window.LocalSubtitles.postMessage(JSON.stringify({
          op: 'open', requestId: pendingLocal.requestId, lang: ui.sourceLanguage,
        }));
      } catch (_) { pendingLocal = null; ui.setImportBusy(false); }
    }
    function installLocalTrack(payload, remember = true) {
      if (!payload || payload.mediaKey !== pageKey()) return false;
      const track = normalizeTrack(payload);
      if (!track) return false;
      checkPage();
      importedMediaKey = pageKey();
      ui.setVideoElement(getPlayer());
      ui.replaceCues(track.lines, track.lang);
      ui.setSplit(isWatchPage() && !!getPlayer());
      if (remember) {
        writeLocalTracks([...readLocalTracks().filter(t => t && t.mediaKey !== importedMediaKey),
          {...track, mediaKey: importedMediaKey}]);
        const id = currentYouTubeId();
        if (id) {
          try { sessionStorage.setItem(cacheKey, JSON.stringify(readDownloads().filter(t => t && t.videoId !== id))); } catch (_) {}
        }
      }
      return true;
    }
    function localSubtitlesResult(payload) {
      if (!pendingLocal || !payload || payload.requestId !== pendingLocal.requestId) return false;
      const request = pendingLocal;
      pendingLocal = null;
      ui.setImportBusy(false);
      if (payload.cancelled) return true;
      if (request.mediaKey !== pageKey()) return false;
      return installLocalTrack({...payload, mediaKey: request.mediaKey});
    }
    window.__cupLocalSubtitlesResult = localSubtitlesResult;
    const cacheKey = 'cupitorDownloadedYouTubeSubtitles';
    function readDownloads() {
      try {
        const value = JSON.parse(sessionStorage.getItem(cacheKey) || '[]');
        return Array.isArray(value) ? value.slice(-5) : [];
      } catch (_) { return []; }
    }
    function normalizeTrack(payload) {
      if (!payload || !Array.isArray(payload.lines)) return null;
      const seen = new Set();
      const lines = [];
      for (const cue of payload.lines) {
        if (!cue || typeof cue.text !== 'string' || !cue.text.trim()) continue;
        if (typeof cue.start !== 'number' || typeof cue.end !== 'number') continue;
        const start = Number(cue.start), end = Number(cue.end);
        if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end <= start) continue;
        const text = cue.text.trim();
        const key = JSON.stringify([start, end, text]);
        if (seen.has(key)) continue;
        seen.add(key);
        lines.push({start, end, text});
      }
      if (!lines.length) return null;
      lines.sort((a, b) => a.start - b.start || a.end - b.end);
      const language = typeof payload.lang === 'string' ? payload.lang.trim() : '';
      const lang = /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(language) ? language : defaultSourceLanguage;
      return {lang, lines};
    }
    function importYouTubeSubtitles(payload, remember = true) {
      const normalized = normalizeTrack(payload);
      if (!normalized || !/^[A-Za-z0-9_-]{11}$/.test(payload.videoId || '') ||
          payload.videoId !== currentYouTubeId()) return false;
      const track = {...normalized, videoId: payload.videoId};
      checkPage();
      importedMediaKey = pageKey();
      ui.setVideoElement(getPlayer());
      ui.replaceCues(track.lines, track.lang);
      ui.setSplit(!!document.querySelector('video'));
      if (remember) {
        writeLocalTracks(readLocalTracks().filter(t => t && t.mediaKey !== importedMediaKey));
        try {
          const previous = readDownloads().filter(t => t && t.videoId !== track.videoId);
          sessionStorage.setItem(cacheKey, JSON.stringify([...previous, track].slice(-5)));
        } catch (_) { /* The live transcript still works if storage is full. */ }
      }
      return true;
    }
    function restoreDownload() {
      if (importedMediaKey === pageKey()) return;
      const local = readLocalTracks().find(t => t && t.mediaKey === pageKey());
      if (local && installLocalTrack(local, false)) return;
      const id = currentYouTubeId();
      if (!id) return;
      const cached = readDownloads().find(t => t && t.videoId === id);
      if (cached) importYouTubeSubtitles(cached, false);
    }
    if (site.id === 'youtube') window.__cupImportYouTubeSubtitles = importYouTubeSubtitles;

    function isWatchPage() {
      // Sites that also serve non-video pages narrow this down; everywhere
      // else, the presence of a <video> is the only signal we have.
      if (typeof site.isWatchPage === 'function') {
        try { return !!site.isWatchPage(); } catch (_) { return true; }
      }
      return !!document.querySelector('video');
    }

    // ---- diagnostics: dump what we see every 4 s until we capture cues ----
    let diagN = 0, lastDiag = '';
    function diag() {
      diagN++;
      const v = document.querySelector('video');
      const tracks = v && v.textTracks ? v.textTracks : null;
      const tInfo = tracks
        ? Array.from(tracks).map(t =>
            (t.language || t.label || '?') + '/' + t.mode + '/cues=' + (t.cues ? t.cues.length : 'null'))
        : 'no-video';
      const line = 'video=' + !!v + ' watchPage=' + isWatchPage() +
                   ' tracks=' + (tracks ? tracks.length : 0) +
                   ' info=' + JSON.stringify(tInfo);
      if (line !== lastDiag) {
        lastDiag = line;
        console.log('[svt diag #' + diagN + ']', line);
        // First diag dump: also log a chunk of ancestor class names for
        // the <video> so we can tune shrinkSelectors against the real DOM.
        if (v && diagN < 4) {
          let el = v, chain = [];
          while (el && chain.length < 8) {
            const cls = (typeof el.className === 'string' && el.className) ? el.className.trim().split(/\s+/).slice(0, 3).join('.') : '';
            chain.push(el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (cls ? '.' + cls : ''));
            el = el.parentElement;
          }
          console.log('[svt video ancestors]', chain.join(' > '));
        }
      }
    }
    ownSetInterval(diag, 4000);
    setTimeout(diag, 500);

    // The list belongs to one video. A player that moves on to the next one
    // without a page load (SVT's autoplay) changes the address, and the new
    // video's lines start again from 0:00 — keeping the old ones would mix
    // two timelines. The video is named by the address path; a site whose
    // path is the same for every video names the query parameters that pick
    // one (`videoParams`). Everything else in the address — a start offset, a
    // #fragment, tracking parameters — changes as you watch and is ignored.
    let videoParams = [];
    try {
      if (Array.isArray(site.videoParams)) videoParams = site.videoParams.map(String);
    } catch (e) {
      console.warn('[captions] site videoParams could not be read', e);
    }
    const pageKey = () => {
      if (typeof site.mediaKey === 'function') return site.mediaKey() || 'spotify:no-media';
      const key = location.origin + location.pathname;
      if (!videoParams.length) return key;
      const q = new URLSearchParams(location.search);
      return key + '?' + videoParams.map(n => n + '=' + (q.get(n) || '')).join('&');
    };
    let lastPageKey = pageKey();
    // Checked by the poll below and by every path just before it adds a line,
    // so a line that arrives in the same moment as the new address lands in
    // the new list rather than being emptied with the old one.
    let mirrorAfterSwitch = false;
    function checkPage() {
      const key = pageKey();
      if (key === lastPageKey) return;
      console.log('[caps] new video page — clearing the list:', key);
      lastPageKey = key;
      mirrorAfterSwitch = true;
      if (importedMediaKey) ui.replaceCues([], defaultSourceLanguage, {resume: false});
      else ui.clearCues({resume: false});
      importedMediaKey = null;
    }

    // ---- 1) textTracks: read cues directly ----
    // The video each track cue was first read under. A player can change the
    // address before it swaps the track (SVT's autoplay does), so the old
    // track is still there to be read for a moment after the list is
    // emptied; its cues were read under the old address and are skipped.
    // Cues first seen after the switch belong to the new video.
    const cueVideo = new WeakMap();
    function harvestTrack(track) {
      if (!track || !track.cues) return 0;
      checkPage();
      if (importedMediaKey === pageKey()) return 0;
      let n = 0;
      for (let i = 0; i < track.cues.length; i++) {
        const c = track.cues[i];
        if (!c || !c.text) continue;
        const seenUnder = cueVideo.get(c);
        if (seenUnder !== undefined && seenUnder !== lastPageKey) continue;
        if (seenUnder === undefined) cueVideo.set(c, lastPageKey);
        const text = String(c.text).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
        if (!text) continue;
        ui.addCue({ start: c.startTime || 0, end: c.endTime || (c.startTime || 0) + 3, text });
        n++;
      }
      return n;
    }

    function pumpTextTracks() {
      if (adaptedPlayer) return;
      const v = document.querySelector('video');
      if (!v) return;
      ui.setVideoElement(v);
      const tracks = v.textTracks;
      if (!tracks || !tracks.length) return;
      for (let i = 0; i < tracks.length; i++) {
        const tt = tracks[i];
        // Only real caption tracks. Storyboard thumbnails ride in as
        // kind='metadata', and players leave those disabled on purpose — so
        // forcing them to 'hidden' below was actively creating the problem.
        // An empty kind is allowed: some players never set one.
        const kind = (tt.kind || '').toLowerCase();
        if (kind && kind !== 'subtitles' && kind !== 'captions') continue;
        // Mode 'disabled' = cues never populated. Switch to 'hidden' which
        // populates without forcing the on-screen subtitle UI.
        if (tt.mode === 'disabled') {
          try { tt.mode = 'hidden'; } catch (_) {}
        }
        const got = harvestTrack(tt);
        if (got) console.log('[caps] textTrack', tt.language || tt.label, 'gave', got, 'cues');
        // Future cues (live/streamed VTT segments) arrive via cuechange.
        if (!tt.__cupBound) {
          tt.__cupBound = true;
          tt.addEventListener('cuechange', () => harvestTrack(tt));
          tt.addEventListener('addtrack', () => harvestTrack(tt));
        }
      }
    }

    // Catch tracks added after our first scan.
    if (HTMLMediaElement.prototype.addTextTrack && !HTMLMediaElement.prototype.__cupSvtHooked) {
      const orig = HTMLMediaElement.prototype.addTextTrack;
      HTMLMediaElement.prototype.addTextTrack = function() {
        const t = orig.apply(this, arguments);
        setTimeout(pumpTextTracks, 100);
        return t;
      };
      HTMLMediaElement.prototype.__cupSvtHooked = true;
    }

    // ---- 2) XHR / fetch hook for sidecar WebVTT downloads ----
    function looksLikeVtt(text) {
      return text && /^﻿?WEBVTT/.test(text.substring(0, 50));
    }
    function parseAndPushVtt(text) {
      checkPage();
      if (importedMediaKey === pageKey()) return;
      const lines = text.split(/\r?\n/);
      let i = 0, added = 0;
      while (i < lines.length) {
        const line = lines[i++];
        const m = line.match(/^(\d+:\d+:\d+\.\d+|\d+:\d+\.\d+)\s+-->\s+(\d+:\d+:\d+\.\d+|\d+:\d+\.\d+)/);
        if (!m) continue;
        const start = vttToSec(m[1]);
        const end = vttToSec(m[2]);
        const buf = [];
        while (i < lines.length && lines[i] !== undefined && lines[i].trim() !== '') {
          buf.push(lines[i++].replace(/<[^>]+>/g, ''));
        }
        const txt = buf.join(' ').replace(/\s+/g, ' ').trim();
        if (txt && !isThumbnailCue(txt)) { ui.addCue({ start, end, text: txt }); added++; }
      }
      if (added) console.log('[caps] VTT parsed:', added, 'cues');
    }
    function vttToSec(t) {
      const parts = t.split(':');
      let h = 0, m = 0, s = 0;
      if (parts.length === 3) { h = +parts[0]; m = +parts[1]; s = parseFloat(parts[2]); }
      else if (parts.length === 2) { m = +parts[0]; s = parseFloat(parts[1]); }
      else s = parseFloat(parts[0]);
      return h * 3600 + m * 60 + s;
    }

    (function hookNetwork() {
      const oOpen = XMLHttpRequest.prototype.open;
      const oSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function(m, u) { this.__cupSvtUrl = String(u || ''); return oOpen.apply(this, arguments); };
      XMLHttpRequest.prototype.send = function() {
        this.addEventListener('load', () => {
          try {
            const t = this.responseText;
            if (looksLikeVtt(t)) parseAndPushVtt(t);
          } catch (_) {}
        });
        return oSend.apply(this, arguments);
      };
      const oFetch = window.fetch;
      if (oFetch) {
        window.fetch = function(input, init) {
          const url = typeof input === 'string' ? input : (input && input.url) || '';
          const p = oFetch.apply(this, arguments);
          p.then(r => r && r.clone && r.clone().text().then(t => {
            if (looksLikeVtt(t)) parseAndPushVtt(t);
          })).catch(() => {});
          return p;
        };
      }
    })();

    // ---- 3) DOM mirror — the only path needing per-site knowledge ----
    // The player paints the current cue into `site.domSelector`, optionally
    // into an inner `site.cueSelector`, usually with each line in its own
    // <span>. Timing comes from the video's clock, since the DOM says only
    // "this is on screen now".
    (function hookDom() {
      if (!site.domSelector) return;
      let lastText = '';
      let lastChangeAt = 0;
      ownSetInterval(() => {
        checkPage();
        if (importedMediaKey === pageKey()) return;
        const container = document.querySelector(site.domSelector);
        if (!container) return;
        // Prefer the inner cue element (multiple lines) — fall back to the
        // container itself when the site has no inner wrapper.
        const cueEl = (site.cueSelector && container.querySelector(site.cueSelector)) || container;
        // Join the player's line <span>s with newlines so multi-line cues stay
        // separated. Only outermost spans count, and never the app's own
        // word spans: the word wrapper turns each word of the painted cue
        // into a .clickable-word span a moment later; reading those as lines
        // too would bring the same cue back a second time with every word
        // repeated on a line of its own.
        let text;
        const isLineSpan = (sp) => {
          if (sp.classList.contains('clickable-word')) return false;
          for (let p = sp.parentElement; p && p !== cueEl; p = p.parentElement) {
            if (p.tagName === 'SPAN') return false;
          }
          return true;
        };
        const spans = Array.from(cueEl.querySelectorAll('span')).filter(isLineSpan);
        if (spans.length) {
          const parts = [];
          spans.forEach(sp => {
            const t = (sp.innerText || sp.textContent || '').trim();
            if (t) parts.push(t);
          });
          text = parts.join('\n');
        } else {
          text = (cueEl.innerText || cueEl.textContent || '').trim();
        }
        text = text.replace(/[ \t]+/g, ' ').trim();
        // After moving on to another video, the first empty overlay ends the
        // old video's cue: the same words painted after it are the new
        // video's line ("Okej." closing one episode and opening the next).
        // A cue still showing from before the switch is not read again, and
        // within one video an overlay that blinks keeps its cue.
        if (!text) {
          if (mirrorAfterSwitch) { lastText = ''; mirrorAfterSwitch = false; }
          return;
        }
        if (text === lastText) return;
        lastText = text;
        const now = Date.now();
        if (now - lastChangeAt < 200) return;
        lastChangeAt = now;
        const v = ui.currentVideo || document.querySelector('video');
        const start = v ? v.currentTime : 0;
        ui.addCue({ start, end: start + 3, text });
      }, 300);
    })();

    // ---- video discovery + split-view auto-toggle ----
    function findPlayerContainer(videoEl) {
      // Walk up from <video> looking for the outermost ancestor that is
      // visually a "player frame" — one whose bottom reaches near the
      // viewport bottom and which contains the video. SVT renders its
      // overlay controls inside this container; shrinking it shrinks the
      // controls with it.
      let best = videoEl;
      let el = videoEl.parentElement;
      let steps = 0;
      while (el && steps < 8) {
        const r = el.getBoundingClientRect();
        const vr = videoEl.getBoundingClientRect();
        // Container is at least as tall as the video and not body/html.
        if (el.tagName === 'BODY' || el.tagName === 'HTML') break;
        if (r.height >= vr.height && r.width >= vr.width) best = el;
        el = el.parentElement;
        steps++;
      }
      return best;
    }
    let lastMarked = null;
    updateSpotifyControls();
    if (adaptedPlayer) ownSetInterval(() => {
      // Spotify can switch tracks without navigating. Clear the old replay
      // state before polling the new clock, even while browsing another page.
      checkPage();
      adaptedPlayer.poll();
    }, 250);
    ownSetInterval(() => {
      checkPage();
      restoreDownload();
      const v = getPlayer();
      if (v) ui.setVideoElement(v);
      const want = adaptedPlayer ? (spotifyPanelOpen ?? isWatchPage())
        : site.id === 'youtube' ? isWatchPage() && (spotifyPanelOpen ?? true)
          : isWatchPage() && !!v;
      if (want) ui.buildSidebar();
      ui.setSplit(want);
      if (youtubeLayout) youtubeLayout.update();
      updateSpotifyControls();
      if (want && v && !adaptedPlayer && !youtubeLayout) {
        const wrap = findPlayerContainer(v);
        if (wrap && wrap !== lastMarked) {
          if (lastMarked) lastMarked.classList.remove('cup-shrink-target');
          wrap.classList.add('cup-shrink-target');
          lastMarked = wrap;
          console.log('[caps] shrink target =', wrap.tagName, wrap.className || '(no class)');
        }
      } else if (!want && lastMarked) {
        lastMarked.classList.remove('cup-shrink-target');
        lastMarked = null;
      }
      // Pump textTracks periodically — SVT may swap them on next-episode.
      pumpTextTracks();
    }, 1000);

    console.log('Cupitor caption capture installed v' + CAPS_VERSION + ' (site=', site.id, 'host=', host, ')');
  })();
