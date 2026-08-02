// public/fretboard-panel.js
// Controller for the fretboard visualizer panel. Pure helpers (buildTrail, cycleIndex) are exported
// for unit testing; init() wires the DOM and is exercised manually in the browser.
import { voicingsForNotes, findPaths, findCombinations, movementSparkline, noteAt } from './fretboard-core.js';
import { renderFretboard } from './fretboard-render.js';
import { equalNotes } from './music-reference-data.js';

// "string:fret" keys of positions in `voicing` whose note also appears in `prevNotes` (the previous
// step's notes, [{name, octave}]) — the common notes to highlight when stepping. Enharmonic-aware.
// When `matchOctave` is true a note must match name AND octave to count as common; otherwise the
// match is by pitch class.
export function commonPositions(voicing, prevNotes, matchOctave) {
  const keys = new Set();
  if (!voicing || !prevNotes || !prevNotes.length) return keys;
  voicing.forEach((p) => {
    const nm = noteAt(p.string, p.fret);
    if (!nm) return;
    const hit = prevNotes.some((x) =>
      equalNotes(x.name, nm.name) && (!matchOctave || String(x.octave) === String(nm.octave)));
    if (hit) keys.add(`${p.string}:${p.fret}`);
  });
  return keys;
}

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

// Per-string movement arrows for a step where several notes land on one string. `seq` is the step's
// ordered note sequence (with repeats) [{name, octave}]; each is mapped to its position in `voicing`,
// then per string the ordered frets are classified: 'up' (frets rise), 'down' (fall), or 'bi'
// (reverses, e.g. n1→n2→n1). Strings with <2 sounded notes, or no fret change, yield no arrow.
export function stringArrows(voicing, seq, matchOctave) {
  if (!voicing || !seq || seq.length < 2) return [];
  const posFor = (note) => voicing.find((p) => {
    const nm = noteAt(p.string, p.fret);
    return nm && equalNotes(note.name, nm.name) && (!matchOctave || String(note.octave) === String(nm.octave));
  });
  const perString = new Map();   // string → ordered frets
  seq.forEach((note) => {
    const p = posFor(note);
    if (!p) return;
    if (!perString.has(p.string)) perString.set(p.string, []);
    perString.get(p.string).push(p.fret);
  });
  const arrows = [];
  perString.forEach((frets, string) => {
    if (frets.length < 2) return;
    let up = false, down = false;
    for (let i = 1; i < frets.length; i++) {
      if (frets[i] > frets[i - 1]) up = true;
      else if (frets[i] < frets[i - 1]) down = true;
    }
    if (!up && !down) return;   // repeated same fret → no movement
    arrows.push({ string, minFret: Math.min(...frets), maxFret: Math.max(...frets), dir: (up && down) ? 'bi' : (up ? 'up' : 'down') });
  });
  return arrows;
}

// MIDI number for a standard-tuning note {name, octave}. The tuning table spells notes with sharps
// only, so a sharp semitone map is sufficient; C4 = 60 (octave "4"). null when unresolvable. Local
// so the pure helper below has no DOM/module coupling.
const SEMITONE = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
function midiOfNote(name, octave) {
  const s = SEMITONE[name];
  if (s == null) return null;
  const o = parseInt(octave, 10);
  if (Number.isNaN(o)) return null;
  return (o + 1) * 12 + s;
}

// PURE: "string:fret" keys of a voicing's positions whose sounding note's MIDI is in `highlightMidis`
// (a Set of MIDI numbers — a variation's ADDED notes). A voicing position carries only { string, fret }
// (see voicingsForNotes), so pitch identity is recovered via noteAt(string,fret) → {name,octave} and
// converted to MIDI. Matching by MIDI is register-exact and enharmonic-proof (the sheet's added-note
// marks carry MIDI too). Empty set for a missing voicing or empty highlight set.
export function extraKeysForVoicing(voicing, highlightMidis) {
  const keys = new Set();
  if (!voicing || !highlightMidis || !highlightMidis.size) return keys;
  voicing.forEach((p) => {
    const nm = noteAt(p.string, p.fret);
    if (!nm) return;
    const midi = midiOfNote(nm.name, nm.octave);
    if (midi != null && highlightMidis.has(midi)) keys.add(`${p.string}:${p.fret}`);
  });
  return keys;
}

// Wire the panel. `renderer` is a createMusicRenderer instance; `dom` holds the panel elements;
// `hooks.playSequence(events)` sounds a step's notes as they read on the sheet (injected by the
// page so the fretboard reuses the main player/instrument); `events` is [{midi, beat, durBeats}].
export function init(renderer, dom, hooks = {}) {
  const state = {
    source: 'guessed',          // 'guessed' | 'window' | 'matched' | 'phrases'
    includeSuppressed: false,
    // true → place notes at their written register; false → pitch-class (idiomatic shapes).
    // Initialised from the checkbox so the HTML default is the source of truth.
    matchOctave: !!(dom && dom.octaveChk && dom.octaveChk.checked),
    requirePlayable: !!(dom && dom.playableChk && dom.playableChk.checked),  // enforce fretted span ≤ 3
    autoPlay: !!(dom && dom.autoPlayChk && dom.autoPlayChk.checked),         // sound each step on Prev/Next
    showNoteName: !!(dom && dom.noteNameChk && dom.noteNameChk.checked),     // dots show note names vs fret #
    steps: [],                  // [{ measure?, name, noteNames }]
    stepVoicings: [],           // voicingsForNotes per step
    paths: [],                  // findPaths output (region-coherent "ways to play")
    selectedPathIdx: 0,
    combos: [],                 // findCombinations output (cross-region mixes of the paths' voicings)
    selectedComboIdx: 0,
    activeSource: 'path',       // 'path' (Ways to play) | 'combo' (Combinations) — which select drives the diagram
    stepIdx: 0,
    overrides: new Map(),       // stepIdx → voicingIdx
    highlightMidis: new Set(),  // MIDI numbers of ADDED notes to ring (segment-embellishment variation)
    playing: false,
    timer: null,
    speedMs: 900,
    stepRenderer: renderer,     // sheet whose cursor follows stepping — main renderer, or a variation's (set per capture)
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
    } else if (state.source === 'matched') {
      steps = (renderer.getPatternMatchSequence && renderer.getPatternMatchSequence(opts)) || [];
    } else if (state.source === 'phrases') {
      steps = (renderer.getPhrasesSequence && renderer.getPhrasesSequence(opts)) || [];
    } else {
      const ws = renderer.getWindowNoteSet(opts);
      if (ws && ws.notes.length) steps = [{ name: 'window', notes: ws.notes, seq: ws.seq, measures: ws.measureRange }];
    }
    if (!steps.length) {
      if (renderer.clearStepHighlight) renderer.clearStepHighlight();
      if (renderer.hideCursor) renderer.hideCursor();   // nothing to track on the main sheet
      setMsg(state.source === 'matched' ? 'No motifs — run Find pattern (Motifs panel) first.'
        : state.source === 'phrases' ? 'No phrases with notes on the sheet — create one in the Phrases panel first.'
        : 'No chords to capture — guess chords or select a window first.');
      return;
    }
    setMsg('');
    state.highlightMidis = new Set();   // a normal capture never rings extra notes
    state.stepRenderer = renderer;      // main-sheet sources → the cursor follows the main preview
    state.steps = steps;
    // Match-octave on → place notes at their exact written register AND allow two notes on the same
    // string (show every sheet note where it sounds). Off → drop the octave so each note resolves to
    // any register, one per string (idiomatic playable shapes). `requirePlayable` gates the span filter.
    const opts2 = { requirePlayable: state.requirePlayable, requireDistinctStrings: !state.matchOctave };
    state.stepVoicings = steps.map((s) =>
      state.matchOctave ? voicingsForNotes(s.notes, opts2) : voicingsForNotes(s.notes.map((n) => ({ name: n.name })), opts2));
    state.paths = findPaths(state.stepVoicings);
    state.selectedPathIdx = 0;
    state.combos = findCombinations(state.paths, { cap: 100 });
    state.selectedComboIdx = 0;
    state.activeSource = 'path';
    state.stepIdx = 0;
    state.overrides = new Map();
    populatePaths();
    populateCombos();
    render();
  }

  // Capture steps supplied DIRECTLY (bypassing the renderer's chord/window/pattern sources), for the
  // segment-embellishment variation view: the caller passes a variation's steps and the MIDI numbers
  // of its ADDED notes, which get ringed on the fretboard. Mirrors capture()'s voicing/path logic.
  function captureSteps(steps, { highlightMidis, cursorRenderer } = {}) {
    stopPlay();
    state.stepRenderer = cursorRenderer || renderer;   // e.g. the variation sheet's renderer, so its cursor follows
    state.steps = steps || [];
    const opts2 = { requirePlayable: state.requirePlayable, requireDistinctStrings: !state.matchOctave };
    state.stepVoicings = state.steps.map((s) =>
      state.matchOctave ? voicingsForNotes(s.notes, opts2) : voicingsForNotes(s.notes.map((n) => ({ name: n.name })), opts2));
    state.paths = findPaths(state.stepVoicings);
    state.selectedPathIdx = 0;
    state.combos = findCombinations(state.paths, { cap: 100 });
    state.selectedComboIdx = 0;
    state.activeSource = 'path';
    state.stepIdx = 0;
    state.overrides = new Map();
    state.highlightMidis = new Set(highlightMidis || []);
    populatePaths();
    populateCombos();
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

  // Fill the "Combinations" select with the cross-region mixes (empty/disabled when there are none —
  // e.g. a single region, or a one-chord capture, has nothing to mix).
  function populateCombos() {
    if (!dom.comboSelect) return;
    dom.comboSelect.innerHTML = '';
    state.combos.forEach((c, i) => {
      const opt = document.createElement('option');
      opt.value = '' + i;
      opt.textContent = `Combo ${i + 1} — ${c.label}  ${movementSparkline(c.moves)}`;
      dom.comboSelect.appendChild(opt);
    });
    dom.comboSelect.value = '0';
    dom.comboSelect.disabled = !state.combos.length;
  }

  // The voicing assignment currently driving the diagram — the selected "Ways to play" path or the
  // selected "Combinations" mix, per activeSource. Both carry a `voicings` array, so callers are uniform.
  function currentPath() {
    if (state.activeSource === 'combo') return state.combos[state.selectedComboIdx] || { voicings: [] };
    return state.paths[state.selectedPathIdx] || { voicings: [] };
  }

  function render() {
    const path = currentPath();
    const trail = buildTrail(path, state.stepVoicings, state.stepIdx, state.overrides);
    // Highlight notes held in common with the previous step (current voicing is the age-0 entry).
    // Respect match-octave: when on, "common" means same pitch AND octave; when off, pitch class.
    const prev = state.steps[state.stepIdx - 1];
    const prevNotes = prev ? (prev.notes || []) : [];
    const curVoicing = (trail[trail.length - 1] || {}).voicing;
    const highlight = commonPositions(curVoicing, prevNotes, state.matchOctave);
    // Movement arrows for strings that carry several notes (only meaningful in match-octave mode,
    // where two notes can share a string). Sheet order comes from the step's `seq`.
    const arrows = stringArrows(curVoicing, (state.steps[state.stepIdx] || {}).seq, state.matchOctave);
    // Ring the current voicing's ADDED notes (only for a captureSteps() with highlightMidis; empty
    // for normal captures, so the base fretboard behavior is unchanged).
    const extra = (state.highlightMidis && state.highlightMidis.size)
      ? extraKeysForVoicing(curVoicing, state.highlightMidis) : new Set();
    const curStep = state.steps[state.stepIdx];
    renderFretboard(dom.svg, { trail, highlight, arrows, extra, labelMode: state.showNoteName ? 'note' : 'fret',
      label: curStep && curStep.name && curStep.name !== 'window' ? curStep.name : '' });
    // Shade the sheet segment (measure band behind the notes) for the current step, tracking stepping.
    if (renderer.highlightStepMeasures) renderer.highlightStepMeasures((state.steps[state.stepIdx] || {}).measures || null);
    // Move the sheet cursor to the current step so the score follows the fretboard. `stepRenderer` is
    // whichever sheet these steps came from (main preview, or a variation). The step's earliest event
    // beat is its absolute onset; a step without events just leaves the cursor put.
    if (state.stepRenderer && state.stepRenderer.showCursorAtBeat && curStep && curStep.events && curStep.events.length) {
      state.stepRenderer.showCursorAtBeat(Math.min(...curStep.events.map((e) => e.beat)));
    }
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
    const prevIdx = state.stepIdx;
    state.stepIdx = Math.max(0, Math.min(n - 1, state.stepIdx + dir));
    render();
    // Auto-play: sound the new step as it reads on the sheet (only when the index actually moved).
    if (state.autoPlay && state.stepIdx !== prevIdx) playStep();
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

  // Sound the current step as it reads on the sheet (the notes behind the highlighted segment), via
  // the injected playSequence hook. Independent of the visual step transport.
  function playStep() {
    if (!hooks.playSequence) return;
    const events = (state.steps[state.stepIdx] || {}).events || [];
    if (events.length) hooks.playSequence(events);
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
    if (dom.srcMatched) dom.srcMatched.classList.toggle('alt', state.source !== 'matched');
    if (dom.srcPhrases) dom.srcPhrases.classList.toggle('alt', state.source !== 'phrases');
  }

  // Wiring. Selecting a source captures immediately (there's no separate Capture button); clicking
  // the already-selected chip re-captures, so it doubles as a manual refresh.
  function selectSource(name) { state.source = name; reflectSource(); capture(); }
  if (dom.srcGuessed) dom.srcGuessed.addEventListener('click', () => selectSource('guessed'));
  if (dom.srcWindow) dom.srcWindow.addEventListener('click', () => selectSource('window'));
  if (dom.srcMatched) dom.srcMatched.addEventListener('click', () => selectSource('matched'));
  if (dom.srcPhrases) dom.srcPhrases.addEventListener('click', () => selectSource('phrases'));
  // A capture parameter changed — re-run the capture in place if the user has already captured once,
  // so toggling reflects immediately.
  function maybeRecapture() { if (state.steps.length) capture(); }
  if (dom.suppressChk) dom.suppressChk.addEventListener('change', (e) => { state.includeSuppressed = e.target.checked; maybeRecapture(); });
  if (dom.octaveChk) dom.octaveChk.addEventListener('change', (e) => { state.matchOctave = e.target.checked; maybeRecapture(); });
  if (dom.playableChk) dom.playableChk.addEventListener('change', (e) => { state.requirePlayable = e.target.checked; maybeRecapture(); });
  if (dom.autoPlayChk) dom.autoPlayChk.addEventListener('change', (e) => { state.autoPlay = e.target.checked; });
  // Note-name vs fret-number labels: just a re-draw, no re-capture.
  if (dom.noteNameChk) dom.noteNameChk.addEventListener('change', (e) => { state.showNoteName = e.target.checked; if (state.steps.length) render(); });
  if (dom.resetBtn) dom.resetBtn.addEventListener('click', reset);
  if (dom.fullscreenBtn) {
    dom.fullscreenBtn.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', () => {
      dom.fullscreenBtn.textContent = document.fullscreenElement === dom.panel ? 'Exit fullscreen' : '⛶ Fullscreen';
    });
  }
  if (dom.pathSelect) dom.pathSelect.addEventListener('change', (e) => {
    state.activeSource = 'path'; state.selectedPathIdx = parseInt(e.target.value, 10) || 0; state.overrides = new Map(); render();
  });
  if (dom.comboSelect) dom.comboSelect.addEventListener('change', (e) => {
    state.activeSource = 'combo'; state.selectedComboIdx = parseInt(e.target.value, 10) || 0; state.overrides = new Map(); render();
  });
  if (dom.prevBtn) dom.prevBtn.addEventListener('click', () => { stopPlay(); step(-1); });
  if (dom.nextBtn) dom.nextBtn.addEventListener('click', () => { stopPlay(); step(+1); });
  if (dom.playStepBtn) dom.playStepBtn.addEventListener('click', playStep);
  if (dom.playBtn) dom.playBtn.addEventListener('click', play);
  if (dom.speed) dom.speed.addEventListener('input', (e) => { state.speedMs = 1600 - parseInt(e.target.value, 10); });
  if (dom.shapePrev) dom.shapePrev.addEventListener('click', () => cycleShape(-1));
  if (dom.shapeNext) dom.shapeNext.addEventListener('click', () => cycleShape(+1));
  if (dom.panel) dom.panel.addEventListener('toggle', () => {
    if (!dom.panel.open) {
      stopPlay();
      if (renderer.clearStepHighlight) renderer.clearStepHighlight();
      if (state.stepRenderer && state.stepRenderer.hideCursor) state.stepRenderer.hideCursor();   // stop tracking the sheet cursor
    }
    else if (state.steps.length) render();   // re-apply the step band + cursor when re-opened
    else capture();                          // first open (nothing captured yet) → capture current source
  });

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

  // Switch the capture source ('guessed'|'window'|'matched'|'phrases') from outside (e.g. the page
  // auto-selects 'matched' when tag filtering engages, 'phrases' when the Phrases panel opens).
  // Reflects the chip state and, when the panel is open, captures immediately (matching the click
  // behavior). When collapsed it only points the source — the first open then captures it.
  function setSource(name) {
    if (!name || name === state.source) return;
    state.source = name;
    reflectSource();
    if (dom.panel && dom.panel.open) capture();
  }

  return { capture, captureSteps, reset, setSource, _state: state }; // _state exposed for debugging only
}
