// public/fretboard-panel.js
// Controller for the fretboard visualizer panel. Pure helpers (buildTrail, cycleIndex) are exported
// for unit testing; init() wires the DOM and is exercised manually in the browser.
import { voicingsForNotes, findPaths, movementSparkline } from './fretboard-core.js';
import { renderFretboard } from './fretboard-render.js';

// Modulo stepper; tolerates count 0.
export function cycleIndex(idx, count, dir) {
  if (!count) return 0;
  return ((idx + dir) % count + count) % count;
}

// Build the trail [{voicing, age}] for steps 0..stepIdx of `path`. A per-step override
// (Map stepIdx→voicingIdx) swaps that step's voicing from `stepVoicings`. age = stepIdx - i.
export function buildTrail(path, stepVoicings, stepIdx, overrides) {
  const trail = [];
  for (let i = 0; i <= stepIdx; i++) {
    let voicing = path.voicings[i];
    if (overrides && overrides.has(i)) {
      const vs = stepVoicings[i] || [];
      const oi = overrides.get(i);
      if (vs[oi]) voicing = vs[oi];
    }
    trail.push({ voicing, age: stepIdx - i });
  }
  return trail;
}

// Wire the panel. `renderer` is a createMusicRenderer instance; `dom` holds the panel elements.
export function init(renderer, dom) {
  const state = {
    source: 'guessed',          // 'guessed' | 'window'
    includeSuppressed: false,
    matchOctave: true,          // true → place notes at their written register; false → pitch-class
    steps: [],                  // [{ measure?, name, noteNames }]
    stepVoicings: [],           // voicingsForNotes per step
    paths: [],                  // findPaths output
    selectedPathIdx: 0,
    stepIdx: 0,
    overrides: new Map(),       // stepIdx → voicingIdx
    playing: false,
    timer: null,
    speedMs: 900,
  };

  function setMsg(text) { if (dom.msg) dom.msg.textContent = text || ''; }

  function stopPlay() {
    state.playing = false;
    if (state.timer) { clearInterval(state.timer); state.timer = null; }
    if (dom.playBtn) dom.playBtn.textContent = '▶ Play';
  }

  function capture() {
    stopPlay();
    const opts = { includeSuppressed: state.includeSuppressed };
    let steps = [];
    if (state.source === 'guessed') {
      steps = renderer.getGuessedChordSequence(opts) || [];
    } else {
      const ws = renderer.getWindowNoteSet(opts);
      if (ws && ws.notes.length) steps = [{ name: 'window', notes: ws.notes }];
    }
    if (!steps.length) { setMsg('No chords to capture — guess chords or select a window first.'); return; }
    setMsg('');
    state.steps = steps;
    // Match-octave on → place notes at their exact written register (some chords may have no
    // playable shape). Off → drop the octave so each note resolves to any register (idiomatic shapes).
    state.stepVoicings = steps.map((s) =>
      state.matchOctave ? voicingsForNotes(s.notes) : voicingsForNotes(s.notes.map((n) => ({ name: n.name }))));
    state.paths = findPaths(state.stepVoicings);
    state.selectedPathIdx = 0;
    state.stepIdx = 0;
    state.overrides = new Map();
    populatePaths();
    render();
  }

  // Rewind the stepping back to the first step and drop any per-chord shape overrides. Keeps the
  // captured sequence and the selected path.
  function reset() {
    stopPlay();
    state.stepIdx = 0;
    state.overrides = new Map();
    render();
  }

  function populatePaths() {
    if (!dom.pathSelect) return;
    dom.pathSelect.innerHTML = '';
    state.paths.forEach((p, i) => {
      const opt = document.createElement('option');
      opt.value = '' + i;
      opt.textContent = `Path ${i + 1} — ${p.label}  ${movementSparkline(p.moves)}`;
      dom.pathSelect.appendChild(opt);
    });
    dom.pathSelect.value = '0';
  }

  function currentPath() { return state.paths[state.selectedPathIdx] || { voicings: [] }; }

  function render() {
    const path = currentPath();
    const trail = buildTrail(path, state.stepVoicings, state.stepIdx, state.overrides);
    renderFretboard(dom.svg, { trail });
    const step = state.steps[state.stepIdx];
    if (dom.stepLabel) dom.stepLabel.textContent =
      state.steps.length ? `${state.stepIdx + 1} / ${state.steps.length} — ${step ? step.name : ''}` : '—';
    const vs = state.stepVoicings[state.stepIdx] || [];
    const cur = state.overrides.has(state.stepIdx) ? state.overrides.get(state.stepIdx) : 0;
    if (dom.shapeLabel) dom.shapeLabel.textContent = vs.length ? `${cur + 1} / ${vs.length}` : '0 / 0';
    // Strict octave can leave a chord with no reachable shape — say so, and point at the toggle.
    if (dom.msg) setMsg(vs.length ? '' :
      `No playable shape for ${step ? step.name : 'this chord'} at its written octave — uncheck "match octave" for more shapes.`);
  }

  function step(dir) {
    if (!state.steps.length) return;
    const n = state.steps.length;
    state.stepIdx = Math.max(0, Math.min(n - 1, state.stepIdx + dir));
    render();
  }

  function play() {
    if (state.playing) { stopPlay(); return; }
    if (!state.steps.length) return;
    state.playing = true;
    if (dom.playBtn) dom.playBtn.textContent = '⏸ Pause';
    state.timer = setInterval(() => {
      if (state.stepIdx >= state.steps.length - 1) { stopPlay(); return; }
      state.stepIdx += 1;
      render();
    }, state.speedMs);
  }

  function cycleShape(dir) {
    const vs = state.stepVoicings[state.stepIdx] || [];
    if (!vs.length) return;
    const cur = state.overrides.has(state.stepIdx) ? state.overrides.get(state.stepIdx) : 0;
    state.overrides.set(state.stepIdx, cycleIndex(cur, vs.length, dir));
    render();
  }

  // Toggle native fullscreen on the panel element.
  function toggleFullscreen() {
    const el = dom.panel;
    if (!el || !el.requestFullscreen) return;
    if (document.fullscreenElement === el) {
      if (document.exitFullscreen) document.exitFullscreen();
    } else {
      if (el.open === false) el.open = true;   // a collapsed <details> would be blank fullscreen
      el.requestFullscreen();
    }
  }

  function reflectSource() {
    if (dom.srcGuessed) dom.srcGuessed.classList.toggle('alt', state.source !== 'guessed');
    if (dom.srcWindow) dom.srcWindow.classList.toggle('alt', state.source !== 'window');
  }

  // Wiring.
  if (dom.srcGuessed) dom.srcGuessed.addEventListener('click', () => { state.source = 'guessed'; reflectSource(); });
  if (dom.srcWindow) dom.srcWindow.addEventListener('click', () => { state.source = 'window'; reflectSource(); });
  // A capture parameter changed — re-run the capture in place if the user has already captured once,
  // so toggling reflects immediately without re-clicking Capture.
  function maybeRecapture() { if (state.steps.length) capture(); }
  if (dom.suppressChk) dom.suppressChk.addEventListener('change', (e) => { state.includeSuppressed = e.target.checked; maybeRecapture(); });
  if (dom.octaveChk) dom.octaveChk.addEventListener('change', (e) => { state.matchOctave = e.target.checked; maybeRecapture(); });
  if (dom.captureBtn) dom.captureBtn.addEventListener('click', capture);
  if (dom.resetBtn) dom.resetBtn.addEventListener('click', reset);
  if (dom.fullscreenBtn) {
    dom.fullscreenBtn.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', () => {
      dom.fullscreenBtn.textContent = document.fullscreenElement === dom.panel ? 'Exit fullscreen' : '⛶ Fullscreen';
    });
  }
  if (dom.pathSelect) dom.pathSelect.addEventListener('change', (e) => {
    state.selectedPathIdx = parseInt(e.target.value, 10) || 0; state.overrides = new Map(); render();
  });
  if (dom.prevBtn) dom.prevBtn.addEventListener('click', () => { stopPlay(); step(-1); });
  if (dom.nextBtn) dom.nextBtn.addEventListener('click', () => { stopPlay(); step(+1); });
  if (dom.playBtn) dom.playBtn.addEventListener('click', play);
  if (dom.speed) dom.speed.addEventListener('input', (e) => { state.speedMs = 1600 - parseInt(e.target.value, 10); });
  if (dom.shapePrev) dom.shapePrev.addEventListener('click', () => cycleShape(-1));
  if (dom.shapeNext) dom.shapeNext.addEventListener('click', () => cycleShape(+1));
  if (dom.panel) dom.panel.addEventListener('toggle', () => { if (!dom.panel.open) stopPlay(); });

  reflectSource();

  // Mobile late-settle guard (same rationale as the sheet renderer): a URL-bar collapse, rotation,
  // or font load can repaint the SVG and strand the fretboard's text/dots. Re-draw on settle when a
  // capture is showing. Debounced; a no-op before the first capture.
  if (typeof window !== 'undefined' && window.addEventListener) {
    let _ft = null;
    const settle = () => { clearTimeout(_ft); _ft = setTimeout(() => { if (state.steps.length) render(); }, 160); };
    const vv = window.visualViewport;
    if (vv && vv.addEventListener) vv.addEventListener('resize', settle); else window.addEventListener('resize', settle);
    window.addEventListener('orientationchange', settle);
  }

  return { capture, reset, _state: state }; // _state exposed for debugging only
}
