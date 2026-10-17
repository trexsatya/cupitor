// Chrome is transient; the learning content and section sizes never change.
export function createStudyChrome({ render, blocked, idleMs = 3000, setTimer = setTimeout, clearTimer = clearTimeout }) {
  let active = false, timer = null, visible = true;
  const cancel = () => { if (timer != null) clearTimer(timer); timer = null; };
  const schedule = (delay = idleMs) => {
    cancel();
    if (!active) return;
    timer = setTimer(() => {
      timer = null;
      if (blocked()) { schedule(300); return; }
      visible = false; render(false);
    }, delay);
  };
  const show = () => { visible = true; render(true); schedule(); };
  return {
    activate() { active = true; show(); },
    deactivate() { active = false; cancel(); visible = true; render(true); },
    show,
    isVisible: () => visible,
  };
}

export function installStudyChrome() {
  const body = document.body;
  const wake = document.createElement('button');
  wake.id = 'studyControlsWakeSurface'; wake.type = 'button'; wake.hidden = true;
  wake.setAttribute('aria-label', 'Show playback controls');
  body.appendChild(wake);
  const viewNow = () => body.classList.contains('practice-mode') ? 'practice' : body.classList.contains('rec-playing') ? 'player' : null;
  const shown = el => !!el && !!el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden';
  let view = null, pointer = null, keyboard = false, swallow = null, releaseTimer = null, ignoreDoubleUntil = 0;
  const controls = '#recPlayingBanner,#recPlayingTransport,#recPlayingMinimizeBtn,#recPlayingCloseBtn,#practiceMode .practice-topbar,#practiceMode .practice-nav,#practiceMode .practice-ctx-ctrl,#practiceMode .practice-rec-bar,#practiceAudio,#recPlayingAudio,#studyMediaDivider';
  const blocked = () => {
    if (pointer || body.classList.contains('study-resizing')) return true;
    if ([...document.querySelectorAll('.ui-dialog,#practiceMode .practice-info-panel,#practiceMode .practice-settings-panel,#recPlayingBanner.rec-pb-expanded')].some(shown)) return true;
    if (document.querySelector('#practiceMode .prec-toggle.on')) return true;
    const focus = document.activeElement;
    return shown(focus) && (focus.matches('input,textarea,select,[contenteditable="true"]') ||
      (keyboard && !!focus.closest(controls)));
  };
  const coverVideo = () => {
    const media = document.getElementById('mediaContainer');
    // Touch browsers dispatch their compatibility click after pointerup. Keep
    // the surface in place until that click is consumed, or it can hit the
    // cross-origin player after the controls have already reappeared.
    wake.hidden = !view || (chrome.isVisible() && !swallow?.video) || !shown(media);
    if (wake.hidden) return;
    const r = media.getBoundingClientRect();
    Object.assign(wake.style, { left: r.x + 'px', top: r.y + 'px', width: r.width + 'px', height: r.height + 'px' });
  };
  const chrome = createStudyChrome({ blocked, render: visible => {
    body.classList.toggle('study-controls-hidden', !!view && !visible);
    coverVideo();
  } });
  const update = () => {
    const next = viewNow();
    if (next !== view) {
      view = next; pointer = null; swallow = null; clearTimeout(releaseTimer);
      if (view) chrome.activate(); else chrome.deactivate();
    } else coverVideo();
  };
  new MutationObserver(update).observe(body, { attributes: true, attributeFilter: ['class'], childList: true });
  window.addEventListener('resize', coverVideo);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', coverVideo);
  document.addEventListener('pointerdown', event => {
    if (!view || event.button !== 0 || event.target.closest('.ui-dialog')) return;
    keyboard = false;
    pointer = { id: event.pointerId, x: event.clientX, y: event.clientY, hidden: !chrome.isVisible(), moved: false, view };
    if (chrome.isVisible()) chrome.show();
  }, true);
  document.addEventListener('pointermove', event => {
    if (pointer && pointer.id === event.pointerId && Math.hypot(event.clientX - pointer.x, event.clientY - pointer.y) > 10) pointer.moved = true;
  }, true);
  document.addEventListener('pointerup', event => {
    if (!pointer || pointer.id !== event.pointerId) return;
    const tap = pointer; pointer = null;
    if (tap.view !== view) return;
    if (tap.moved) { if (!tap.hidden) chrome.show(); return; }
    if (tap.hidden) {
      const pending = swallow = { x: event.clientX, y: event.clientY, until: Date.now() + 700, video: event.target === wake };
      clearTimeout(releaseTimer);
      releaseTimer = setTimeout(() => { if (swallow === pending) { swallow = null; coverVideo(); } }, 700);
      ignoreDoubleUntil = Date.now() + 700;
    }
    chrome.show();
  }, true);
  document.addEventListener('pointercancel', () => { const visible = pointer && !pointer.hidden; pointer = null; if (visible) chrome.show(); }, true);
  document.addEventListener('click', event => {
    if (!view || !swallow || !event.isTrusted || event.detail === 0) return;
    const pending = swallow; swallow = null; clearTimeout(releaseTimer); coverVideo();
    if (Date.now() <= pending.until && Math.hypot(event.clientX - pending.x, event.clientY - pending.y) < 20) {
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  document.addEventListener('dblclick', event => {
    if (view && event.target.closest('#practiceMode .practice-card') && Date.now() < ignoreDoubleUntil) { event.preventDefault(); event.stopImmediatePropagation(); }
  }, true);
  document.addEventListener('keydown', () => { if (view) { keyboard = true; chrome.show(); } }, true);
  wake.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); event.stopPropagation(); chrome.show(); }
  });
  wake.addEventListener('click', () => chrome.show());
  update();
  return chrome;
}
