// public/music-metronome.js
//
// A self-contained metronome: a steady click at a given BPM with an accented downbeat every
// `beatsPerMeasure` beats. It uses the classic "lookahead scheduler" (a coarse setInterval that
// schedules precise click sounds AHEAD of time on Tone's audio clock), so the beat doesn't drift with
// JavaScript timer jitter. It's independent of the piece player's Transport — it just ticks — so it can
// run standalone for practice and be re-phased to align with playback when the piece starts.
//
// Browser glue (Tone + setInterval) isn't unit-tested; the beat/accent math is the pure ticksInWindow()
// below, which is.

// Pure: the clicks that fall in [nextTime, windowEnd). Returns those ticks plus the advanced
// (nextTime, beat) to carry into the next call. Beat 0 is an accented downbeat; the accent then repeats
// every `beatsPerMeasure` beats. `bpm`/`beatsPerMeasure` fall back to sane defaults when non-positive.
export function ticksInWindow(nextTime, windowEnd, beat, bpm, beatsPerMeasure) {
  const spb = 60 / (bpm > 0 ? bpm : 90);          // seconds per beat (quarter-note beats)
  const n = beatsPerMeasure > 0 ? Math.floor(beatsPerMeasure) : 4;
  const ticks = [];
  let t = nextTime, b = beat, guard = 0;
  while (t < windowEnd && guard++ < 1000) {
    ticks.push({ time: t, beat: b, accent: (((b % n) + n) % n) === 0 });
    b += 1; t += spb;
  }
  return { ticks, nextTime: t, beat: b };
}

// Pure: how to START the click so it ticks ON the beat grid with its accent on the piece's barlines.
// The click accents whenever its beat counter is 0 mod meter (see ticksInWindow) and the counter
// advances one per quarter-beat. Two independent corrections are needed:
//   1. Grid alignment — the first played note may be SYNCOPATED (onset at a fractional beat, e.g. 4.5),
//      so the first tick must wait the leftover fraction of a beat to land on a whole beat. Otherwise
//      every click sits off the beat and never coincides with a barline.
//   2. Downbeat phase — barline downbeats sit at absolute beats 0, N, 2N… only when there's no pickup;
//      a metric pickup (anacrusis) shifts them, so the phase is measured against the first FULL-measure
//      downbeat, not against absolute beat 0.
// Args:
//   startAbsBeat   — absolute quarter-beat of the first played note (from the schedule; may be fractional).
//   anacrusisBeats — absolute quarter-beat of the first full-measure downbeat (equals the meter when
//                    there's no pickup; its value mod the meter is the phase shared by every downbeat).
// Returns { phase, beatOffset }: phase = the counter value to seed the first tick with; beatOffset =
// beats (0..1) to wait before that first tick so it falls on the beat grid.
export function downbeatAlignment(startAbsBeat, anacrusisBeats, beatsPerMeasure) {
  const n = beatsPerMeasure > 0 ? Math.floor(beatsPerMeasure) : 4;
  const a = Math.round(anacrusisBeats || 0);
  const s = startAbsBeat || 0;
  const EPS = 1e-6;
  const floor = Math.floor(s + EPS);
  const aligned = (s - floor < EPS) ? floor : floor + 1;   // first whole beat at/after the start
  const beatOffset = Math.max(0, aligned - s);
  const phase = (((aligned - a) % n) + n) % n;
  return { phase, beatOffset };
}

// Browser metronome. opts.Tone defaults to the global (vendored UMD). Clicks are short square-wave
// blips: the downbeat is higher-pitched and louder than the other beats.
export function createMetronome({ Tone } = {}) {
  const T = Tone || (typeof globalThis !== 'undefined' ? globalThis.Tone : undefined);
  if (!T) throw new Error('Tone.js is not available');
  let bpm = 90, beatsPerMeasure = 4;
  let running = false, beat = 0, nextTime = 0, timer = null, click = null;
  const LOOKAHEAD = 0.12;   // seconds of audio scheduled ahead of the clock
  const TIMER_MS = 25;      // how often the (coarse) scheduler wakes
  const START_CUSHION = 0.02;   // tiny lead on the first tick so it isn't scheduled in the past

  function ensureClick() {
    if (click) return click;
    click = new T.Synth({
      oscillator: { type: 'square' },
      envelope: { attack: 0.001, decay: 0.03, sustain: 0, release: 0.01 },
    }).toDestination();
    return click;
  }
  // Schedule every click due within the lookahead window on the audio clock.
  function pump() {
    const c = ensureClick();
    const res = ticksInWindow(nextTime, T.now() + LOOKAHEAD, beat, bpm, beatsPerMeasure);
    res.ticks.forEach((tk) => {
      try { c.triggerAttackRelease(tk.accent ? 1760 : 1100, 0.03, tk.time, tk.accent ? 1 : 0.5); } catch (_) {}
    });
    nextTime = res.nextTime; beat = res.beat;
  }
  // (Re)start the grid with the beat counter at `startBeat` — the phase within the measure of the first
  // tick, so the accented downbeat lands on the piece's real barlines (0 = start on a downbeat).
  // `beatOffset` (beats, 0..1) delays the first tick onto the beat grid when playback starts on a
  // syncopated, off-beat note; 0/omitted ticks essentially now. See downbeatAlignment.
  function rephase(startBeat, beatOffset) {
    beat = Math.max(0, Math.floor(startBeat || 0));
    const spb = 60 / (bpm > 0 ? bpm : 90);
    const off = (typeof beatOffset === 'number' && beatOffset > 0) ? beatOffset : 0;
    // The click and the piece share one audio clock and this runs right as the Transport starts, so the
    // first tick's true time is now + beatOffset·spb. START_CUSHION is only a tiny guard against
    // scheduling in the past (kept small so the click doesn't sit audibly behind the notes).
    nextTime = T.now() + START_CUSHION + off * spb;
    if (running) pump();
  }

  return {
    setTempo(v) { if (v > 0) bpm = v; },
    setBeatsPerMeasure(n) { beatsPerMeasure = (n > 0) ? Math.floor(n) : 4; },
    isRunning() { return running; },
    start(startBeat, beatOffset) {
      // Resume the AudioContext (needs a user gesture) but DON'T await it — the scheduler must start
      // regardless, so it's already ticking when the context becomes audible.
      try { const r = T.start(); if (r && r.catch) r.catch(() => {}); } catch (_) {}
      running = true;
      rephase(startBeat, beatOffset);
      if (!timer) timer = setInterval(pump, TIMER_MS);
    },
    // Re-align to now with the given measure phase + grid offset (e.g. when playback starts). Starts it
    // if it was off.
    restart(startBeat, beatOffset) { if (!running) { this.start(startBeat, beatOffset); return; } rephase(startBeat, beatOffset); },
    stop() {
      running = false;
      if (timer) { clearInterval(timer); timer = null; }
    },
  };
}
