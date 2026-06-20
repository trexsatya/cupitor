# Music Study App — M2.2 (Segment Loop/Stop, Voice Colors, Note-Name Toggle) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make MIDI playback stop and loop exactly at the segment boundary, color each voice distinctly in the OSMD sheet, and add a toggle that labels notes with their English/scientific names.

**Architecture:** Three small pure functions (TDD) plus thin browser glue, matching the existing music-study-app pattern. Feature A fixes `createMusicPlayer` (Tone.Transport reset + a one-shot boundary stop + explicit loop bounds). Features B/C extend `createMusicRenderer` with a shared `redraw()` that pushes per-voice `NoteheadColor` onto the OSMD model and overlays note-name `<text>` on the rendered SVG. Two checkboxes in `music.html` drive B/C.

**Tech Stack:** Vanilla ES modules, Tone.js (vendored UMD), OpenSheetMusicDisplay (vendored), Jest + jsdom. No new dependencies.

**Conventions:** Tests are lean — pure functions are unit-tested; Tone/OSMD/DOM glue is `node --check` + manual. Run a single test file with `npx jest public/<file>.test.js`. The pre-existing failure in `public/music_search.test.js` ("9. Too large jump") is unrelated and also fails on master — ignore it.

---

### Task 1: Feature A — segment stop & loop (`scheduleEnd` + player fix)

**Files:**
- Modify: `public/music-player.js` (add pure `scheduleEnd`; rework `createMusicPlayer`)
- Test: `public/music-player.test.js`

- [ ] **Step 1: Write the failing test**

Add to `public/music-player.test.js` (after the existing `buildSchedule` tests, before the file end):

```js
import { scheduleEnd } from './music-player.js';

describe('scheduleEnd', () => {
  test('end = last event time + duration', () => {
    expect(scheduleEnd([
      { midi: 60, time: 0,   duration: 0.5 },
      { midi: 62, time: 0.5, duration: 0.25 },
    ])).toBe(0.75);
  });
  test('empty / nullish schedule → 0', () => {
    expect(scheduleEnd([])).toBe(0);
    expect(scheduleEnd(null)).toBe(0);
    expect(scheduleEnd(undefined)).toBe(0);
  });
});
```

Note: `music-player.test.js` already has one `import { ... } from './music-player.js'` line — you may either add a second import line as shown or append `scheduleEnd` to the existing import. Either is fine.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest public/music-player.test.js -t scheduleEnd`
Expected: FAIL — `scheduleEnd is not a function` (or `is not exported`).

- [ ] **Step 3: Add the pure `scheduleEnd` function**

In `public/music-player.js`, add this immediately after `buildSchedule` (after its closing `}` near line 36):

```js
// Pure: end time (seconds) of a buildSchedule() result — last event's end, or 0 if empty.
export function scheduleEnd(schedule) {
  if (!schedule || !schedule.length) return 0;
  const last = schedule[schedule.length - 1];
  return Number(((last.time || 0) + (last.duration || 0)).toFixed(6));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest public/music-player.test.js -t scheduleEnd`
Expected: PASS (2 tests).

- [ ] **Step 5: Rework `createMusicPlayer` for reset + boundary stop + loop bounds**

In `public/music-player.js`, replace the body of `createMusicPlayer` from `let synth = makeVoice('synth');` through the final `};` of the returned object. The `makeVoice` factory and the leading `const T = ...; if (!T) ...` lines stay unchanged. Replace with:

```js
  let synth = makeVoice('synth');
  let part = null;
  let schedule = [];
  let loop = false;
  let stopId = null;   // Tone.Transport.scheduleOnce id for the boundary stop

  function disposePart() { if (part) { part.stop(); part.dispose(); part = null; } }
  function clearStopTimer() {
    if (stopId !== null) { try { T.Transport.clear(stopId); } catch (_) {} stopId = null; }
  }

  function buildPart() {
    disposePart();
    const cursor = getCursor && getCursor();
    if (cursor) { try { cursor.reset(); cursor.show(); } catch (_) {} }
    part = new T.Part((time, ev) => {
      synth.triggerAttackRelease(T.Frequency(ev.midi, 'midi').toNote(), ev.duration, time);
      if (cursor) T.Draw.schedule(() => { try { cursor.next(); } catch (_) {} }, time);
    }, schedule.map(e => [e.time, e]));
    part.loop = loop;
    part.loopStart = 0;
    part.loopEnd = scheduleEnd(schedule);
    return part;
  }

  function stop() {
    clearStopTimer();
    T.Transport.stop();
    if (part) part.stop();
    const c = getCursor && getCursor();
    if (c) { try { c.reset(); c.hide(); } catch (_) {} }
  }

  return {
    setSchedule(s) { schedule = s || []; buildPart(); },
    setLoop(on) { loop = !!on; if (part) part.loop = loop; },
    setInstrument(category) {
      const next = makeVoice(category);
      if (synth && synth.dispose) synth.dispose();
      synth = next;   // the Part callback closes over `synth`, so the new voice is used immediately
    },
    async play() {
      await T.start();
      if (!part) buildPart();
      clearStopTimer();
      T.Transport.stop();   // reset position to 0 so part.start(0)'s events are in the future
      T.Transport.start();
      part.start(0);
      if (!loop) {
        const end = scheduleEnd(schedule);
        if (end > 0) stopId = T.Transport.scheduleOnce(() => stop(), end);
      }
    },
    pause() { T.Transport.pause(); },
    stop,
  };
```

Why each change: resetting the Transport (`T.Transport.stop()` before `start()`) fixes replay/loop — without it `Transport.position` has already passed the segment, so `part.start(0)`'s events never fire. The `scheduleOnce(stop, end)` makes non-looping playback halt and reset the cursor exactly at the segment end. Explicit `loopStart=0`/`loopEnd=scheduleEnd` plus the stored `loop` flag make looping bound to the segment regardless of `setSchedule`/`setLoop` call order.

- [ ] **Step 6: Syntax-check the module**

Run: `node --check public/music-player.js`
Expected: no output (exit 0).

- [ ] **Step 7: Run the full player test file (no regressions)**

Run: `npx jest public/music-player.test.js`
Expected: PASS (all existing `buildSchedule`/`parseYouTubeId`/`instrumentVoiceKey` tests + the new `scheduleEnd` tests).

- [ ] **Step 8: Commit**

```bash
git add public/music-player.js public/music-player.test.js
git commit -m "feat(music): MIDI stops and loops at the segment boundary (M2.2 A)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Feature B — per-voice notehead colors (`voiceColor` + renderer `redraw`/`setVoiceColors`)

**Files:**
- Modify: `public/music-render.js` (add pure `voiceColor`; add `redraw()`, `applyVoiceColors()`, `setVoiceColors()` to `createMusicRenderer`)
- Test: `public/music-render.test.js`

- [ ] **Step 1: Write the failing tests**

Add to `public/music-render.test.js` (append at end of file):

```js
import { voiceColor } from './music-render.js';

describe('voiceColor', () => {
  test('distinct, stable colors for the first voices', () => {
    expect(typeof voiceColor(0)).toBe('string');
    expect(voiceColor(0)).not.toBe(voiceColor(1));
    expect(voiceColor(0)).toBe(voiceColor(0));
  });
  test('cycles past the palette length', () => {
    expect(voiceColor(6)).toBe(voiceColor(0));
    expect(voiceColor(-1)).toBe(voiceColor(5));
  });
});

describe('createMusicRenderer voice colors', () => {
  test('setVoiceColors re-renders and does not throw on a sheet without instruments', () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    const before = osmd.calls.filter(c => c[0] === 'render').length;
    r.setVoiceColors(true);
    expect(osmd.calls.filter(c => c[0] === 'render').length).toBe(before + 1);
  });
});
```

(The `fakeOsmd` helper and `createMusicRenderer` import already exist in this test file.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest public/music-render.test.js -t "voiceColor|voice colors"`
Expected: FAIL — `voiceColor is not a function` and `r.setVoiceColors is not a function`.

- [ ] **Step 3: Add the pure `voiceColor` + palette/default constants**

In `public/music-render.js`, add after the `clamp` definition (near line 6):

```js
// Readable, deterministic palette for coloring voices in the rendered sheet.
const VOICE_COLORS = ['#1f77b4', '#d62728', '#2ca02c', '#9467bd', '#ff7f0e', '#17becf'];
const DEFAULT_NOTE_COLOR = '#000000';
// Pure: a stable color for a 0-based voice index, cycling past the palette length.
export function voiceColor(index) {
  const n = VOICE_COLORS.length;
  const i = (((index | 0) % n) + n) % n;
  return VOICE_COLORS[i];
}
```

- [ ] **Step 4: Add `applyVoiceColors`, `redraw`, and `setVoiceColors` to `createMusicRenderer`**

In `public/music-render.js`, inside `createMusicRenderer`, change the state declarations and the `setZoom` helper. Replace:

```js
  let totalMeasures = 0;

  function setZoom(factor) { osmd.Zoom = factor; osmd.render(); }
```

with:

```js
  let totalMeasures = 0;
  let colorVoices = false;

  // Push per-voice NoteheadColor onto the OSMD model so it survives re-renders.
  // No-op on a sheet without instruments (e.g. the test fake / before load).
  function applyVoiceColors() {
    const instruments = osmd.Sheet && osmd.Sheet.Instruments;
    if (!instruments || !instruments.forEach) return;
    let vi = 0;
    instruments.forEach((instr) => {
      (instr.Voices || []).forEach((voice) => {
        const color = colorVoices ? voiceColor(vi) : DEFAULT_NOTE_COLOR;
        (voice.VoiceEntries || []).forEach((ve) => {
          (ve.Notes || []).forEach((note) => { note.NoteheadColor = color; });
        });
        vi++;
      });
    });
  }

  // One render pass: apply model colors, render, then (re)build overlays.
  function redraw() {
    applyVoiceColors();
    osmd.render();
  }

  function setZoom(factor) { osmd.Zoom = factor; redraw(); }
```

Then route the existing render calls through `redraw()`. In the returned object:
- In `loadDetail`, replace `osmd.render();` with `redraw();`.
- In `showFull`, replace `osmd.render();` with `redraw();`.
- In `showSegment`, replace `osmd.render();` with `redraw();`.

And add a `setVoiceColors` method to the returned object (e.g. right after `setZoom,`):

```js
    setVoiceColors(on) { colorVoices = !!on; redraw(); },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest public/music-render.test.js -t "voiceColor|voice colors"`
Expected: PASS.

- [ ] **Step 6: Run the full render test file + syntax check (no regressions)**

Run: `npx jest public/music-render.test.js`
Expected: PASS (existing `createMusicRenderer` tests — `loadDetail`, `showFull`, `showSegment`, `setZoom` — still green, because `redraw()` still calls `osmd.render()` and `applyVoiceColors` is a no-op on the fake).

Run: `node --check public/music-render.js`
Expected: no output (exit 0).

- [ ] **Step 7: Commit**

```bash
git add public/music-render.js public/music-render.test.js
git commit -m "feat(music): color each voice distinctly in the OSMD sheet (M2.2 B)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Feature C — note-name overlay (`noteName` + renderer `setNoteNames`)

**Files:**
- Modify: `public/music-render.js` (add pure `noteName`; add `applyNoteNames()` + `setNoteNames()`, wire into `redraw()`)
- Test: `public/music-render.test.js`

- [ ] **Step 1: Write the failing tests**

Append to `public/music-render.test.js`:

```js
import { noteName } from './music-render.js';

describe('noteName', () => {
  test('middle C (MIDI 60) → C4', () => { expect(noteName(60)).toBe('C4'); });
  test('sharps and octave boundaries', () => {
    expect(noteName(61)).toBe('C#4');
    expect(noteName(69)).toBe('A4');
    expect(noteName(72)).toBe('C5');
    expect(noteName(48)).toBe('C3');
  });
  test('null / NaN → empty string', () => {
    expect(noteName(null)).toBe('');
    expect(noteName(undefined)).toBe('');
    expect(noteName(NaN)).toBe('');
  });
});

describe('createMusicRenderer note names', () => {
  test('setNoteNames re-renders and does not throw without a rendered graphic', () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    const before = osmd.calls.filter(c => c[0] === 'render').length;
    r.setNoteNames(true);
    expect(osmd.calls.filter(c => c[0] === 'render').length).toBe(before + 1);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx jest public/music-render.test.js -t "noteName|note names"`
Expected: FAIL — `noteName is not a function` and `r.setNoteNames is not a function`.

- [ ] **Step 3: Add the pure `noteName` function + namespace const**

In `public/music-render.js`, add after the `voiceColor` definition from Task 2:

```js
const SVG_NS = 'http://www.w3.org/2000/svg';
const PITCH_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
// Pure: MIDI number → English/scientific note name with sharps, e.g. 60 → 'C4'. '' for null/NaN.
export function noteName(midi) {
  if (midi == null || !Number.isFinite(midi)) return '';
  const m = Math.round(midi);
  const pc = ((m % 12) + 12) % 12;
  const octave = Math.floor(m / 12) - 1;
  return PITCH_NAMES[pc] + octave;
}
```

- [ ] **Step 4: Add `applyNoteNames`, the `noteNames` flag, the `setNoteNames` method, and wire into `redraw()`**

In `public/music-render.js`, inside `createMusicRenderer`:

(a) Add the flag next to `let colorVoices = false;`:

```js
  let noteNames = false;
```

(b) Add `applyNoteNames` immediately after `applyVoiceColors` (before `redraw`):

```js
  // Overlay English/scientific note names on the rendered SVG. Removed + rebuilt on every
  // render. No-op when there's no DOM container / rendered graphic (test fakes, jsdom).
  // OSMD's Pitch.getHalfTone() + 12 is the MIDI number (C4 → 48 + 12 = 60).
  function applyNoteNames() {
    if (!container || !container.querySelectorAll) return;
    container.querySelectorAll('.note-name-layer').forEach((n) => n.remove());
    if (!noteNames) return;
    const measureList = osmd.graphic && osmd.graphic.measureList;
    const svg = container.querySelector('svg');
    if (!measureList || !measureList.forEach || !svg) return;
    const layer = document.createElementNS(SVG_NS, 'g');
    layer.setAttribute('class', 'note-name-layer');
    measureList.forEach((measures) => {
      (measures || []).forEach((measure) => {
        ((measure && measure.staffEntries) || []).forEach((se) => {
          (se.graphicalVoiceEntries || []).forEach((gve) => {
            (gve.notes || []).forEach((gnote) => {
              const pitch = gnote.sourceNote && gnote.sourceNote.Pitch;
              if (!pitch || typeof pitch.getHalfTone !== 'function') return; // rest / no pitch
              const label = noteName(pitch.getHalfTone() + 12);
              if (!label) return;
              const vf = gnote.vfnote;
              const el = vf && vf[0] && vf[0].attrs && vf[0].attrs.el;
              if (!el || !el.querySelectorAll) return;
              const heads = el.querySelectorAll('.vf-notehead');
              const head = heads[gnote.vfnoteIndex || 0] || heads[0];
              if (!head || !head.getBBox) return;
              const b = head.getBBox();
              const t = document.createElementNS(SVG_NS, 'text');
              t.setAttribute('x', b.x + b.width / 2);
              t.setAttribute('y', b.y - 2);
              t.setAttribute('text-anchor', 'middle');
              t.setAttribute('font-size', '7');
              t.setAttribute('fill', '#444');
              t.textContent = label;
              layer.appendChild(t);
            });
          });
        });
      });
    });
    svg.appendChild(layer);
  }
```

(c) Wire it into `redraw()` — change:

```js
  function redraw() {
    applyVoiceColors();
    osmd.render();
  }
```

to:

```js
  function redraw() {
    applyVoiceColors();
    osmd.render();
    applyNoteNames();
  }
```

(d) Add the method to the returned object, right after `setVoiceColors`:

```js
    setNoteNames(on) { noteNames = !!on; redraw(); },
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx jest public/music-render.test.js -t "noteName|note names"`
Expected: PASS.

- [ ] **Step 6: Run the full render test file + syntax check (no regressions)**

Run: `npx jest public/music-render.test.js`
Expected: PASS (all `createMusicRenderer` tests green — `applyNoteNames` is a no-op when `container.querySelectorAll`/`osmd.graphic` are absent, which is the case for the `{}` container + fake osmd).

Run: `node --check public/music-render.js`
Expected: no output (exit 0).

- [ ] **Step 7: Commit**

```bash
git add public/music-render.js public/music-render.test.js
git commit -m "feat(music): toggle English/scientific note names on the sheet (M2.2 C)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Wire the two view toggles into `music.html`

**Files:**
- Modify: `public/music.html` (add the checkboxes + `onchange` handlers)

- [ ] **Step 1: Add the view-options row to the preview pane markup**

In `public/music.html`, find the line:

```html
  <div id="osmdPreview"></div>
```

Insert immediately **before** it:

```html
  <div id="viewOptions" style="margin:.25rem 0">
    <label><input type="checkbox" id="voiceColorChk"> Color voices</label>
    <label><input type="checkbox" id="noteNameChk"> Note names</label>
  </div>
```

- [ ] **Step 2: Add the `onchange` handlers**

In `public/music.html`, find the handler line:

```js
  document.getElementById('previewFullBtn').onclick = () => renderer && renderer.showFull();
```

Insert immediately **after** it:

```js
  document.getElementById('voiceColorChk').onchange = (e) => { if (renderer) renderer.setVoiceColors(e.target.checked); };
  document.getElementById('noteNameChk').onchange = (e) => { if (renderer) renderer.setNoteNames(e.target.checked); };
```

(`renderer` is the module-level `let renderer = null;` near line 352; the renderer persists across previews, so the toggles' checked state and effect carry over when opening another piece.)

- [ ] **Step 3: Verify the inline module still parses and the new ids resolve**

Run (extracts the inline ES module and syntax-checks it):

```bash
cd public && node -e "const fs=require('fs');const h=fs.readFileSync('music.html','utf8');const m=h.match(/<script type=\"module\">([\s\S]*?)<\/script>/);require('fs').writeFileSync('/tmp/music-mod.mjs',m[1]);" && node --check /tmp/music-mod.mjs && echo OK
```

Expected: `OK` (the inline module parses).

Run (confirm each referenced id now exists as an element):

```bash
cd public && for id in voiceColorChk noteNameChk; do grep -q "id=\"$id\"" music.html && echo "$id: present" || echo "$id: MISSING"; done
```

Expected: both `present`.

- [ ] **Step 4: Commit**

```bash
git add public/music.html
git commit -m "feat(music): add Color voices / Note names toggles to the preview pane (M2.2)

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Full-suite regression check

**Files:** none (verification only)

- [ ] **Step 1: Run the whole Jest suite**

Run: `npx jest public`
Expected: all tests pass **except** the single pre-existing `public/music_search.test.js` "9. Too large jump → should fail" (fails on master too — not in scope). Confirm no *new* failures and that the new `scheduleEnd`, `voiceColor`, `noteName`, `setVoiceColors`, `setNoteNames` tests are green.

- [ ] **Step 2: Report manual-verification checklist (browser)**

These cannot run under jsdom; list them for the human to verify in `music.html`:
- A: play a segment → MIDI stops at the segment end; check **Loop segment** → it repeats the segment cleanly; replay after a finished play works (no dead Play button).
- B: open a multi-voice piece → **Color voices** tints each voice differently; unchecking restores black; colors persist switching Full ↔ segment and on zoom.
- C: **Note names** labels each note (`C4`, `F#5`, …); unchecking removes all labels; labels reposition after a segment change / zoom; rests are unlabeled.

---

## Self-Review

**1. Spec coverage:**
- Feature A (stop & loop, `scheduleEnd`, Transport reset, one-shot boundary stop, explicit loop bounds, stored loop flag) → Task 1. ✓
- Feature B (`voiceColor` pure, `setVoiceColors`, `applyVoiceColors` via `NoteheadColor`, reapply on every render, UI checkbox) → Task 2 (logic) + Task 4 (UI). ✓
- Feature C (`noteName` pure English/scientific, `setNoteNames`, SVG overlay layer removed/rebuilt per render, skip rests, UI checkbox) → Task 3 (logic) + Task 4 (UI). ✓
- Testing split (pure TDD + glue node --check/manual) → each task's steps + Task 5. ✓
- Out-of-scope items (sargam, pitch-class coloring, stem coloring, loop counts) → not implemented. ✓

**2. Placeholder scan:** No TBD/TODO/"handle edge cases"; every code step shows complete code. ✓

**3. Type/name consistency:** `redraw()` introduced in Task 2 and extended (not renamed) in Task 3; `applyVoiceColors`/`applyNoteNames`/`setVoiceColors`/`setNoteNames`/`colorVoices`/`noteNames`/`voiceColor`/`noteName`/`scheduleEnd`/`DEFAULT_NOTE_COLOR`/`VOICE_COLORS`/`PITCH_NAMES`/`SVG_NS` used consistently across tasks. Checkbox ids `voiceColorChk`/`noteNameChk` match between Task 4 markup and handlers. ✓
