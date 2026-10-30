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
      sb.innerHTML = `
        <div class="cup-sub-drag" title="Drag to resize"></div>
        <div class="cup-sub-head">
          <button data-act="split" class="cup-on" title="Toggle split view">⇋</button>
          <button data-act="scroll" class="cup-on" title="Auto-scroll">⇩</button>
          <button data-act="translate" title="Toggle translation">🌐</button>
          <button data-act="download" title="Download YouTube subtitles" style="display:none">⤓CC</button>
          <button data-act="open-srt" title="Open a local SRT subtitle file" style="display:none">Open SRT</button>
          <button data-act="settings" title="Strategy &amp; settings">⚙</button>
          <button data-act="prev" title="Previous cue">⟨</button>
          <button data-act="next" title="Next cue">⟩</button>
          <button data-act="copy" title="Copy transcript">⧉</button>
          <button data-act="clear" title="Clear transcript">🗑</button>
          <button data-act="pick" title="Select lines">☑</button>
          <button data-act="all" title="Select all / none" style="display:none">⊞</button>
          <button data-act="send" title="Send selected to Cupitor" style="display:none">⤴</button>
          <span class="cup-sub-status cup-nolookup" data-r="status"></span>
        </div>
        <div data-r="notice" class="cup-nolookup" hidden style="padding:10px 14px;flex:0 0 auto;font-size:14px"></div>
        <div class="cup-sub-list"></div>
      `;
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

    const HTML_ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
    const escHtml = s => String(s).replace(/[&<>"']/g, c => HTML_ESC[c]);

    function fmtTime(sec) {
      sec = Math.max(0, Math.floor(sec || 0));
      const h = Math.floor(sec / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      const pad = n => (n < 10 ? '0' + n : '' + n);
      return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
    }

    function tokenize(text) {
      return text.split(/(\s+)/).map(tok => {
        if (/^\s+$/.test(tok)) return tok;
        const m = tok.match(/^([^\p{L}\p{N}]*)([\p{L}\p{N}][\p{L}\p{N}'’\-]*)(.*)$/u);
        if (!m) return escHtml(tok);
        return escHtml(m[1])
          + '<span class="cup-w" data-w="' + escHtml(m[2]) + '">' + escHtml(m[2]) + '</span>'
          + escHtml(m[3]);
      }).join('');
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
      const trHtml = cue.translation
        ? '<div class="cup-sub-tr">' + escHtml(cue.translation) + '</div>'
        : (cue.trPending ? '<div class="cup-sub-tr cup-tr-pending">…</div>' : '');
      row.dataset.cueId = String(cue.id);
      row.innerHTML =
        '<input type="checkbox" class="cup-sub-pick">' +
        '<span class="cup-sub-time cup-nolookup">' + fmtTime(cue.start) + '</span>' +
        '<div class="cup-sub-text">' + tokenize(cue.text) + trHtml + '</div>';
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
        const trHtml = cue.translation
          ? '<div class="cup-sub-tr">' + escHtml(cue.translation) + '</div>'
          : (cue.trPending ? '<div class="cup-sub-tr cup-tr-pending">…</div>' : '');
        textBlock.innerHTML = tokenize(cue.text) + trHtml;
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
      if (state.listEl) state.listEl.innerHTML = '';
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
      wrap.innerHTML = `
        <div class="cup-sub-modal-box">
          <h3>Subtitles · settings</h3>
          <label>Translation
            <input type="checkbox" data-f="enabled" ${state.translationEnabled ? 'checked' : ''}>
          </label>
          <label>Source language
            <input type="text" data-f="source" value="${escHtml(state.translationSource)}" placeholder="sv">
          </label>
          <label>Target language
            <input type="text" data-f="target" value="${escHtml(state.translationTarget)}" placeholder="en">
          </label>
          <label>Strategy
            <select data-f="strategy">
              <option value="1" ${state.strategy===1?'selected':''}>1 · Keep playing, translate as cues arrive</option>
              <option value="2" ${state.strategy===2?'selected':''}>2 · Pause until current cue is translated</option>
              <option value="3" ${state.strategy===3?'selected':''}>3 · Play N lines, then replay with translations</option>
              <option value="4" ${state.strategy===4?'selected':''}>4 · Like 3, but configurable replay speed &amp; repeats</option>
              <option value="5" ${state.strategy===5?'selected':''}>5 · Like 4, plus configurable gap between passes</option>
            </select>
          </label>
          <label data-show-for="3 4 5">Lines per chunk
            <input type="number" data-f="lines" min="1" max="50" value="${state.linesPerChunk}">
          </label>
          <label data-show-for="4 5">Repeats
            <input type="number" data-f="repeatCount" min="0" max="10" value="${state.repeatCount}">
          </label>
          <label data-show-for="4 5" title="Hyphen-separated speeds, one per pass. First value is the original (pass 0); subsequent values are repeats. Last value extends. Examples: '1' (no slowdown), '1-0.7' (default — repeat at 0.7x), '1-0.5-1' (0.5x first repeat, 1x after), '1-0.5-0.7' (0.5x then 0.7x)">Speed schedule
            <input type="text" data-f="schedule" value="${escHtml(state.replaySchedule)}" placeholder="1-0.7">
          </label>
          <label data-show-for="5" title="Pause this many seconds between consecutive passes (replays). 0 = no gap.">Gap seconds
            <input type="number" data-f="gap" min="0" max="30" step="0.5" value="${state.replayGap}">
          </label>
          <label title="Log strategy transitions to the console — useful when reporting bugs.">Debug logging
            <input type="checkbox" data-f="debug" ${state.debug ? 'checked' : ''}>
          </label>
          <div class="cup-sub-modal-actions">
            <button data-act="cancel">Cancel</button>
            <button data-act="save">Save</button>
          </div>
        </div>
      `;
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
      if (!v || v === state.currentVideo) return;
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
