// public/music-rhythm.js
//
// Rhythm-pattern discovery: pitch-blind sibling of music-pattern.js. Where the tag/motif search asks
// "where else does THIS melody happen?", this asks "which rhythms does the piece use, and where?" —
// nothing is tagged first, the patterns are read off the score.
//
// A rhythm is the sequence of note lengths in reading order plus the holes between them, so
// "♩ ♩ 𝅗𝅥" and "♩ 𝄾 ♩ 𝅗𝅥" are different patterns. Two units of grouping:
//   • 'bar'  — one pattern per distinct bar rhythm (the way a player reads a piece: "bars 1, 3 and 7
//              share a rhythm"). Every bar is listed, most frequent first.
//   • 'cell' — repeating figures ONE TO (bar − 1) BEATS long, each starting on a beat of its own bar.
//              Spans are counted in the meter's real beats, so in 6/8 (beat = dotted quarter) three
//              eighths are one beat-cell, while in 3/4 they are a beat and a half and never form one.
//              A cell may straddle a bar line; whole-bar rhythms are unit 'bar's job, not a cell's.
//
// Chords collapse to ONE rhythmic event (a 3-note chord is one attack), but the event keeps every
// notehead's stream index so the caller can highlight the whole chord. Voices are scanned separately —
// a rhythm belongs to a line, not to the page.
//
// No DOM: takes the renderer's note stream (arrays of {measure, onset, durBeats, midi, voice} plus,
// for cells, the note's meter: barBeat = its bar's downbeat, beatBeats = one beat, barBeats = one
// bar) and returns plain data. Durations and onsets are in quarter-beats.

const EPS = 1e-6;
// Meter assumed when the stream carries none: quarter-note beats in a 4/4 bar.
const DEFAULT_BEAT = 1;
const DEFAULT_BAR = 4;

// Note-length letters, longest first: whole, half, quarter, eighth, 16th, 32nd, 64th.
const BASE_DURS = [[4, 'w'], [2, 'h'], [1, 'q'], [0.5, 'e'], [0.25, 's'], [0.125, 't'], [0.0625, 'x']];

const fmt = (d) => String(Math.round(d * 1000) / 1000);

// Letter name of one duration in quarter-beats: 'q', dotted 'q.', double-dotted 'q..', triplet 'q³'.
// Unmetered values (tuplets other than triplets, tied oddities) fall back to the number.
export function durName(d) {
  if (d == null || !Number.isFinite(d)) return '?';
  for (const [v, n] of BASE_DURS) {
    if (Math.abs(d - v) < EPS) return n;
    if (Math.abs(d - v * 1.5) < EPS) return `${n}.`;
    if (Math.abs(d - v * 1.75) < EPS) return `${n}..`;
    if (Math.abs(d - v * (2 / 3)) < EPS) return `${n}³`;
  }
  return fmt(d);
}

// Rhythm of a run of events as tokens: {t:'n',d} for a note of length d, {t:'r',d} for a hole of d
// beats between two notes. `proportional` divides everything by the first note's length, making the
// rhythm scale-invariant (a bar at half speed reads as the same pattern).
export function rhythmTokens(events, { proportional = false } = {}) {
  const evs = (events || []).filter((e) => e && e.dur != null && e.onset != null);
  if (!evs.length) return [];
  const unit = proportional ? (evs[0].dur || 1) : 1;
  const out = [];
  evs.forEach((e, i) => {
    if (i > 0) {
      const prev = evs[i - 1];
      const gap = e.onset - (prev.onset + prev.dur);
      if (gap > EPS) out.push({ t: 'r', d: gap / unit });
    }
    out.push({ t: 'n', d: e.dur / unit });
  });
  return out;
}

// Canonical string identity of a token list — equal keys mean the same rhythm. Rests prefixed 'r'.
export function tokensKey(tokens) {
  return (tokens || []).map((tk) => (tk.t === 'r' ? 'r' : '') + fmt(tk.d)).join(' ');
}

// Canonical string identity of a rhythm — equal keys mean the same rhythm.
export function rhythmKey(events, opts = {}) {
  return tokensKey(rhythmTokens(events, opts));
}

// Human-readable rhythm: letter names, rests in parentheses ('q q (e) e'). Proportional rhythms have
// no note names (they are ratios), so they read as numbers ('1 1 2').
export function rhythmLabel(tokens, { proportional = false } = {}) {
  return (tokens || []).map((tk) => {
    const name = proportional ? fmt(tk.d) : durName(tk.d);
    return tk.t === 'r' ? `(${name})` : name;
  }).join(' ');
}

// The stream reduced to rhythmic events, per voice: Map voice → [{onset, dur, measure, noteIdx, top}]
// ascending by onset. Notes sharing an onset (a chord) become ONE event whose length is the top note's
// (the line a reader follows), with noteIdx listing every notehead so callers can paint the chord.
export function voiceEvents(stream) {
  const byVoice = new Map();
  (stream || []).forEach((n, i) => {
    if (!n || n.durBeats == null || n.onset == null) return;
    const v = n.voice == null ? 0 : n.voice;
    if (!byVoice.has(v)) byVoice.set(v, new Map());
    const byOnset = byVoice.get(v);
    const cur = byOnset.get(n.onset);
    if (!cur) {
      byOnset.set(n.onset, { onset: n.onset, dur: n.durBeats, measure: n.measure, top: n.midi, noteIdx: [i],
        barBeat: n.barBeat, beatBeats: n.beatBeats, barBeats: n.barBeats });
      return;
    }
    cur.noteIdx.push(i);
    if (n.midi != null && (cur.top == null || n.midi > cur.top)) { cur.top = n.midi; cur.dur = n.durBeats; }
  });
  const out = new Map();
  [...byVoice.keys()].sort((a, b) => a - b)
    .forEach((v) => out.set(v, [...byVoice.get(v).values()].sort((a, b) => a.onset - b.onset)));
  return out;
}

// One entry per (voice, measure) that has notes: {voice, measure, events} in voice → measure order.
export function barRhythms(stream) {
  const out = [];
  voiceEvents(stream).forEach((events, voice) => {
    const byMeasure = new Map();
    events.forEach((e) => {
      const k = e.measure == null ? -1 : e.measure;
      if (!byMeasure.has(k)) byMeasure.set(k, []);
      byMeasure.get(k).push(e);
    });
    [...byMeasure.keys()].sort((a, b) => a - b).forEach((m) => out.push({ voice, measure: m, events: byMeasure.get(m) }));
  });
  return out;
}

// Stream indices to SILENCE so that only `pattern` sounds — every note that is not part of it. The
// piece then plays with its own timing, the pattern landing where it lands and the rest silent, which
// is what keeps the audio in step with the sheet (splicing the occurrences together instead would
// rewrite the timeline). One index per (midi, onset) identity, because that is how the player matches
// a note: a pattern note doubled at the unison in another voice must not be silenced by its twin.
export function soloMutedIndices(stream, pattern) {
  const sounding = new Set();
  const idOf = (n) => `${n.midi}@${n.onset}`;
  ((pattern && pattern.occurrences) || []).forEach((o) => (o.noteIdx || []).forEach((i) => {
    if (stream[i]) sounding.add(idOf(stream[i]));
  }));
  const out = [];
  const listed = new Set();
  (stream || []).forEach((n, i) => {
    if (!n || n.midi == null) return;
    const id = idOf(n);
    if (sounding.has(id) || listed.has(id)) return;
    listed.add(id);
    out.push(i);
  });
  return out;
}

// One occurrence of a pattern, as the caller needs it for highlighting + a measure label.
function occurrenceOf(voice, events) {
  const ms = events.map((e) => e.measure).filter((m) => m != null);
  return {
    voice,
    measures: ms.length ? [Math.min(...ms), Math.max(...ms)] : null,
    onsets: [events[0].onset, events[events.length - 1].onset],
    noteIdx: events.flatMap((e) => e.noteIdx),
  };
}

// Keep occurrences that don't overlap an already-kept one (left to right, per voice). Without this a
// run of six quarters would report "♩ ♩" five times instead of three.
function nonOverlapping(occ) {
  const lastEnd = new Map();
  return occ.slice().sort((a, b) => (a.voice - b.voice) || (a.s - b.s)).filter((o) => {
    const prev = lastEnd.has(o.voice) ? lastEnd.get(o.voice) : -Infinity;
    if (o.s <= prev) return false;
    lastEnd.set(o.voice, o.e);
    return true;
  });
}

// Tokens of a cell: the events' rhythm, plus a trailing rest when they stop short of the cell's end.
// The tokens therefore always account for the WHOLE span, which keeps a beat of "♪ ♪ 𝄾" distinct from
// a beat of "♪ ♪" and makes the key alone say how long the cell is.
function cellTokens(events, spanEnd, opts) {
  const tokens = rhythmTokens(events, opts);
  const last = events[events.length - 1];
  const tail = spanEnd - (last.onset + last.dur);
  if (tail > EPS) tokens.push({ t: 'r', d: tail / (opts.proportional ? (events[0].dur || 1) : 1) });
  return tokens;
}

// Repeating cells. For every event that falls ON a beat of its own bar, take the windows spanning
// 1..(beats per bar − 1) beats and group equal rhythms; keep those recurring `minCount` times.
// Spans are measured in the meter's beats, so the candidates are the figures a player counts —
// and nothing longer than a bar, which is what unit 'bar' lists.
function cellPatterns(byVoice, { minCount, proportional, maxBeats }) {
  const groups = new Map();
  byVoice.forEach((events, voice) => {
    events.forEach((first, s) => {
      const beat = first.beatBeats || DEFAULT_BEAT;
      const bar = first.barBeats || DEFAULT_BAR;
      const beatsIn = (first.onset - (first.barBeat || 0)) / beat;
      if (Math.abs(beatsIn - Math.round(beatsIn)) > EPS) return;   // must start on a beat, not between
      const perBar = Math.max(1, Math.round(bar / beat));
      const kMax = maxBeats != null ? maxBeats : Math.max(1, perBar - 1);
      for (let k = 1; k <= kMax; k++) {
        const spanEnd = first.onset + k * beat;
        const win = [];
        for (let j = s; j < events.length && events[j].onset < spanEnd - EPS; j++) win.push(events[j]);
        if (win.length < 2) continue;                              // one attack is not a rhythm
        const tokens = cellTokens(win, spanEnd, { proportional });
        const key = tokensKey(tokens);
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push({ voice, s, e: s + win.length - 1, events: win, tokens });
      }
    });
  });
  const kept = [];
  groups.forEach((all, key) => {
    const occ = nonOverlapping(all);
    if (occ.length < minCount) return;
    kept.push({ key, len: occ[0].events.length, tokens: occ[0].tokens, occ });
  });
  return kept;
}

// Distinct bar rhythms, grouped by identity across voices and measures.
function barPatterns(stream, { minCount, proportional }) {
  const groups = new Map();
  barRhythms(stream).forEach(({ voice, measure, events }) => {
    const tokens = rhythmTokens(events, { proportional });
    const key = tokensKey(tokens);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push({ voice, measure, s: events[0].onset, e: events[events.length - 1].onset, events, tokens });
  });
  const kept = [];
  groups.forEach((occ, key) => {
    if (occ.length < minCount) return;
    kept.push({ key, len: occ[0].events.length, tokens: occ[0].tokens, occ });
  });
  return kept;
}

// The piece's rhythm patterns, most frequent first — the list a picker shows.
//
// `stream`: rendered notes in reading order, {measure, onset, durBeats, midi, voice}. Only what is in
// the stream is scanned, so passing a segment's notes yields that segment's rhythms.
// `unit`: 'bar' (default) one pattern per distinct bar rhythm · 'cell' repeating cells (min 2 hits).
// `proportional`: match rhythms by their proportions, so augmentation/diminution counts as the same.
// `maxBeats` (cells only): longest cell in beats; defaults to one beat short of a bar.
//
// Returns [{ id, unit, key, label, len, count, measures, occurrences: [{voice, measures, onsets,
// noteIdx}] }]. `id` is derived from the rhythm itself, so it survives a rescan and can be a <select>
// value; `noteIdx` indexes back into `stream` for highlighting.
export function findRhythmPatterns(stream, opts = {}) {
  const { unit = 'bar', proportional = false, maxBeats } = opts;
  const minCount = opts.minCount != null ? opts.minCount : (unit === 'cell' ? 2 : 1);
  if (!stream || !stream.length) return [];
  const kept = unit === 'cell'
    ? cellPatterns(voiceEvents(stream), { minCount, proportional, maxBeats })
    : barPatterns(stream, { minCount, proportional });
  return kept.map((p) => {
    const occurrences = p.occ
      .map((o) => occurrenceOf(o.voice, o.events))
      .sort((a, b) => a.onsets[0] - b.onsets[0]);
    const measures = [...new Set(occurrences.map((o) => (o.measures ? o.measures[0] : null)).filter((m) => m != null))]
      .sort((a, b) => a - b);
    return {
      id: `${unit}:${p.key}`, unit, key: p.key, len: p.len,
      label: rhythmLabel(p.tokens, { proportional }),
      count: occurrences.length, measures, occurrences,
    };
  }).sort((a, b) => (b.count - a.count) || (b.len - a.len) || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0));
}
