(function(){
  function isFilmotDocument(doc) {
    try {
      var loc = doc && doc.location;
      return !!loc && (loc.protocol === 'https:' || loc.protocol === 'http:') &&
        (loc.hostname === 'filmot.com' || loc.hostname.endsWith('.filmot.com'));
    } catch (_) {
      return false;
    }
  }
  if (!isFilmotDocument(document)) return null;

  var jumpSelector = 'a[href*="jtt"], [onclick*="jtt"]';
  var timedSelector = '[data-start], [data-start-time], [data-start-ms], [data-time], [data-timestamp]';
  var timedAttributes = ['data-start', 'data-start-time', 'data-time', 'data-timestamp'];
  var panelSelector = '#subtitlesIn, .scroll-subtitles';
  var diagnostics = {path: location.pathname, documents: 0, panels: 0, controls: 0};

  function timestamp(value) {
    if (value === null) return null;
    var text = value.trim();
    if (/^\d+(?:\.\d+)?$/.test(text)) {
      var seconds = Number(text);
      return Number.isFinite(seconds) ? seconds : null;
    }
    if (!/^(?:\d+:)?[0-5]?\d:[0-5]?\d(?:[.,]\d+)?$/.test(text)) return null;
    return text.replace(',', '.').split(':').reduce(function(seconds, part) {
      return seconds * 60 + Number(part);
    }, 0);
  }

  function readTime(node) {
    var call = (node.getAttribute('href') || '') + ' ' + (node.getAttribute('onclick') || '');
    var jump = call.match(/\bjtt\s*\(\s*(?:['"]s?\d+['"]|\d+)\s*,\s*['"]?(\d+(?:\.\d+)?)(?=\s*['")]|\s*,)/);
    if (jump) return timestamp(jump[1]);
    for (var i = 0; i < timedAttributes.length; i++) {
      var time = timestamp(node.getAttribute(timedAttributes[i]));
      if (time !== null) return time;
    }
    var milliseconds = node.getAttribute('data-start-ms');
    return milliseconds !== null && /^\d+$/.test(milliseconds) ? Number(milliseconds) / 1000 : null;
  }

  function captionText(node) {
    return (node.textContent || '').replace(/^\s*[▶►▸]+\s*/, '').replace(/\s+/g, ' ').trim();
  }

  function captionRow(node, root) {
    for (var row = node; row && row !== root; row = row.parentElement) {
      if (/^s\d+$/.test(row.id) || row.matches('li, tr, [role="listitem"]')) return row;
    }
    if (node.matches('div, p') && node.matches(timedSelector)) return node;
    var block = node.parentElement && node.parentElement.closest('div, p');
    return block && block !== root && root.contains(block) ? block : node;
  }

  function readLines(root, legacyOnly) {
    var lines = [];
    var seen = new Set();
    var controls = root.querySelectorAll(legacyOnly ? jumpSelector : jumpSelector + ', ' + timedSelector);
    diagnostics.controls += controls.length;
    for (var i = 0; i < controls.length; i++) {
      var control = controls[i];
      var start = readTime(control);
      if (start === null) continue;
      var row = captionRow(control, root);
      var id = row.id.match(/^s(\d+)$/);
      if ((legacyOnly && !id) || seen.has(row)) continue;
      var text = captionText(row);
      if (row !== control && control.matches('a, button, [role="button"]')) {
        // Drop a seek-only control while retaining a control that wraps all
        // the caption text.
        var clone = row.cloneNode(true);
        var seek = clone.querySelector(jumpSelector + ', button:is(' + timedSelector + ')');
        if (seek) {
          seek.remove();
          text = captionText(clone) || text;
        }
      }
      if (!text) continue;
      seen.add(row);
      lines.push({i: id ? Number(id[1]) : lines.length, ts: start, t: text});
    }
    return lines;
  }

  // Search and detail views can put the transcript inside a same-origin
  // frame. Never read a YouTube embed or a different site's document.
  var docs = [document];
  var page = document;
  var lines = [];
  for (var d = 0; d < docs.length; d++) {
    var doc = docs[d];
    diagnostics.documents++;
    var panels = doc.querySelectorAll(panelSelector);
    diagnostics.panels += panels.length;
    for (var r = 0; r < panels.length && !lines.length; r++) {
      lines = readLines(panels[r], false);
    }
    if (lines.length) { page = doc; break; }
    var frames = doc.querySelectorAll('iframe, frame');
    for (var f = 0; f < frames.length; f++) {
      var child;
      try { child = frames[f].contentDocument; } catch (_) { continue; }
      if (isFilmotDocument(child)) docs.push(child);
    }
  }
  // Older result fragments may render the same numbered, jtt-backed rows
  // before Filmot attaches its usual transcript panel.
  for (var p = 0; p < docs.length && !lines.length; p++) {
    lines = readLines(docs[p], true);
    if (lines.length) page = docs[p];
  }

  function searchQuery(doc) {
    try {
      var match = doc.location.pathname.match(/\/search\/([^/]+)/);
      return match ? decodeURIComponent(match[1]).replace(/^["']+|["']+$/g, '') : '';
    } catch (_) { return ''; }
  }
  var query = searchQuery(page) || searchQuery(document);
  function metadata(selector) {
    return page.querySelector(selector) || document.querySelector(selector);
  }
  // Identify the currently-playing video. iframe.src is the most
  // reliable signal because filmot's Next/Prev swaps the src in place.
  function ytId(href) {
    if (typeof href !== 'string' || !href) return null;
    var pats = [
      /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/,
      /youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,})/,
      /youtu\.be\/([A-Za-z0-9_-]{6,})/,
      /[?&]v=([A-Za-z0-9_-]{6,})/,
      /\/sidebyside\/([A-Za-z0-9_-]{6,})/
    ];
    for (var p = 0; p < pats.length; p++) { var mmId = href.match(pats[p]); if (mmId) return mmId[1]; }
    return null;
  }
  var videoId = null;
  var ifr = metadata('#player');
  if (ifr && ifr.src) videoId = ytId(ifr.src);
  if (!videoId) {
    var ax = metadata('#divVideoDetails a[href*="watch?v="], #linktoyoutube a[href*="watch?v="]');
    if (ax) videoId = ytId(ax.href || ax.getAttribute('href') || '');
  }
  function videoIdFromPath(doc) {
    var path = doc.location.pathname;
    var match = path.match(/^\/sidebyside\/([A-Za-z0-9_-]{6,})/) ||
      path.match(/^\/search\/[^/]+\/([A-Za-z0-9_-]{11})\/[0-9]+(?:\/|$)/);
    return match ? match[1] : null;
  }
  if (!videoId) videoId = videoIdFromPath(page) || videoIdFromPath(document);
  var videoTitle = '';
  var titleEl = metadata('#divVideoDetails .col-6');
  if (titleEl) videoTitle = (titleEl.textContent || '').trim().split(/\s*[\r\n]+/)[0].slice(0, 200);
  if (!videoTitle) videoTitle = (page.title || document.title || '').trim();
  // Filmot links the uploader as /channel/<id>, next to the title.
  var chEl = metadata('#divVideoDetails a[href*="/channel/"]');
  var videoChannel = chEl ? (chEl.textContent || '').trim().slice(0, 100) : '';
  // --- Robust match resolution ---
  // Filmot does fuzzy/stemmed search across word forms (esp. in highly
  // inflected languages like Swedish), so an exact substring lookup on
  // the query word often misses. Try a cascade of strategies and remember
  // which one fired so the UI can flag fallbacks.
  function stripDiacritics(s) {
    try { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); }
    catch(e) { return s; }
  }
  function findMatch(lines, query) {
    if (!query) return { idx: -1, reason: 'no-query' };
    var q = query.toLowerCase();
    // 1) Exact substring.
    for (var i = 0; i < lines.length; i++) {
      if (lines[i].t.toLowerCase().indexOf(q) !== -1) return { idx: i, reason: 'exact' };
    }
    // 2) Diacritic-insensitive substring (e.g. "atgang" matches "åtgång").
    var qs = stripDiacritics(q);
    for (var i2 = 0; i2 < lines.length; i2++) {
      if (stripDiacritics(lines[i2].t.toLowerCase()).indexOf(qs) !== -1) return { idx: i2, reason: 'normalized' };
    }
    // 3) Stemmed prefix — drop trailing chars to catch inflections
    // ("vakna" should match "vaknade", "vaknar", "vaknat", "vakn-up", ...).
    for (var trim = 1; trim <= 4 && q.length - trim >= 3; trim++) {
      var qt = stripDiacritics(q.substring(0, q.length - trim));
      for (var i3 = 0; i3 < lines.length; i3++) {
        if (stripDiacritics(lines[i3].t.toLowerCase()).indexOf(qt) !== -1) return { idx: i3, reason: 'stem(-' + trim + ')' };
      }
    }
    // 4) Word-overlap — for multi-word queries, find the line containing
    // the largest number of query tokens.
    var tokens = q.split(/\s+/).filter(function(w){ return w.length > 1; });
    if (tokens.length > 1) {
      var best = -1, bestN = 0;
      for (var i4 = 0; i4 < lines.length; i4++) {
        var lt = stripDiacritics(lines[i4].t.toLowerCase());
        var n = 0;
        for (var t = 0; t < tokens.length; t++) {
          if (lt.indexOf(stripDiacritics(tokens[t])) !== -1) n++;
        }
        if (n > bestN) { bestN = n; best = i4; }
      }
      if (best >= 0 && bestN >= Math.max(1, Math.ceil(tokens.length / 2))) {
        return { idx: best, reason: 'tokens(' + bestN + '/' + tokens.length + ')' };
      }
    }
    return { idx: -1, reason: 'no-match' };
  }
  var resolved = findMatch(lines, query);
  var matchIdx = resolved.idx;
  var matchReason = resolved.reason;
  // 5) Time-based fallback — anchor at whatever subtitle is playing right now.
  if (matchIdx < 0 && lines.length) {
    try {
      var ct = null;
      var player = page.defaultView && page.defaultView.player;
      if (player && typeof player.getCurrentTime === 'function') {
        ct = player.getCurrentTime();
      }
      if (typeof ct === 'number' && ct >= 0) {
        for (var ti = 0; ti < lines.length; ti++) {
          var nxt = (ti + 1 < lines.length) ? lines[ti + 1].ts : (lines[ti].ts + 3);
          if (ct >= lines[ti].ts && ct < nxt) { matchIdx = ti; matchReason = 'currentTime'; break; }
        }
        if (matchIdx < 0) { matchIdx = lines.length - 1; matchReason = 'currentTime'; }
      }
    } catch(e) {}
  }
  // 6) Last resort: first non-empty line.
  if (matchIdx < 0) {
    for (var fi = 0; fi < lines.length; fi++) {
      if ((lines[fi].t || '').trim().length) { matchIdx = fi; matchReason = 'firstNonEmpty'; break; }
    }
  }
  var result = JSON.stringify({
    query: query,
    lines: lines,
    matchIdx: matchIdx,
    matchReason: matchReason,
    videoId: videoId || '',
    videoUrl: videoId ? ('https://www.youtube.com/watch?v=' + videoId) : '',
    videoTitle: videoTitle,
    videoChannel: videoChannel,
    diagnostics: diagnostics
  });
  if (typeof cupitorFilmotCaptureId !== 'number') return result;

  // The Flutter WebView pulls a single snapshot in small pieces. Page
  // navigation discards the reader and another capture supersedes it.
  var id = cupitorFilmotCaptureId;
  window.__cupitorReadFilmotCapture = function(requestId, offset) {
    if (requestId !== id) return null;
    var end = Math.min(offset + 4096, result.length);
    var last = result.charCodeAt(end - 1);
    if (end < result.length && last >= 0xd800 && last <= 0xdbff) end--;
    var chunk = result.slice(offset, end);
    if (end === result.length) delete window.__cupitorReadFilmotCapture;
    return JSON.stringify({chunk: chunk});
  };
  return JSON.stringify({length: result.length, cues: lines.length, diagnostics: diagnostics});
})();
