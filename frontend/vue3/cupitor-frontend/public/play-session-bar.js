// public/play-session-bar.js
// The page's controls for a playback session while it plays: the time, a
// slider to seek, and the chapters. Like the pause button it stays out of
// sight until the mouse moves (and is always there while paused). Keys while
// a session plays: ← / → five seconds back / on (with Shift, one second),
// [ / ] the previous / next chapter. Seeking is off while recording.
// When the narration has come to its end the bar stays (until closed with ×):
// ▶, the slider or a chapter plays again from there; × or Escape closes it.
// Stopping a session that plays leaves no bar.

const fmt = t => {
  t = Math.max(0, Math.floor(t || 0));
  const h = Math.floor(t / 3600), m = Math.floor(t / 60) % 60, s = t % 60;
  return (h ? `${h}:${String(m).padStart(2, '0')}` : `${m}`) + `:${String(s).padStart(2, '0')}`;
};
export { fmt as formatTime };

const STYLE = `
#play-session-bar { display: none; position: fixed; top: 14px; left: 50%; transform: translateX(-50%); z-index: 999999;
  align-items: center; gap: 10px; padding: 5px 12px; border-radius: 14px; background: rgba(0,0,0,.55); color: #fff;
  font: 12px system-ui, sans-serif; opacity: 0; pointer-events: none; transition: opacity .3s; }
body.play-session #play-session-bar, body.play-session-ended #play-session-bar { display: flex; }
/* Out of play mode the page's rulers and buttons are at the top: above its toolbar at the bottom instead. */
body.play-session-ended #play-session-bar { opacity: 1; pointer-events: auto; top: auto; bottom: 84px; }
#play-session-bar button { display: none; background: none; border: none; color: #fff; font: inherit; font-size: 14px; cursor: pointer; padding: 0 2px; }
body.play-session-ended #play-session-bar button { display: inline; }
body.pointer-moving #play-session-bar { opacity: .75; pointer-events: auto; }
#play-session-bar:hover, #play-session-bar:focus-within, body.play-paused #play-session-bar { opacity: 1; pointer-events: auto; }
body.screen-recording #play-session-bar { visibility: hidden; }
#play-session-bar input[type=range] { width: min(46vw, 520px); accent-color: #fff; }
#play-session-bar select { max-width: 220px; background: rgba(255,255,255,.12); color: #fff; border: none; border-radius: 8px; padding: 2px 6px; font: inherit; }
#play-session-bar select option { color: #000; }
#play-session-bar .time { font-variant-numeric: tabular-nums; min-width: 84px; text-align: right; }
`;

let current = null; // the bar on the page: one at a time

export function attachSessionBar(session, doc = document) {
  if (current) current.detach(); // a later session's bar replaces an earlier one's
  if (!doc.getElementById('play-session-bar-style')) {
    const st = doc.createElement('style');
    st.id = 'play-session-bar-style';
    st.textContent = STYLE;
    doc.head.appendChild(st);
  }
  const bar = doc.createElement('div');
  bar.id = 'play-session-bar';
  bar.innerHTML = '<button class="again" title="Play from here" aria-label="Play from here">&#9654;</button><span class="time"></span><input type="range" min="0" step="0.1" aria-label="Position"><select aria-label="Chapter"></select><button class="close" title="Close" aria-label="Close">&times;</button>';
  doc.body.appendChild(bar);
  const time = bar.querySelector('.time'), slider = bar.querySelector('input'), chapters = bar.querySelector('select');
  let dragging = false, closed = false;

  const active = () => session.state === 'playing' || session.state === 'paused';
  const ended = () => session.state === 'ended' && !closed;
  function showTime(t) {
    if (dragging) return; // the label shows where the drag is
    time.textContent = `${fmt(t)} / ${fmt(session.duration)}`;
    slider.value = String(t);
    const c = session.chapterAt(t);
    // Ended, none is chosen, so any chapter (the last one too) can be picked to play.
    if (ended()) chapters.selectedIndex = -1;
    else if (c && chapters.value !== c.id) chapters.value = c.id;
  }
  function refresh() {
    const on = active();
    if (on) closed = false; // shown again by the next play
    doc.body.classList.toggle('play-session', on);
    doc.body.classList.toggle('play-session-ended', ended());
    if (!on && !ended()) { dragging = false; return; }
    slider.max = String(session.duration || 0);
    slider.disabled = chapters.disabled = session.isRecording;
    bar.title = session.isRecording ? 'Seeking is off while recording' : '';
    const list = session.chapters;
    chapters.style.display = list.length ? '' : 'none';
    if (chapters.options.length !== list.length || list.some((c, i) => chapters.options[i].value !== c.id)) {
      chapters.innerHTML = '';
      list.forEach(c => { const o = doc.createElement('option'); o.value = c.id; o.textContent = `${fmt(c.at)}  ${c.title || c.id}`; chapters.appendChild(o); });
    }
    showTime(session.time);
  }
  // Playing or paused: seek. Ended: play again from there (this is the user's click, so the audio may start).
  // A seek that fails (e.g. a stop came first) is reported by the session's 'error' event.
  const go = t => {
    if (session.isRecording) return;
    t = Math.max(0, Math.min(t, session.duration || t));
    if (session.state === 'ended') { closed = false; session.play({ from: t }).catch(() => {}); }
    else session.seek(t).catch(() => {});
  };
  // ▶ at the end plays from the beginning.
  bar.querySelector('.again').addEventListener('click', () => go(+slider.value >= (session.duration || 0) - 0.05 ? 0 : +slider.value));
  bar.querySelector('.close').addEventListener('click', () => { closed = true; refresh(); });

  slider.addEventListener('input', () => { dragging = true; time.textContent = `${fmt(+slider.value)} / ${fmt(session.duration)}`; });
  slider.addEventListener('change', () => { dragging = false; go(+slider.value); slider.blur(); });
  chapters.addEventListener('change', () => {
    const c = session.chapters.find(x => x.id === chapters.value);
    if (c) go(c.at);
    chapters.blur();
  });

  const typing = t => t && (t.tagName === 'INPUT' && t.type !== 'range' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
  const onKey = e => {
    if (e.key === 'Escape' && ended()) { closed = true; refresh(); return; }
    if (!active() || session.isRecording || e.metaKey || e.ctrlKey || e.altKey || typing(e.target)) return;
    const list = session.chapters, now = session.time;
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      e.stopImmediatePropagation(); // not the canvas's nudge of a selected object
      go(now + (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1 : 5));
    } else if ((e.key === '[' || e.key === ']') && list.length) {
      e.preventDefault();
      const cur = session.chapterAt(now);
      const i = cur ? list.indexOf(cur) : -1;
      // [ goes to the start of this chapter, or the one before when already near its start.
      // Before the first chapter, [ goes to the start.
      let to;
      if (e.key === ']') to = list[i + 1] ? list[i + 1].at : null;
      else to = !cur ? 0 : now - cur.at > 2 ? cur.at : i > 0 ? list[i - 1].at : 0;
      if (to != null && !session.isRecording) session.seek(to).catch(() => {});
    }
  };
  doc.addEventListener('keydown', onKey, true);

  const offs = [
    session.on('statechange', refresh),
    session.on('timechange', e => { if (active() || ended()) showTime(e.time); }),
    session.on('dispose', () => detach())
  ];
  function detach() {
    if (current !== handle) return;
    current = null;
    offs.forEach(off => off());
    doc.removeEventListener('keydown', onKey, true);
    bar.remove();
    doc.body.classList.remove('play-session', 'play-session-ended');
  }
  const handle = { element: bar, detach, refresh };
  current = handle;
  refresh();
  return handle;
}
