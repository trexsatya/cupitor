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
