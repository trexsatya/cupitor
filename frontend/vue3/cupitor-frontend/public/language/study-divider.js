// One shared, accessible separator for the active view. Ratios are stored per
// view; viewport changes and a different media type are clamped on each paint.
export function splitGeometry({ height, width, top = 64, bottom = 0, transport = 0, audio = false, ratio }) {
  const available = Math.max(60, height - top - bottom - 12);
  const min = Math.min(available * 0.45, (audio ? 100 : 90) + transport);
  const max = Math.max(min, available - Math.min(100, available * 0.4));
  const natural = (audio ? 140 : Math.min(width, 900) * 9 / 16) + transport;
  const upper = Math.max(min, Math.min(max, Number.isFinite(ratio) ? ratio * available : natural));
  return { top, available, min, max, upper, y: top + upper, media: Math.max(20, upper - transport) };
}

export function installStudyDivider({ readRatio, saveRatio }) {
  const body = document.body;
  const divider = document.createElement('div');
  divider.id = 'studyMediaDivider';
  divider.hidden = true;
  divider.tabIndex = 0;
  divider.setAttribute('role', 'separator');
  divider.setAttribute('aria-orientation', 'horizontal');
  divider.title = 'Drag to resize player and text. Double-click to reset.';
  divider.innerHTML = '<span aria-hidden="true"></span>';
  body.appendChild(divider);
  let view, geometry, drag = null, frame = 0;
  const local = {};
  const visible = el => !!el && !!el.getClientRects().length && getComputedStyle(el).display !== 'none';
  const paint = () => {
    frame = 0;
    view = body.classList.contains('practice-mode') ? 'practice' : body.classList.contains('rec-playing') ? 'player' : null;
    const audioNode = document.getElementById(view === 'practice' ? 'practiceAudio' : 'recPlayingAudio');
    const audio = visible(audioNode);
    const media = audio ? audioNode : document.getElementById('mediaContainer');
    const active = !!view && visible(media);
    divider.hidden = !active;
    body.classList.toggle('study-split-active', active);
    if (!active) return;
    const bar = view === 'practice' ? document.querySelector('#practiceMode .practice-rec-bar') : null;
    const bottom = view === 'practice' ? Math.max(64, visible(bar) ? bar.getBoundingClientRect().height + 66 : 64) : 0;
    const ratio = Object.prototype.hasOwnProperty.call(local, view) ? local[view] : readRatio(view);
    geometry = splitGeometry({ height: window.innerHeight, width: window.innerWidth, bottom,
      transport: view === 'player' ? 60 : 0, audio, ratio });
    body.style.setProperty('--study-media-h', geometry.media + 'px');
    body.style.setProperty('--study-split-y', geometry.y + 'px');
    divider.setAttribute('aria-label', `Resize ${view === 'player' ? 'Player' : 'Practice'} player and text`);
    divider.setAttribute('aria-valuemin', String(Math.round(geometry.min / geometry.available * 100)));
    divider.setAttribute('aria-valuemax', String(Math.round(geometry.max / geometry.available * 100)));
    divider.setAttribute('aria-valuenow', String(Math.round(geometry.upper / geometry.available * 100)));
  };
  const refresh = () => { if (!frame) frame = requestAnimationFrame(paint); };
  const move = y => {
    if (!geometry || !view) return;
    local[view] = Math.max(geometry.min, Math.min(geometry.max, y - geometry.top)) / geometry.available;
    paint();
  };
  const commit = () => {
    if (!view || !Object.prototype.hasOwnProperty.call(local, view)) return;
    saveRatio(view, local[view]);
    delete local[view];
  };
  divider.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    event.preventDefault();
    drag = { id: event.pointerId, view, offset: event.clientY - geometry.y };
    divider.setPointerCapture(event.pointerId);
    body.classList.add('study-resizing');
  });
  divider.addEventListener('pointermove', event => {
    if (drag && drag.id === event.pointerId && drag.view === view) move(event.clientY - drag.offset);
  });
  const end = event => {
    if (!drag || drag.id !== event.pointerId) return;
    drag = null;
    body.classList.remove('study-resizing');
    commit();
  };
  divider.addEventListener('pointerup', end);
  divider.addEventListener('pointercancel', end);
  const reset = () => { local[view] = null; commit(); paint(); };
  divider.addEventListener('dblclick', reset);
  divider.addEventListener('keydown', event => {
    if (!geometry) return;
    if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      event.preventDefault(); event.stopPropagation();
      move(geometry.y + (event.key === 'ArrowUp' ? -10 : 10)); commit();
    } else if (event.key === 'Home') { event.preventDefault(); reset(); }
  });
  new MutationObserver(refresh).observe(body, { attributes: true, attributeFilter: ['class'], childList: true });
  window.addEventListener('resize', refresh);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', refresh);
  refresh();
  return { refresh };
}
