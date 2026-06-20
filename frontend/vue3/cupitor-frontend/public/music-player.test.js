// public/music-player.test.js
import { buildSchedule, NOTE_TYPE_BEATS, parseYouTubeId, instrumentVoiceKey, scheduleEnd, buildScheduleFromMusicXml, gmInstrumentForVoice, soundfontSampleMap } from './music-player.js';

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
      { midi: 60, time: 0,   duration: 0.5 },
      { midi: 64, time: 0.5, duration: 0.5 },
      { midi: 67, time: 1,   duration: 1 },
    ]);
  });

  test('chord notes stack at the same onset (no arpeggio, no time inflation)', () => {
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('C', 4, 1)}${pn('E', 4, 1, { chord: true })}` +
                     `${pn('G', 4, 1, { chord: true })}${pn('D', 4, 1)}</measure>`);
    expect(buildScheduleFromMusicXml(xml, { tempo: 120 })).toEqual([
      { midi: 60, time: 0,   duration: 0.5 },
      { midi: 64, time: 0,   duration: 0.5 },
      { midi: 67, time: 0,   duration: 0.5 },
      { midi: 62, time: 0.5, duration: 0.5 },
    ]);
  });

  test('rests advance time without sounding (the gap is preserved)', () => {
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('C', 4, 1)}${rest(1)}${pn('E', 4, 1)}</measure>`);
    expect(buildScheduleFromMusicXml(xml, { tempo: 120 })).toEqual([
      { midi: 60, time: 0, duration: 0.5 },
      { midi: 64, time: 1, duration: 0.5 },
    ]);
  });

  test('two voices align in time via <backup>', () => {
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('C', 5, 2, { voice: 1 })}${backup(2)}` +
                     `${pn('C', 4, 1, { voice: 2 })}${pn('E', 4, 1, { voice: 2 })}</measure>`);
    expect(buildScheduleFromMusicXml(xml, { tempo: 120 })).toEqual([
      { midi: 72, time: 0,   duration: 1 },
      { midi: 60, time: 0,   duration: 0.5 },
      { midi: 64, time: 0.5, duration: 0.5 },
    ]);
  });

  test('a tie-stop extends the prior same-pitch note instead of retriggering', () => {
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('C', 4, 1, { tie: 'start' })}` +
                     `${pn('C', 4, 1, { tie: 'stop' })}</measure>`);
    expect(buildScheduleFromMusicXml(xml, { tempo: 120 })).toEqual([
      { midi: 60, time: 0, duration: 1 },
    ]);
  });

  test('divisions scale duration to beats', () => {
    const xml = wrap(`<measure number="1">${attrs(2)}${pn('C', 4, 2)}${pn('D', 4, 1)}</measure>`);
    expect(buildScheduleFromMusicXml(xml, { tempo: 120 })).toEqual([
      { midi: 60, time: 0,   duration: 0.5 },
      { midi: 62, time: 0.5, duration: 0.25 },
    ]);
  });

  test('alter raises/lowers the pitch (F# = 66)', () => {
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('F', 4, 1, { alter: 1 })}</measure>`);
    expect(buildScheduleFromMusicXml(xml, { tempo: 120 })).toEqual([
      { midi: 66, time: 0, duration: 0.5 },
    ]);
  });

  test('measure range filters then re-zeroes the segment to t=0', () => {
    const xml = wrap(`<measure number="1">${attrs(1)}${pn('C', 4, 1)}${pn('E', 4, 1)}</measure>` +
                     `<measure number="2">${pn('G', 4, 2)}</measure>`);
    expect(buildScheduleFromMusicXml(xml, { tempo: 120, fromMeasure: 2, toMeasure: 2 })).toEqual([
      { midi: 67, time: 0, duration: 1 },
    ]);
  });

  test('empty / unparseable / note-less input → []', () => {
    expect(buildScheduleFromMusicXml('', { tempo: 120 })).toEqual([]);
    expect(buildScheduleFromMusicXml(null)).toEqual([]);
    expect(buildScheduleFromMusicXml('<score-partwise></score-partwise>', { tempo: 120 })).toEqual([]);
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
  test('builds {pitch: url}; sharps use "s" in the filename only', () => {
    const m = soundfontSampleMap('acoustic_grand_piano', { baseUrl: 'B/', format: 'mp3', notes: ['C4', 'F#4'] });
    expect(m).toEqual({
      'C4': 'B/acoustic_grand_piano-mp3/C4.mp3',
      'F#4': 'B/acoustic_grand_piano-mp3/Fs4.mp3',   // key keeps '#', filename uses 's'
    });
  });
  test('defaults to the FluidR3_GM CDN and a sparse central note set', () => {
    const m = soundfontSampleMap('church_organ');
    expect(m['C4']).toBe('https://gleitz.github.io/midi-js-soundfonts/FluidR3_GM/church_organ-mp3/C4.mp3');
    expect(Object.keys(m)).toContain('F#4');
    expect(m['F#4'].endsWith('church_organ-mp3/Fs4.mp3')).toBe(true);
  });
});
