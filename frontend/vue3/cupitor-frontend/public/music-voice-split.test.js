import { classifyBassMelody, splitSingleVoice } from './music-voice-split.js';
import { buildScheduleFromMusicXml } from './music-player.js';

describe('classifyBassMelody', () => {
  // notes: { midi, onsetDivs, durDivs, beat }  (beat already computed by the caller)
  test('lowest note per beat is bass; the rest are melody', () => {
    const notes = [
      { midi: 48, onsetDivs: 0, durDivs: 2, beat: 0 },   // C3  (lowest of beat 0 → bass)
      { midi: 64, onsetDivs: 0, durDivs: 2, beat: 0 },   // E4  (→ melody)
      { midi: 67, onsetDivs: 2, durDivs: 2, beat: 1 },   // G4  (only note of beat 1 → melody)
    ];
    const { melody, bass } = classifyBassMelody(notes);
    expect(bass.map((n) => n.midi)).toEqual([48]);
    expect(melody.map((n) => n.midi)).toEqual([64, 67]);
  });

  test('a single-note beat goes to melody, bass stays empty for it', () => {
    const notes = [{ midi: 60, onsetDivs: 0, durDivs: 4, beat: 0 }];
    const { melody, bass } = classifyBassMelody(notes);
    expect(melody).toHaveLength(1);
    expect(bass).toHaveLength(0);
  });
});

test('rewrites a single-voice segment into voice1=melody, voice2=bass', () => {
  // divisions=2. m1: chord stack E4 + C3 (C3 via <chord/>) on beat 0, then G4 on beat 1.
  const seg = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
    <attributes><divisions>2</divisions></attributes>
    <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
    <note><chord/><pitch><step>C</step><octave>3</octave></pitch><duration>2</duration><voice>1</voice></note>
    <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
  </measure></part></score-partwise>`;
  const out = splitSingleVoice(seg);
  const doc = new DOMParser().parseFromString(out, 'application/xml');
  const S = { C:0,D:2,E:4,F:5,G:7,A:9,B:11 };
  const midi = (n) => {
    const p = n.querySelector('pitch');
    const step = p.querySelector('step').textContent;
    const oct = parseInt(p.querySelector('octave').textContent, 10);
    const alt = p.querySelector('alter') ? parseInt(p.querySelector('alter').textContent, 10) : 0;
    return 12 * (oct + 1) + S[step] + alt;
  };
  const voiceOf = (v) => Array.from(doc.querySelectorAll('note'))
    .filter((n) => (n.querySelector('voice') || {}).textContent === v && n.querySelector('pitch'));
  expect(voiceOf('2').map(midi)).toEqual([48]);                         // bass = C3 (lowest of beat 0)
  expect(voiceOf('1').map(midi).sort((a,b)=>a-b)).toEqual([64, 67]);    // melody = E4, G4
  expect(doc.querySelector('backup')).not.toBeNull();
});

test('splits a 3-note block chord: bass stays, melody upper notes stack as a chord', () => {
  // divisions=2. m1: block chord C3 + E4 + G4 (upper two via <chord/>) on beat 0, duration 2.
  const seg = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
    <attributes><divisions>2</divisions></attributes>
    <note><pitch><step>C</step><octave>3</octave></pitch><duration>2</duration><voice>1</voice></note>
    <note><chord/><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
    <note><chord/><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
  </measure></part></score-partwise>`;
  const out = splitSingleVoice(seg);
  const doc = new DOMParser().parseFromString(out, 'application/xml');
  const S = { C:0,D:2,E:4,F:5,G:7,A:9,B:11 };
  const midi = (n) => {
    const p = n.querySelector('pitch');
    const step = p.querySelector('step').textContent;
    const oct = parseInt(p.querySelector('octave').textContent, 10);
    const alt = p.querySelector('alter') ? parseInt(p.querySelector('alter').textContent, 10) : 0;
    return 12 * (oct + 1) + S[step] + alt;
  };
  const voiceOf = (v) => Array.from(doc.querySelectorAll('note'))
    .filter((n) => (n.querySelector('voice') || {}).textContent === v && n.querySelector('pitch'));
  expect(voiceOf('2').map(midi)).toEqual([48]);                        // bass = C3
  const mel = voiceOf('1');
  expect(mel.map(midi).sort((a,b)=>a-b)).toEqual([64, 67]);            // melody = E4, G4
  expect(mel.filter((n) => n.querySelector('chord'))).toHaveLength(1); // 2nd melody note is a <chord/>
  // Voice 1 spans exactly the measure: chord note adds 0 time.
  const advanced = Array.from(doc.querySelectorAll('note'))
    .filter((n) => (n.querySelector('voice') || {}).textContent === '1' && !n.querySelector('chord'))
    .reduce((a, n) => a + parseInt(n.querySelector('duration').textContent, 10), 0);
  expect(advanced).toBe(2);
});

test('split output schedules with NON-NEGATIVE, 0-based beats (no leading-backup desync)', () => {
  // Two measures, single voice. Before the fix, writeVoice prepended a <backup> to the emptied
  // measure, laying both voices at negative onsets — so the player/cursor/mute (which read absolute
  // beats) desynced from OSMD (which normalizes to 0). Every scheduled onset must be ≥ 0, min = 0.
  const seg = `<?xml version="1.0"?><score-partwise><part id="P1">
    <measure number="1"><attributes><divisions>2</divisions></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
      <note><pitch><step>E</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
    </measure>
    <measure number="2">
      <note><pitch><step>G</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
      <note><pitch><step>C</step><octave>5</octave></pitch><duration>2</duration><voice>1</voice></note>
    </measure>
  </part></score-partwise>`;
  const sched = buildScheduleFromMusicXml(splitSingleVoice(seg), { tempo: 120 });
  expect(sched.length).toBeGreaterThan(0);
  expect(sched.every((e) => e.beat >= 0)).toBe(true);
  expect(Math.min(...sched.map((e) => e.beat))).toBe(0);
});

test('splitSingleVoice returns multi-voice input unchanged', () => {
  const seg = `<?xml version="1.0"?><score-partwise><part id="P1"><measure number="1">
    <note><pitch><step>C</step><octave>4</octave></pitch><duration>2</duration><voice>1</voice></note>
    <note><pitch><step>E</step><octave>3</octave></pitch><duration>2</duration><voice>2</voice></note>
  </measure></part></score-partwise>`;
  expect(splitSingleVoice(seg)).toBe(seg);
});
