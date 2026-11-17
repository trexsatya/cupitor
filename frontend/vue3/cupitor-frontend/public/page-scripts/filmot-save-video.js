(function(){
  if (location.hostname !== 'filmot.com' && !location.hostname.endsWith('.filmot.com')) return JSON.stringify({});
  function ytIdFromAny(href) {
    if (!href) return null;
    var pats = [
      /youtube\.com\/embed\/([A-Za-z0-9_-]{6,})/,
      /youtube\.com\/watch\?v=([A-Za-z0-9_-]{6,})/,
      /youtu\.be\/([A-Za-z0-9_-]{6,})/,
      /[?&]v=([A-Za-z0-9_-]{6,})/,
      /\/sidebyside\/([A-Za-z0-9_-]{6,})/,
      /\/(?:video|watch)\/([A-Za-z0-9_-]{6,})/
    ];
    for (var i = 0; i < pats.length; i++) { var m = href.match(pats[i]); if (m) return m[1]; }
    return null;
  }
  function packFor(id, fallbackTitle) {
    var ch = (window.__cupitorVideoChannel || {})[id] || '';
    var tEl = document.querySelector('#divVideoDetails .col-6');
    var t = tEl ? (tEl.textContent || '').trim().split(/\s*[\r\n]+/)[0].slice(0, 200) : '';
    if (!t) t = (fallbackTitle || document.title || '').trim().slice(0, 200);
    return JSON.stringify({ url: 'https://www.youtube.com/watch?v=' + id, channel: ch, title: t });
  }
  // 1. The live iframe is the most reliable signal — it always reflects
  //    the currently playing video, including after a JS-driven "Next".
  var ifr = document.getElementById('player');
  if (ifr && ifr.src) {
    var id1 = ytIdFromAny(ifr.src);
    if (id1) return packFor(id1, '');
  }
  // 2. The "Open on youtube:" / external-link anchor in #divVideoDetails
  //    updates alongside the iframe.
  var detailA = document.querySelector('#divVideoDetails a[href*="watch?v="], #linktoyoutube a[href*="watch?v="]');
  if (detailA) {
    var id2 = ytIdFromAny(detailA.href || detailA.getAttribute('href') || '');
    if (id2) return packFor(id2, detailA.textContent || '');
  }
  // 3. URL-based: only true on the standalone /sidebyside/ detail page.
  var pm = location.pathname.match(/\/sidebyside\/([A-Za-z0-9_-]{6,})/);
  if (pm) return packFor(pm[1], '');
  // 4. Last resort — pick the vcard nearest the viewport center.
  var cards = Array.prototype.slice.call(document.querySelectorAll('[id^="vcard_"]'));
  var center = window.innerHeight / 2;
  var best = null, bestDist = Infinity;
  for (var i = 0; i < cards.length; i++) {
    var c = cards[i];
    var r = c.getBoundingClientRect();
    if (r.bottom < 0 || r.top > window.innerHeight) continue;
    var d = Math.abs((r.top + r.bottom) / 2 - center);
    if (d < bestDist) { bestDist = d; best = c; }
  }
  if (!best) return JSON.stringify({});
  var id4 = best.id.replace(/^vcard_/, '');
  var titleA = best.querySelector('a[id^="vlink"]');
  return packFor(id4, titleA ? titleA.textContent || '' : '');
})();
