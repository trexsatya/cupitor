(function(){
  if (!/(^|\.)filmot\.(com|org)$/.test(location.hostname)) return;
  if (window.__cupitorFilmotInstalled) { if (window.__cupitorFilmotApply) window.__cupitorFilmotApply(); return; }
  window.__cupitorFilmotInstalled = true;
  function bridge(msg) { try { FilmotBridge.postMessage(JSON.stringify(msg)); } catch(e) {} }
  function titleFromCard(card) {
    var a = card.querySelector('a[id^="vlink"]');
    if (a) return (a.textContent || '').trim().slice(0, 200);
    var t = card.querySelector('h1,h2,h3,h4,h5,.title,[class*=title]');
    if (t) return (t.textContent || '').trim().slice(0, 200);
    return '';
  }
  // Set a value only if it differs from current, to skip layout thrashing
  // when annotate runs repeatedly with the same data.
  function setStyle(el, prop, val) { if (el.style[prop] !== val) el.style[prop] = val; }
  function setText(el, val) { if (el.textContent !== val) el.textContent = val; }

  // Auto-skip the currently-playing video if its channel is blacklisted.
  // Filmot's prev/next buttons swap the iframe src in place — so the
  // only reliable hook is to watch the iframe and invoke filmot's own
  // navigateToLocalResult/nextVideo. Throttled to keep the skip from
  // racing when several blocked channels are queued in a row.
  var lastAutoSkipAt = 0;
  var lastCheckedSrc = '';
  function blacklistedChannelOf(videoId) {
    if (!videoId) return null;
    var disabled = window.__cupitorFilmotBlacklistDisabled === true;
    if (disabled) return null;
    var bl = window.__cupitorFilmotBlacklist || [];
    if (!bl.length) return null;
    var ch = (window.__cupitorVideoChannel || {})[videoId];
    if (!ch) return null;
    for (var i = 0; i < bl.length; i++) if (bl[i] === ch) return ch;
    return null;
  }
  function currentVideoId() {
    var ifr = document.getElementById('player');
    if (ifr && ifr.src) {
      var m = ifr.src.match(/youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/);
      if (m) return m[1];
    }
    // Fallback to filmot's own global if it's defined.
    if (typeof window.currentVideoID === 'string' && window.currentVideoID) return window.currentVideoID;
    return null;
  }
  // Find the index of the currently-playing video in filmot's local
  // vcard list (`<div class="vcardN ...">`). Needed by playNextVideo().
  function currentVcardIndex() {
    var id = currentVideoId();
    if (!id) return -1;
    var card = document.getElementById('vcard_' + id);
    if (!card) return -1;
    var m = (card.className || '').match(/(?:^|\s)vcard(\d+)(?:\s|$)/);
    return m ? parseInt(m[1], 10) : -1;
  }
  function autoSkipIfBlacklisted(reason) {
    var id = currentVideoId();
    if (!id) return;
    var ch = (window.__cupitorVideoChannel || {})[id];
    if (ch === undefined) {
      // Not resolved yet — ask Flutter to resolve so a later push can re-check.
      bridge({action:'resolveVideos', ids:[id]});
      return;
    }
    var blocked = blacklistedChannelOf(id);
    if (!blocked) return;
    var now = Date.now();
    if (now - lastAutoSkipAt < 800) return;
    lastAutoSkipAt = now;
    try { if (typeof window.stopDownTimer === 'function') window.stopDownTimer(); } catch(e){}
    // Preferred path: filmot's own next button carries the correct
    // current index in its onclick, and uses playNextVideo() which
    // already skips past `.d-none` cards.
    try {
      var btn = document.getElementById('nextVideoButton');
      if (btn && !btn.classList.contains('d-none')) { btn.click(); return; }
    } catch(e){}
    // Fallback: derive the current index from the highlighted vcard
    // and invoke playNextVideo directly.
    try {
      var idx = currentVcardIndex();
      if (idx >= 0 && typeof window.playNextVideo === 'function') { window.playNextVideo(idx, 1); return; }
    } catch(e){}
    // Last-ditch fallbacks.
    try {
      if (typeof window.nextVideo === 'function') { window.nextVideo(); return; }
      if (typeof window.navigateToLocalResult === 'function') window.navigateToLocalResult(1);
    } catch(e){}
  }

  function annotate() {
    var bl = window.__cupitorFilmotBlacklist || [];
    var disabled = window.__cupitorFilmotBlacklistDisabled === true;
    var map = window.__cupitorVideoChannel || {};
    var blSet = {};
    for (var i = 0; i < bl.length; i++) blSet[bl[i]] = true;

    // --- (a) Search-result cards ---
    var cards = document.querySelectorAll('[id^="vcard_"]');
    var seenChannels = {};
    var unknownIds = [];
    for (var c = 0; c < cards.length; c++) {
      var card = cards[c];
      var id = card.id.replace(/^vcard_/, '');
      if (!id) continue;
      var ch = map[id];
      if (ch === undefined) {
        unknownIds.push(id);
        setStyle(card, 'opacity', '0.6');
      } else {
        setStyle(card, 'opacity', '');
        if (ch) seenChannels[ch] = true;
        // Use Bootstrap's `d-none` instead of inline style so filmot's
        // own playNextVideo()/playNextVideo prev path treats blacklisted
        // cards as "skipped" — they call `card.classList.contains("d-none")`.
        if (!disabled && ch && blSet[ch]) {
          if (!card.classList.contains('d-none')) card.classList.add('d-none');
        } else {
          if (card.classList.contains('d-none')) card.classList.remove('d-none');
        }
      }
      // Annotate once; label refreshed only when its text actually changes.
      if (card.getAttribute('data-cup-ann') !== '1') {
        card.setAttribute('data-cup-ann', '1');
        var bar = document.createElement('div');
        bar.className = '__cup_bar';
        bar.style.cssText = 'display:flex;gap:4px;padding:2px 0;font-size:11px';
        var label = document.createElement('span');
        label.className = '__cup_channel_label';
        label.style.cssText = 'flex:1;color:#555;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        bar.appendChild(label);
        var bbtn = document.createElement('button');
        bbtn.textContent = '🚫';
        bbtn.title = 'Blacklist this channel';
        bbtn.style.cssText = 'padding:1px 6px;font-size:11px;border:1px solid #888;background:#fee;cursor:pointer;border-radius:3px;line-height:1';
        bbtn.onclick = (function(videoId, lbl){ return function(e){
          e.preventDefault(); e.stopPropagation();
          var channel = (window.__cupitorVideoChannel || {})[videoId];
          if (!channel) { setText(lbl, '(no channel resolved yet)'); return; }
          bridge({action:'blockChannel', channel: channel});
        }; })(id, label);
        bar.appendChild(bbtn);
        var sbtn = document.createElement('button');
        sbtn.textContent = '💾';
        sbtn.title = 'Save video URL';
        sbtn.style.cssText = 'padding:1px 6px;font-size:11px;border:1px solid #888;background:#efe;cursor:pointer;border-radius:3px;line-height:1';
        sbtn.onclick = (function(videoId, btn, cardEl){ return function(e){
          e.preventDefault(); e.stopPropagation();
          var channel = (window.__cupitorVideoChannel || {})[videoId] || '';
          bridge({action:'saveVideo', url:'https://www.youtube.com/watch?v=' + videoId, channel: channel, title: titleFromCard(cardEl)});
          btn.textContent = '✅';
        }; })(id, sbtn, card);
        bar.appendChild(sbtn);
        card.insertBefore(bar, card.firstChild);
      }
      var existingLabel = card.querySelector('.__cup_channel_label');
      if (existingLabel) {
        var lblText = (ch === undefined) ? '(resolving channel…)' : (ch === '' ? '(channel unknown)' : ch);
        setText(existingLabel, lblText);
      }
    }

    // --- (b) Detail-page channel link (no anchor text — read from URL) ---
    var detailLinks = document.querySelectorAll('a[href*="/channel/"], a[href*="youtube.com/@"]');
    var detailId = null;
    var pm = location.pathname.match(/\/sidebyside\/([A-Za-z0-9_-]{6,})/);
    if (pm) detailId = pm[1];
    for (var d = 0; d < detailLinks.length; d++) {
      var dl = detailLinks[d];
      if (dl.getAttribute('data-cup-ann') === '1') continue;
      dl.setAttribute('data-cup-ann', '1');
      var lbl2 = document.createElement('span');
      lbl2.className = '__cup_channel_label';
      lbl2.style.cssText = 'margin:0 6px;font-size:12px;color:#444';
      var ch2 = (detailId && map[detailId]) ? map[detailId] : '';
      lbl2.textContent = ch2 || '(resolving channel…)';
      if (ch2) seenChannels[ch2] = true;
      dl.parentNode.insertBefore(lbl2, dl);
      var b2 = document.createElement('button');
      b2.className = '__cup_btn';
      b2.textContent = '🚫';
      b2.title = 'Blacklist this channel';
      b2.style.cssText = 'margin:0 4px;padding:1px 6px;font-size:11px;border:1px solid #888;background:#fee;cursor:pointer;border-radius:3px;line-height:1';
      b2.onclick = (function(vId, lbl){ return function(e){
        e.preventDefault(); e.stopPropagation();
        var ch = vId ? (window.__cupitorVideoChannel || {})[vId] : '';
        if (!ch) { setText(lbl, '(no channel resolved yet)'); return; }
        bridge({action:'blockChannel', channel: ch});
      }; })(detailId, lbl2);
      dl.parentNode.insertBefore(b2, dl.nextSibling);
      if (detailId) {
        unknownIds.push(detailId);
        var s2 = document.createElement('button');
        s2.className = '__cup_btn';
        s2.textContent = '💾';
        s2.title = 'Save video URL';
        s2.style.cssText = 'margin:0 4px;padding:1px 6px;font-size:11px;border:1px solid #888;background:#efe;cursor:pointer;border-radius:3px;line-height:1';
        s2.onclick = (function(vId, btn){ return function(e){
          e.preventDefault(); e.stopPropagation();
          var ch = (window.__cupitorVideoChannel || {})[vId] || '';
          var ttl = document.title || '';
          bridge({action:'saveVideo', url:'https://www.youtube.com/watch?v=' + vId, channel: ch, title: ttl});
          btn.textContent = '✅';
        }; })(detailId, s2);
        dl.parentNode.insertBefore(s2, b2.nextSibling);
      }
    }

    // --- (c) Currently-playing video bar ---
    // Insert a block+save bar above the player. Filmot wraps #player
    // (an iframe) in #playerTop, which uses Bootstrap's
    // embed-responsive-16by9 — that gives the iframe `position:absolute`
    // inside its parent, so inserting a sibling there makes the bar
    // invisible. We anchor on #playerTop instead (or fall back to
    // #playerparrent's first child) and insert in the normal flow.
    var playerEl = document.getElementById('player');
    if (playerEl) {
      var anchor = document.getElementById('playerTop') || playerEl.parentNode;
      var anchorParent = anchor && anchor.parentNode;
      var prev = anchor && anchor.previousElementSibling;
      var pBar = (prev && prev.classList && prev.classList.contains('__cup_player_bar')) ? prev : null;
      if (!pBar && anchorParent) {
        pBar = document.createElement('div');
        pBar.className = '__cup_player_bar';
        pBar.style.cssText = 'display:flex;gap:6px;align-items:center;padding:6px 8px;font-size:13px;background:#fffbe6;border:1px solid #e0c060;border-radius:4px;margin:6px 0';
        var pLabel = document.createElement('span');
        pLabel.className = '__cup_player_channel_label';
        pLabel.style.cssText = 'flex:1;color:#444;overflow:hidden;text-overflow:ellipsis;white-space:nowrap';
        pBar.appendChild(pLabel);
        var pBlock = document.createElement('button');
        pBlock.textContent = '🚫 Block channel';
        pBlock.title = 'Blacklist this channel';
        pBlock.style.cssText = 'padding:2px 8px;font-size:11px;border:1px solid #888;background:#fee;cursor:pointer;border-radius:3px;line-height:1.2';
        pBlock.onclick = function(e) {
          e.preventDefault(); e.stopPropagation();
          var vid = currentVideoId();
          var ch = vid ? (window.__cupitorVideoChannel || {})[vid] : '';
          if (!ch) { setText(pLabel, '(no channel resolved yet)'); return; }
          bridge({action:'blockChannel', channel: ch});
        };
        pBar.appendChild(pBlock);
        var pSave = document.createElement('button');
        pSave.textContent = '💾 Save';
        pSave.title = 'Save video URL';
        pSave.style.cssText = 'padding:2px 8px;font-size:11px;border:1px solid #888;background:#efe;cursor:pointer;border-radius:3px;line-height:1.2';
        pSave.onclick = function(e) {
          e.preventDefault(); e.stopPropagation();
          var vid = currentVideoId();
          if (!vid) return;
          var ch = (window.__cupitorVideoChannel || {})[vid] || '';
          bridge({action:'saveVideo', url:'https://www.youtube.com/watch?v=' + vid, channel: ch, title: document.title || ''});
          pSave.textContent = '✅ Saved';
          setTimeout(function(){ pSave.textContent = '💾 Save'; }, 1500);
        };
        pBar.appendChild(pSave);
        anchorParent.insertBefore(pBar, anchor);
      }
      // Refresh label / record channel-seen for the player's current video.
      var pVid = currentVideoId();
      var pLbl = pBar && pBar.querySelector('.__cup_player_channel_label');
      if (pLbl) {
        if (!pVid) {
          setText(pLbl, '(no video)');
        } else {
          var pCh = map[pVid];
          if (pCh === undefined) {
            setText(pLbl, '(resolving channel…)');
            unknownIds.push(pVid);
          } else if (pCh === '') {
            setText(pLbl, '(channel unknown)');
          } else {
            setText(pLbl, pCh);
            seenChannels[pCh] = true;
          }
        }
      }
    }

    // Keep already-annotated detail-page labels in sync with the map.
    var dLabels = document.querySelectorAll('a[data-cup-ann="1"]');
    for (var dl2 = 0; dl2 < dLabels.length; dl2++) {
      var prev = dLabels[dl2].previousSibling;
      if (prev && prev.classList && prev.classList.contains('__cup_channel_label')) {
        var dch = (detailId && map[detailId]) ? map[detailId] : '';
        var dtxt = dch || ((detailId && map[detailId] === '') ? '(channel unknown)' : '(resolving channel…)');
        setText(prev, dtxt);
        if (dch) seenChannels[dch] = true;
      }
    }

    // Report known channels to Flutter so the dialog UI can list them.
    var seenArr = []; for (var k in seenChannels) seenArr.push(k);
    bridge({action:'channelsSeen', channels: seenArr});
    if (unknownIds.length) {
      var dedup = {}; var uniq = [];
      for (var u = 0; u < unknownIds.length; u++) { if (!dedup[unknownIds[u]]) { dedup[unknownIds[u]] = 1; uniq.push(unknownIds[u]); } }
      bridge({action:'resolveVideos', ids: uniq});
    }
    // If the currently-playing video became blacklisted (new entry, or
    // its channel just resolved), skip to the next one.
    autoSkipIfBlacklisted('annotate');
  }

  // Debounced scheduler — protects the main thread from filmot's
  // own constant DOM updates (subtitle highlights, time ticks, etc.).
  var annotateTimer = null;
  function scheduleAnnotate() {
    if (annotateTimer) return;
    annotateTimer = setTimeout(function(){
      annotateTimer = null;
      try { annotate(); } catch(e) {}
    }, 400);
  }
  window.__cupitorFilmotApply = scheduleAnnotate;

  // Only run annotate when DOM mutations actually involve a vcard or a
  // channel link — ignore subtitle, badge, and player tick updates.
  function relevant(mutations) {
    for (var mi = 0; mi < mutations.length; mi++) {
      var mu = mutations[mi];
      if (mu.type !== 'childList') continue;
      for (var ai = 0; ai < mu.addedNodes.length; ai++) {
        var an = mu.addedNodes[ai];
        if (!an || an.nodeType !== 1) continue;
        if (an.id && an.id.indexOf('vcard_') === 0) return true;
        if (an.id === 'player') return true;
        // Skip the bars we insert ourselves
        if (an.className === '__cup_bar' || an.className === '__cup_player_bar' || an.className === '__cup_channel_label') continue;
        if (an.querySelector && (an.querySelector('[id^="vcard_"]') || an.querySelector('#player') || an.querySelector('a[href*="/channel/"]') || an.querySelector('a[href*="youtube.com/@"]'))) return true;
      }
      for (var ri = 0; ri < mu.removedNodes.length; ri++) {
        var rn = mu.removedNodes[ri];
        if (!rn || rn.nodeType !== 1) continue;
        if (rn.id && rn.id.indexOf('vcard_') === 0) return true;
      }
    }
    return false;
  }

  annotate();
  var mo = new MutationObserver(function(mutations){
    try { if (relevant(mutations)) scheduleAnnotate(); } catch(e) {}
  });
  mo.observe(document.body || document.documentElement, {childList:true, subtree:true});

  // Watch the player iframe — filmot's Next/Prev buttons swap its src
  // without navigating, so this is the only reliable signal that the
  // currently-playing video has changed.
  function attachIframeWatcher() {
    var ifr = document.getElementById('player');
    if (!ifr || ifr.__cupWatched) return;
    ifr.__cupWatched = true;
    // Annotate now that the iframe is in the DOM — this is what makes
    // the player-bar (block / save buttons) actually appear when the
    // iframe was added after the page's initial parse.
    scheduleAnnotate();
    var srcMo = new MutationObserver(function(){
      if (ifr.src === lastCheckedSrc) return;
      lastCheckedSrc = ifr.src;
      autoSkipIfBlacklisted('iframe-src');
      // Refresh the player-bar channel label for the new video.
      scheduleAnnotate();
    });
    srcMo.observe(ifr, {attributes:true, attributeFilter:['src']});
    lastCheckedSrc = ifr.src || '';
    // Also fire once now in case the initial video is already blocked.
    autoSkipIfBlacklisted('initial');
  }
  attachIframeWatcher();
  // The iframe may not exist yet when we install — keep trying briefly.
  var watcherTries = 0;
  var watcherTimer = setInterval(function(){
    watcherTries++;
    attachIframeWatcher();
    var ifr2 = document.getElementById('player');
    if ((ifr2 && ifr2.__cupWatched) || watcherTries > 20) clearInterval(watcherTimer);
  }, 300);
})();
