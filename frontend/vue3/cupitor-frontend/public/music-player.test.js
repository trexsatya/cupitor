// public/music-player.test.js
import { buildSchedule, NOTE_TYPE_BEATS, parseYouTubeId, instrumentVoiceKey, scheduleEnd, buildScheduleFromMusicXml, gmInstrumentForVoice, soundfontSampleMap, isSuppressed, compressKeptEvents } from './music-player.js';

// Primary voice = the one with the most notes. midi=pitch, duration=<type> string|null, measureIndex 1-based.
function voice(pitch, duration, measureIndex) {
  return [{ pitch, interval: [], sargam: [], duration, chordSymbol: [], lyric: [], measureIndex }];
}

describe('buildSchedule', () => {
  test('maps note types to cumulative times + durations at the given tempo', () => {
    // 120 BPM → 0.5s per quarter beat. quarter(1b)=0.5s, eighth(0.5b)=0.25s, half(2b)=1.0s
    const v = voice([60, 62, 64], ['quarter', 'eighth', 'half'], [1, 1, 1]);
    const s = buildSchedule(v, { tempo: 120 });
    expect(s).toEqual([
      { midi: 60, time: 0,    duration: 0.5 },
      { midi: 62, time: 0.5,  duration: 0.25 },
      { midi: 64, time: 0.75, duration: 1.0 },
    ]);
  });

  test('null/unknown durations default to a quarter beat (note-text pieces)', () => {
    const v = voice([60, 62], [null, 'bogus'], [1, 1]);
    const s = buildSchedule(v, { tempo: 60 }); // 1s per quarter
    expect(s).toEqual([
      { midi: 60, time: 0, duration: 1 },
      { midi: 62, time: 1, duration: 1 },
    ]);
  });

  test('segment filter keeps only notes in [fromMeasure,toMeasure] and re-zeros the start to 0', () => {
    const v = voice([60, 62, 64, 65], ['quarter', 'quarter', 'quarter', 'quarter'], [1, 2, 2, 3]);
    const s = buildSchedule(v, { tempo: 60, fromMeasure: 2, toMeasure: 2 });
    expect(s).toEqual([
      { midi: 62, time: 0, duration: 1 },
      { midi: 64, time: 1, duration: 1 },
    ]);
  });

  test('null/zero tempo falls back to 90 BPM; empty voices → []', () => {
    const v = voice([60], ['quarter'], [1]);
    const s = buildSchedule(v, { tempo: null });
    expect(s[0].duration).toBeCloseTo(60 / 90, 5);
    expect(buildSchedule([], {})).toEqual([]);
    expect(buildSchedule(null, {})).toEqual([]);
  });

  test('picks the voice with the most notes', () => {
    const voices = [
      { pitch: [60], duration: ['quarter'], measureIndex: [1], interval: [], sargam: [], chordSymbol: [], lyric: [] },
      { pitch: [62, 64, 65], duration: ['quarter', 'quarter', 'quarter'], measureIndex: [1, 1, 1], interval: [], sargam: [], chordSymbol: [], lyric: [] },
    ];
    const s = buildSchedule(voices, { tempo: 60 });
    expect(s.map(e => e.midi)).toEqual([62, 64, 65]);
  });
});

describe('parseYouTubeId', () => {
  test('extracts the 11-char id from common URL shapes', () => {
    expect(parseYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://www.youtube.com/embed/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ');
    expect(parseYouTubeId('https://music.youtube.com/watch?v=dQw4w9WgXcQ&list=xyz')).toBe('dQw4w9WgXcQ');
  });

  test('returns null for non-YouTube or id-less input', () => {
    expect(parseYouTubeId('https://example.com/video')).toBeNull();
    expect(parseYouTubeId('')).toBeNull();
    expect(parseYouTubeId(null)).toBeNull();
  });
});

describe('instrumentVoiceKey', () => {
  test('maps instrument names to a voice category', () => {
    expect(instrumentVoiceKey('Piano')).toBe('piano');
    expect(instrumentVoiceKey('Harpsichord')).toBe('piano');
    expect(instrumentVoiceKey('Acoustic Guitar')).toBe('guitar');
    expect(instrumentVoiceKey('Violin')).toBe('strings');
    expect(instrumentVoiceKey('Cello')).toBe('strings');
    expect(instrumentVoiceKey('Pipe Organ')).toBe('organ');
  });
  test('unknown / empty / null → synth', () => {
    expect(instrumentVoiceKey('Trumpet')).toBe('synth');
    expect(instrumentVoiceKey('')).toBe('synth');
    expect(instrumentVoiceKey(null)).toBe('synth');
    expect(instrumentVoiceKey(undefined)).toBe('synth');
  });
});

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

describe('buildScheduleFromMusicXml', () => {
  // Helpers to assemble minimal MusicXML. 120 BPM → 0.5s per quarter beat.
  const wrap = (inner) => `<?xml version="1.0"?><score-partwise><part id="P1">${inner}</part></score-partwise>`;
  const attrs = (div) => `<attributes><divisions>${div}</divisions></attributes>`;
  const pn = (step, oct, dur, { chord = false, alter = null, tie = null, voice = null } = {}) => {
    const v = voice != null ? `<voice>${voice}</voice>` : '';
    const c = chord ? '<chord/>' : '';
    const a = alter != null ? `<alter>${alter}</alter>` : '';
    const t = tie ? `<tie type="${tie}"/>` : '';
    return `<note>${c}${v}<pitch><step>${step}</step>${a}<octave>${oct}</octave></pitch><duration>${dur}</duration>${t}</note>`;
  };
  const rest = (dur) => `<note><rest/><duration>${dur}</duration></note>`;
  const backup = (dur) => `<backup><duration>${dur}</duration></backup>`;

  test('sequential notes get cumulative onsets and real durations', () => {
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('C', 4, 1)}${pn('E', 4, 1)}</measure>` +
                     `<measure number="2">${pn('G', 4, 2)}</measure>`);
    expect(buildScheduleFromMusicXml(xml, { tempo: 120 })).toEqual([
      { midi: 60, time: 0,   duration: 0.5, beat: 0 },
      { midi: 64, time: 0.5, duration: 0.5, beat: 1 },
      { midi: 67, time: 1,   duration: 1,   beat: 2 },
    ]);
  });

  test('chord notes stack at the same onset (no arpeggio, no time inflation)', () => {
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('C', 4, 1)}${pn('E', 4, 1, { chord: true })}` +
                     `${pn('G', 4, 1, { chord: true })}${pn('D', 4, 1)}</measure>`);
    expect(buildScheduleFromMusicXml(xml, { tempo: 120 })).toEqual([
      { midi: 60, time: 0,   duration: 0.5, beat: 0 },
      { midi: 64, time: 0,   duration: 0.5, beat: 0 },
      { midi: 67, time: 0,   duration: 0.5, beat: 0 },
      { midi: 62, time: 0.5, duration: 0.5, beat: 1 },
    ]);
  });

  test('rests advance time without sounding (the gap is preserved)', () => {
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('C', 4, 1)}${rest(1)}${pn('E', 4, 1)}</measure>`);
    // `beat` keeps the rest's gap (E at beat 2, not beat 1) so the OSMD cursor can be advanced
    // over the rest entry — `time` is re-zeroed/compacted but the absolute beat is not.
    expect(buildScheduleFromMusicXml(xml, { tempo: 120 })).toEqual([
      { midi: 60, time: 0, duration: 0.5, beat: 0 },
      { midi: 64, time: 1, duration: 0.5, beat: 2 },
    ]);
  });

  test('two voices align in time via <backup>', () => {
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('C', 5, 2, { voice: 1 })}${backup(2)}` +
                     `${pn('C', 4, 1, { voice: 2 })}${pn('E', 4, 1, { voice: 2 })}</measure>`);
    expect(buildScheduleFromMusicXml(xml, { tempo: 120 })).toEqual([
      { midi: 72, time: 0,   duration: 1,   beat: 0 },
      { midi: 60, time: 0,   duration: 0.5, beat: 0 },
      { midi: 64, time: 0.5, duration: 0.5, beat: 1 },
    ]);
  });

  test('a tie-stop extends the prior same-pitch note instead of retriggering', () => {
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('C', 4, 1, { tie: 'start' })}` +
                     `${pn('C', 4, 1, { tie: 'stop' })}</measure>`);
    expect(buildScheduleFromMusicXml(xml, { tempo: 120 })).toEqual([
      { midi: 60, time: 0, duration: 1, beat: 0 },
    ]);
  });

  test('divisions scale duration to beats', () => {
    const xml = wrap(`<measure number="1">${attrs(2)}${pn('C', 4, 2)}${pn('D', 4, 1)}</measure>`);
    expect(buildScheduleFromMusicXml(xml, { tempo: 120 })).toEqual([
      { midi: 60, time: 0,   duration: 0.5,  beat: 0 },
      { midi: 62, time: 0.5, duration: 0.25, beat: 1 },
    ]);
  });

  test('alter raises/lowers the pitch (F# = 66)', () => {
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('F', 4, 1, { alter: 1 })}</measure>`);
    expect(buildScheduleFromMusicXml(xml, { tempo: 120 })).toEqual([
      { midi: 66, time: 0, duration: 0.5, beat: 0 },
    ]);
  });

  test('grace notes sound: a duration-less grace note is scheduled just before its principal (never at a negative beat)', () => {
    // G4 (2 beats) → grace B4 (no <duration>) → C5 principal. A grace note has no duration, so before
    // this fix it was dropped from the schedule and never played. It should now sound briefly, ending
    // at the principal's onset, on a NON-NEGATIVE beat (a negative beat would desync the OSMD cursor).
    const grace = '<note><grace slash="yes"/><pitch><step>B</step><octave>4</octave></pitch><type>eighth</type></note>';
    const xml = wrap(`<measure number="1">${attrs(4)}${pn('G', 4, 8)}${grace}${pn('C', 5, 8)}</measure>`);
    const s = buildScheduleFromMusicXml(xml, { tempo: 120 });
    const midis = s.map((e) => e.midi);
    expect(midis).toContain(71);                    // B4 grace now present (was dropped)
    const g = s.find((e) => e.midi === 71);
    const principal = s.find((e) => e.midi === 72); // C5
    expect(g.beat).toBeGreaterThan(0);              // between G4 (beat 0) and C5
    expect(g.beat).toBeLessThan(principal.beat);    // sounds BEFORE the principal
    expect(g.duration).toBeGreaterThan(0);          // has audible length
    expect(principal.beat).toBe(2);                 // principal keeps its true onset (grace stole no timeline)
  });

  test('a grace note at the very start still sounds (clamped to beat 0, never negative)', () => {
    // Grace as the first event: there is no room before it, so it sounds from beat 0 (not a negative beat).
    const grace = '<note><grace slash="yes"/><pitch><step>B</step><octave>3</octave></pitch><type>eighth</type></note>';
    const xml = wrap(`<measure number="1">${attrs(4)}${grace}${pn('C', 4, 8)}</measure>`);
    const s = buildScheduleFromMusicXml(xml, { tempo: 120 });
    const g = s.find((e) => e.midi === 59);         // B3
    expect(g).toBeDefined();
    expect(g.beat).toBeGreaterThanOrEqual(0);       // never negative
    expect(g.duration).toBeGreaterThan(0);
  });

  test('measure range filters then re-zeroes the segment to t=0', () => {
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('C', 4, 1)}${pn('E', 4, 1)}</measure>` +
                     `<measure number="2">${pn('G', 4, 2)}</measure>`);
    // `time` re-zeroes to 0 for the segment, but `beat` stays ABSOLUTE (2) — so cursor sync still
    // lands on the right note when only a measure range is played.
    expect(buildScheduleFromMusicXml(xml, { tempo: 120, fromMeasure: 2, toMeasure: 2 })).toEqual([
      { midi: 67, time: 0, duration: 1, beat: 2 },
    ]);
  });

  test('beat range starts mid-measure: keeps onsets in [fromBeat,toBeat], re-zeroed', () => {
    // measure 1: C@0, E@1, G@2, A@3 (quarter beats). Window from beat 1 to beat 2 → E, G only.
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('C', 4, 1)}${pn('E', 4, 1)}${pn('G', 4, 1)}${pn('A', 4, 1)}</measure>`);
    expect(buildScheduleFromMusicXml(xml, { tempo: 120, fromBeat: 1, toBeat: 2 })).toEqual([
      { midi: 64, time: 0,   duration: 0.5, beat: 1 },
      { midi: 67, time: 0.5, duration: 0.5, beat: 2 },
    ]);
  });

  test('beat range crossing a barline keeps a sub-measure run across measures', () => {
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('C', 4, 1)}${pn('E', 4, 1)}</measure>` +
                     `<measure number="2">${pn('G', 4, 1)}${pn('B', 4, 1)}</measure>`);
    // beats: C@0,E@1,G@2,B@3 → window [1,2] = E (m1) + G (m2)
    expect(buildScheduleFromMusicXml(xml, { tempo: 120, fromBeat: 1, toBeat: 2 })).toEqual([
      { midi: 64, time: 0,   duration: 0.5, beat: 1 },
      { midi: 67, time: 0.5, duration: 0.5, beat: 2 },
    ]);
  });

  test('empty / unparseable / note-less input → []', () => {
    expect(buildScheduleFromMusicXml('', { tempo: 120 })).toEqual([]);
    expect(buildScheduleFromMusicXml(null)).toEqual([]);
    expect(buildScheduleFromMusicXml('<score-partwise></score-partwise>', { tempo: 120 })).toEqual([]);
  });

  test('mutedNotes flags matching schedule items (by measure, midi, beats) and leaves others alone', () => {
    // measure 1: C4@beat0, E4@beat1 (two quarters at tempo 120 → 0.5s each).
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('C', 4, 1)}${pn('E', 4, 1)}</measure>`);
    const s = buildScheduleFromMusicXml(xml, { tempo: 120, mutedNotes: [{ measure: 1, midi: 64, beats: 1 }] });
    expect(s).toEqual([
      { midi: 60, time: 0, duration: 0.5, beat: 0 },
      { midi: 64, time: 0.5, duration: 0.5, beat: 1, muted: true },
    ]);
  });

  test('keepNotes keeps only matched notes and compresses the gap across an untagged note', () => {
    // C@0, D@1 (untagged), E@2. Keep C+E → play C then E, gap (over D) collapsed to a breath.
    // `beat` stays the ORIGINAL absolute onset so the OSMD cursor jumps ahead; `time` is compressed.
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('C', 4, 1)}${pn('D', 4, 1)}${pn('E', 4, 1)}</measure>`);
    const s = buildScheduleFromMusicXml(xml, {
      tempo: 120, keepNotes: [{ midi: 60, beats: 0 }, { midi: 64, beats: 2 }], breathBeats: 0.5,
    });
    // 120 BPM → 0.5s/beat. C: t0,beat0; E: out onset = C.end(1b) + breath(0.5b) = 1.5b → 0.75s, beat 2.
    expect(s).toEqual([
      { midi: 60, time: 0,    duration: 0.5, beat: 0 },
      { midi: 64, time: 0.75, duration: 0.5, beat: 2 },
    ]);
  });

  test('keepNotes preserves a rest-only gap (breath unused) regardless of default', () => {
    // C@0 (quarter), rest, E@2 — both kept, nothing untagged between → keep the original gap.
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('C', 4, 1)}${rest(1)}${pn('E', 4, 1)}</measure>`);
    const s = buildScheduleFromMusicXml(xml, { tempo: 120, keepNotes: [{ midi: 60, beats: 0 }, { midi: 64, beats: 2 }] });
    expect(s).toEqual([
      { midi: 60, time: 0, duration: 0.5, beat: 0 },
      { midi: 64, time: 1, duration: 0.5, beat: 2 },
    ]);
  });

  test('keepNotes defaults the breath to 1 beat when breathBeats is omitted', () => {
    // C@0, D@1 (untagged), E@2. No breathBeats → default 1 beat: E out onset = C.end(1) + 1 = 2b → 1.0s.
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('C', 4, 1)}${pn('D', 4, 1)}${pn('E', 4, 1)}</measure>`);
    const s = buildScheduleFromMusicXml(xml, { tempo: 120, keepNotes: [{ midi: 60, beats: 0 }, { midi: 64, beats: 2 }] });
    expect(s).toEqual([
      { midi: 60, time: 0, duration: 0.5, beat: 0 },
      { midi: 64, time: 1, duration: 0.5, beat: 2 },
    ]);
  });

  test('keepNotes with a custom breathBeats overrides the default', () => {
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('C', 4, 1)}${pn('D', 4, 1)}${pn('E', 4, 1)}</measure>`);
    const s = buildScheduleFromMusicXml(xml, {
      tempo: 120, keepNotes: [{ midi: 60, beats: 0 }, { midi: 64, beats: 2 }], breathBeats: 0.5,
    });
    // breath = 0.5 beat → E out onset = C.end(1) + 0.5 = 1.5 beats → 0.75s.
    expect(s).toEqual([
      { midi: 60, time: 0, duration: 0.5, beat: 0 },
      { midi: 64, time: 0.75, duration: 0.5, beat: 2 },
    ]);
  });
});

describe('compressKeptEvents', () => {
  // `kept`/`others` carry onset `beats` + `durBeats` (quarter-beats). The helper returns the kept
  // events (originals preserved) with a rewritten output onset `t` (beats): rhythm preserved within
  // a run, gaps that span an untagged note collapsed to a `breathBeats` breath.
  test('first kept note starts the output timeline at 0', () => {
    const kept = [{ midi: 60, beats: 4, durBeats: 1 }];
    expect(compressKeptEvents(kept, [], 0.5)).toEqual([{ midi: 60, beats: 4, durBeats: 1, t: 0 }]);
  });

  test('breathBeats defaults to 1 when omitted', () => {
    // C@0 (quarter), untagged D@1, E@2 → collapse spans D, default breath = 1 → E at C.end(1) + 1 = 2.
    const kept = [{ midi: 60, beats: 0, durBeats: 1 }, { midi: 64, beats: 2, durBeats: 1 }];
    const others = [{ midi: 62, beats: 1, durBeats: 1 }];
    expect(compressKeptEvents(kept, others)).toEqual([
      { midi: 60, beats: 0, durBeats: 1, t: 0 },
      { midi: 64, beats: 2, durBeats: 1, t: 2 },
    ]);
  });

  test('contiguous kept notes stay contiguous (no gap to remove)', () => {
    const kept = [{ midi: 60, beats: 0, durBeats: 1 }, { midi: 62, beats: 1, durBeats: 1 }];
    expect(compressKeptEvents(kept, [], 0.5)).toEqual([
      { midi: 60, beats: 0, durBeats: 1, t: 0 },
      { midi: 62, beats: 1, durBeats: 1, t: 1 },
    ]);
  });

  test('a rest-only gap between kept notes is preserved (part of the run rhythm)', () => {
    // C@0 (quarter) … gap … E@2 (quarter), nothing untagged in between → keep the 1-beat gap.
    const kept = [{ midi: 60, beats: 0, durBeats: 1 }, { midi: 64, beats: 2, durBeats: 1 }];
    expect(compressKeptEvents(kept, [], 0.5)).toEqual([
      { midi: 60, beats: 0, durBeats: 1, t: 0 },
      { midi: 64, beats: 2, durBeats: 1, t: 2 },
    ]);
  });

  test('a gap spanning an untagged note collapses to the breath gap', () => {
    // C@0 (quarter), untagged D@1, E@2 → the C→E gap spans D, collapse to E at C.end + breath.
    const kept = [{ midi: 60, beats: 0, durBeats: 1 }, { midi: 64, beats: 2, durBeats: 1 }];
    const others = [{ midi: 62, beats: 1, durBeats: 1 }];
    expect(compressKeptEvents(kept, others, 0.5)).toEqual([
      { midi: 60, beats: 0, durBeats: 1, t: 0 },
      { midi: 64, beats: 2, durBeats: 1, t: 1.5 },
    ]);
  });

  test('chord-stacked kept notes (same onset) share one output onset', () => {
    const kept = [{ midi: 60, beats: 0, durBeats: 1 }, { midi: 64, beats: 0, durBeats: 1 }];
    expect(compressKeptEvents(kept, [], 0.5)).toEqual([
      { midi: 60, beats: 0, durBeats: 1, t: 0 },
      { midi: 64, beats: 0, durBeats: 1, t: 0 },
    ]);
  });

  test('two runs separated by untagged material: rhythm kept within, breath between', () => {
    // run A: C@0,E@1 (contiguous quarters); untagged stuff fills beats 2–4; run B: G@4,B@5.
    const kept = [
      { midi: 60, beats: 0, durBeats: 1 }, { midi: 64, beats: 1, durBeats: 1 },
      { midi: 67, beats: 4, durBeats: 1 }, { midi: 71, beats: 5, durBeats: 1 },
    ];
    const others = [{ midi: 65, beats: 2, durBeats: 1 }, { midi: 65, beats: 3, durBeats: 1 }];
    expect(compressKeptEvents(kept, others, 0.5)).toEqual([
      { midi: 60, beats: 0, durBeats: 1, t: 0 },
      { midi: 64, beats: 1, durBeats: 1, t: 1 },
      { midi: 67, beats: 4, durBeats: 1, t: 2.5 },   // E.end(2) + breath(0.5)
      { midi: 71, beats: 5, durBeats: 1, t: 3.5 },   // contiguous after G
    ]);
  });
});

describe('gmInstrumentForVoice', () => {
  test('maps each category to a General MIDI instrument', () => {
    expect(gmInstrumentForVoice('guitar')).toBe('acoustic_guitar_nylon');
    expect(gmInstrumentForVoice('strings')).toBe('string_ensemble_1');
    expect(gmInstrumentForVoice('organ')).toBe('church_organ');
    expect(gmInstrumentForVoice('piano')).toBe('acoustic_grand_piano');
  });
  test('synth / unknown → acoustic grand piano', () => {
    expect(gmInstrumentForVoice('synth')).toBe('acoustic_grand_piano');
    expect(gmInstrumentForVoice('whatever')).toBe('acoustic_grand_piano');
  });
});

describe('soundfontSampleMap', () => {
  test('builds {pitch: url}; sharp keys map to FLAT filenames (FluidR3 spelling)', () => {
    const m = soundfontSampleMap('acoustic_grand_piano', { baseUrl: 'B/', format: 'mp3', notes: ['C4', 'F#4'] });
    expect(m).toEqual({
      'C4': 'B/acoustic_grand_piano-mp3/C4.mp3',
      'F#4': 'B/acoustic_grand_piano-mp3/Gb4.mp3',   // key keeps '#'; file uses the flat the CDN has
    });
  });
  test('defaults to the FluidR3_GM CDN and a sparse central note set (flats)', () => {
    const m = soundfontSampleMap('church_organ');
    expect(m['C4']).toBe('https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/church_organ-mp3/C4.mp3');
    expect(Object.keys(m)).toContain('Gb4');
    expect(m['Gb4'].endsWith('church_organ-mp3/Gb4.mp3')).toBe(true);
  });
});

describe('isSuppressed', () => {
  const set = [{ measure: 2, midi: 60, beats: 4 }, { measure: 2, midi: 67, beats: 4 }];
  test('matches on (measure, midi, beats)', () => {
    expect(isSuppressed({ measure: 2, midi: 60, beats: 4 }, set)).toBe(true);
    expect(isSuppressed({ measure: 2, midi: 67, beats: 4 }, set)).toBe(true);
  });
  test('tolerates float drift on beats within EPS', () => {
    expect(isSuppressed({ measure: 2, midi: 60, beats: 4 + 1e-9 }, set)).toBe(true);
  });
  test('rejects a different pitch or distant onset', () => {
    expect(isSuppressed({ measure: 2, midi: 62, beats: 4 }, set)).toBe(false);
    expect(isSuppressed({ measure: 2, midi: 60, beats: 4.5 }, set)).toBe(false);
  });
  test('matches by (midi, beats) even when the measure number disagrees (pickup safety)', () => {
    // renderer may tag a note measure=1 while the player event has measure=0 (XML pickup "number");
    // beats + midi still identify it, so suppression works across that numbering gap.
    expect(isSuppressed({ measure: 0, midi: 60, beats: 4 }, set)).toBe(true);
  });
  test('empty or missing set → false', () => {
    expect(isSuppressed({ measure: 2, midi: 60, beats: 4 }, [])).toBe(false);
    expect(isSuppressed({ measure: 2, midi: 60, beats: 4 }, null)).toBe(false);
  });
});
