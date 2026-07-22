import { measureRangeFromNoteRange } from './music-render.js';
import { collapsedChordSpans } from './music-render.js';
import { chordToneNotesInMeasures } from './music-render.js';
import { measureRangeFromChordMatch } from './music-render.js';
import { responsiveZoom } from './music-render.js';
import { createMusicRenderer } from './music-render.js';
import { resolveMatchMeasures } from './music-render.js';
import { voiceColor } from './music-render.js';
import { noteName } from './music-render.js';
import { notesInWindow, clampAnchorIndex } from './music-render.js';
import { suppressionKey, notesOfVoice, effectiveMuted } from './music-render.js';
import { pitchClassFromPitch } from './music-render.js';
import { clusterBandsByGap } from './music-render.js';
import { encodeMusicXml, inferChords } from './music-encoding.js';
import { buildIndexEntry } from './music-index.js';
import fs from 'fs';
import jQuery from 'jquery';

const detail = {
  meta: { id: 'x', format: 'musicxml' },
  format: 'musicxml',
  voices: [{
    pitch: [60, 62, 64, 65, 67],
    interval: [], sargam: [], duration: [], chordSymbol: [], lyric: [],
    measureIndex: [1, 1, 2, 2, 3]
  }]
};

describe('measureRangeFromNoteRange', () => {
  test('maps a note-index range to a measure range', () => {
    expect(measureRangeFromNoteRange(detail, [1, 3])).toEqual([1, 2]);
  });
  test('single note maps to its measure', () => {
    expect(measureRangeFromNoteRange(detail, [4, 4])).toEqual([3, 3]);
  });
  test('clamps out-of-bounds indices', () => {
    expect(measureRangeFromNoteRange(detail, [0, 99])).toEqual([1, 3]);
  });
  test('returns null when there are no notes', () => {
    expect(measureRangeFromNoteRange({ voices: [{ pitch: [], measureIndex: [] }] }, [0, 0])).toBeNull();
  });
});

describe('collapsedChordSpans', () => {
  test('collapses consecutive duplicate chords and tracks measure spans', () => {
    const d = {
      voices: [{
        pitch: [1, 2, 3, 4, 5],
        chordSymbol: ['C', 'C', 'G', 'G', 'Am'],
        measureIndex: [1, 1, 2, 2, 3],
        interval: [], sargam: [], duration: [], lyric: []
      }]
    };
    expect(collapsedChordSpans(d)).toEqual([
      { symbol: 'C', measureStart: 1, measureEnd: 1 },
      { symbol: 'G', measureStart: 2, measureEnd: 2 },
      { symbol: 'Am', measureStart: 3, measureEnd: 3 }
    ]);
  });
  test('skips null chord slots', () => {
    const d = {
      voices: [{
        pitch: [1, 2, 3],
        chordSymbol: [null, 'C', null],
        measureIndex: [1, 1, 2],
        interval: [], sargam: [], duration: [], lyric: []
      }]
    };
    expect(collapsedChordSpans(d).map(s => s.symbol)).toEqual(['C']);
  });
});

const CHOPIN = '/Users/satyendra.kumar/Documents/MuseScore3/Scores/Chopin_Nocturne_Op.9_No.2_for_Solo_Guitar.xml';
const haveChopin = (() => { try { return fs.existsSync(CHOPIN); } catch (_) { return false; } })();

(haveChopin ? describe : describe.skip)('collapsedChordSpans pins buildIndexEntry collapse', () => {
  beforeAll(() => { global.$ = global.jQuery = jQuery; });
  test('symbol sequence matches search.chords on real data', () => {
    const xml = fs.readFileSync(CHOPIN, 'utf8');
    const doc = inferChords(encodeMusicXml(xml, { id: 'chopin', system: 'western' }));
    const entry = buildIndexEntry(doc, xml);
    const spans = collapsedChordSpans(doc);
    expect(spans.map(s => s.symbol).join(' ')).toBe(entry.search.chords);
  });
});

describe('chordToneNotesInMeasures', () => {
  // byMeasure keyed by absolute measure number; each note carries a pitch-class `name`.
  const byMeasure = {
    21: [{ name: 'D', el: 'd1' }, { name: 'F', el: 'f1' }, { name: 'A', el: 'a1' }, { name: 'E', el: 'e1' }],
    22: [{ name: 'A', el: 'a2' }, { name: 'C', el: 'c2' }, { name: 'E', el: 'e2' }],
    23: [{ name: 'B', el: 'b3' }, { name: 'D', el: 'd3' }, { name: 'F', el: 'f3' }],
  };
  test('picks only the chord-tone notes within the given measure range', () => {
    // Dm (= D,F,A) at measure 21 only: E is not a chord tone and is excluded.
    const notes = chordToneNotesInMeasures(byMeasure, ['D', 'F', 'A'], [21, 21]);
    expect(notes.map(n => n.el)).toEqual(['d1', 'f1', 'a1']);
  });
  test('spans several measures and skips notes outside the range', () => {
    const notes = chordToneNotesInMeasures(byMeasure, ['B', 'D', 'F'], [22, 23]);
    expect(notes.map(n => n.el)).toEqual(['b3', 'd3', 'f3']);   // Bdim tones live in measure 23
  });
  test('empty tones / bad range yield []', () => {
    expect(chordToneNotesInMeasures(byMeasure, [], [21, 21])).toEqual([]);
    expect(chordToneNotesInMeasures(byMeasure, ['D'], null)).toEqual([]);
  });
  test('offset shifts the sequential range to the rendered (printed) numbering', () => {
    // Pickup piece: rendered notes are keyed by printed = sequential − 1. A chip whose chord sits at
    // SEQUENTIAL measure 22 must look up printed measure 21 — without the offset it lands on 22 (wrong).
    const notes = chordToneNotesInMeasures(byMeasure, ['D', 'F', 'A'], [22, 22], 1);
    expect(notes.map(n => n.el)).toEqual(['d1', 'f1', 'a1']);   // printed 21 = the Dm measure
    // no offset would grab measure 22 (A,C,E) — only A is a Dm tone
    expect(chordToneNotesInMeasures(byMeasure, ['D', 'F', 'A'], [22, 22], 0).map(n => n.el)).toEqual(['a2']);
  });
});

describe('measureRangeFromChordMatch', () => {
  const detail2 = {
    voices: [{
      pitch: [1, 2, 3, 4, 5, 6],
      chordSymbol: ['C', 'C', 'G', 'Am', 'Am', 'F'],
      measureIndex: [1, 1, 2, 3, 3, 4],
      interval: [], sargam: [], duration: [], lyric: []
    }]
  };
  test('maps a chord-index range to a measure range', () => {
    expect(measureRangeFromChordMatch(detail2, [0, 1])).toEqual([1, 2]);
  });
  test('maps a single chord index', () => {
    expect(measureRangeFromChordMatch(detail2, [2, 2])).toEqual([3, 3]);
  });
  test('spans across the whole progression', () => {
    expect(measureRangeFromChordMatch(detail2, [0, 3])).toEqual([1, 4]);
  });
  test('returns null when no chords', () => {
    expect(measureRangeFromChordMatch({ voices: [{ chordSymbol: [], measureIndex: [] }] }, [0, 0])).toBeNull();
  });
  test('multi-voice: chords collapse to one measure-ordered sequence (no per-voice copies)', () => {
    // Both voices carry the same 4-measure progression (as inferChords produces). The
    // collapsed list must be the single progression C/G/Am/F over measures 1..4 — NOT the
    // progression repeated per voice. So index [0,3] resolves to the whole tune [1,4].
    const d = { voices: [
      { chordSymbol: ['C', 'C', 'G', 'Am', 'F'], measureIndex: [1, 1, 2, 3, 4], pitch: [1, 2, 3, 4, 5], interval: [], sargam: [], duration: [], lyric: [] },
      { chordSymbol: ['C', 'G', 'Am', 'F'],       measureIndex: [1, 2, 3, 4],    pitch: [9, 9, 9, 9],    interval: [], sargam: [], duration: [], lyric: [] }
    ]};
    expect(collapsedChordSpans(d).map(s => s.symbol)).toEqual(['C', 'G', 'Am', 'F']);
    expect(measureRangeFromChordMatch(d, [0, 3])).toEqual([1, 4]);
  });

  test('multi-voice: a match near a voice seam stays tight, never spans the whole piece (regression)', () => {
    // Reproduces the Besame Mucho bug: the OLD concatenation placed voice-0's last chord
    // (measure 3) immediately before voice-1's first chord (measure 1), so a matched range
    // straddling that seam resolved via MIN-start/MAX-end to the whole piece. The canonical
    // measure-ordered sequence makes every 2-chord window map to at most 2 adjacent measures.
    const d = { voices: [
      { chordSymbol: ['C', 'G', 'Am'], measureIndex: [1, 2, 3], pitch: [1, 2, 3], interval: [], sargam: [], duration: [], lyric: [] },
      { chordSymbol: ['C', 'G', 'Am'], measureIndex: [1, 2, 3], pitch: [9, 9, 9], interval: [], sargam: [], duration: [], lyric: [] }
    ]};
    const spans = collapsedChordSpans(d);
    // any adjacent pair resolves to a span of <= 2 measures, never [1,3]
    for (let i = 1; i < spans.length; i++) {
      const [lo, hi] = measureRangeFromChordMatch(d, [i - 1, i]);
      expect(hi - lo).toBeLessThanOrEqual(1);
    }
  });
  test('missing range args return null (no throw)', () => {
    const d = { voices: [{ chordSymbol: ['C'], measureIndex: [1], pitch: [1], interval: [], sargam: [], duration: [], lyric: [] }] };
    expect(measureRangeFromChordMatch(d, undefined)).toBeNull();
  });
});

describe('responsiveZoom', () => {
  test('full zoom at/above the baseline width', () => {
    expect(responsiveZoom(900)).toBeCloseTo(1.0);
    expect(responsiveZoom(1800)).toBeCloseTo(1.0);
  });
  test('scales down on narrower viewports', () => {
    expect(responsiveZoom(450)).toBeCloseTo(0.5);
  });
  test('clamps to a 0.4 floor on very narrow viewports', () => {
    expect(responsiveZoom(200)).toBeCloseTo(0.4);
  });
});

// Minimal fake OSMD that records calls.
function fakeOsmd() {
  return {
    calls: [],
    Zoom: 1.0,
    Sheet: { SourceMeasures: [{}, {}, {}, {}] },  // 4 measures
    setOptions(o) { this.calls.push(['setOptions', o]); },
    load(src) { this.calls.push(['load', src]); return Promise.resolve(); },
    render() { this.calls.push(['render']); }
  };
}

describe('createMusicRenderer', () => {
  test('initialises OSMD with svg/compact options', () => {
    const osmd = fakeOsmd();
    createMusicRenderer({}, { osmdFactory: () => osmd });
    expect(osmd.calls[0]).toEqual(['setOptions', { backend: 'svg', drawingParameters: 'compacttight', drawTitle: false, useXMLMeasureNumbers: true, autoResize: false }]);
  });

  test('loadDetail loads musicxml source, renders, reports total measures', async () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    const res = await r.loadDetail({ format: 'musicxml', source: '<xml/>' });
    expect(res).toEqual({ ok: true, totalMeasures: 4, measureOffset: 0 });
    expect(osmd.calls.some(c => c[0] === 'load' && c[1] === '<xml/>')).toBe(true);
    expect(osmd.calls.some(c => c[0] === 'render')).toBe(true);
  });

  test('loadDetail refuses note-text pieces', async () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    const res = await r.loadDetail({ format: 'note-text', source: 'C D E' });
    expect(res).toEqual({ ok: false, reason: 'not-musicxml' });
    expect(osmd.calls.some(c => c[0] === 'load')).toBe(false);
  });

  test('showSegment sets the measure window and re-renders', () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    r.showSegment([2, 3]);
    const opt = osmd.calls.filter(c => c[0] === 'setOptions').pop()[1];
    expect(opt.drawFromMeasureNumber).toBe(2);
    expect(opt.drawUpToMeasureNumber).toBe(3);
    expect(osmd.calls.some(c => c[0] === 'render')).toBe(true);
  });

  test('showFull resets the measure window from measure 1', async () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    await r.loadDetail({ format: 'musicxml', source: '<xml/>' });
    r.showFull();
    const opt = osmd.calls.filter(c => c[0] === 'setOptions').pop()[1];
    expect(opt.drawFromMeasureNumber).toBe(1);
    expect(opt.drawUpToMeasureNumber).toBe(4);
  });

  test('setZoom sets OSMD Zoom and re-renders', () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    r.setZoom(0.5);
    expect(osmd.Zoom).toBe(0.5);
    expect(osmd.calls.some(c => c[0] === 'render')).toBe(true);
  });

  test('applyResponsiveZoom derives zoom from viewport width', () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    r.applyResponsiveZoom(450);
    expect(osmd.Zoom).toBeCloseTo(0.5);
  });

  test('showFull before loadDetail falls back to an open-ended window', () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    r.showFull();
    const opt = osmd.calls.filter(c => c[0] === 'setOptions').pop()[1];
    expect(opt.drawFromMeasureNumber).toBe(1);
    expect(opt.drawUpToMeasureNumber).toBe(Number.MAX_SAFE_INTEGER);
  });

  test('applyResponsiveZoom works when destructured (no this-binding)', () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    const { applyResponsiveZoom } = r;   // destructured — would throw if it used `this`
    applyResponsiveZoom(450);
    expect(osmd.Zoom).toBeCloseTo(0.5);
  });
});

describe('resolveMatchMeasures', () => {
  const detail = {
    meta: { id: 'x', format: 'musicxml' }, format: 'musicxml',
    voices: [{
      pitch: [60, 62, 64, 65], interval: [], sargam: [], duration: [],
      chordSymbol: ['C', 'C', 'G', 'G'], lyric: [], measureIndex: [1, 1, 2, 2],
    }],
  };
  test('note match → measure range via note indices', () => {
    expect(resolveMatchMeasures(detail, { kind: 'note', range: [0, 2] })).toEqual([1, 2]);
  });
  test('chord match → measure range via collapsed chord spans', () => {
    expect(resolveMatchMeasures(detail, { kind: 'chord', range: [0, 1], symbols: ['C', 'G'] })).toEqual([1, 2]);
  });
  test('null match → null', () => {
    expect(resolveMatchMeasures(detail, null)).toBeNull();
  });
});

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

  test('setVoiceColors sets NoteheadColor per voice and resets to black on toggle-off', () => {
    const noteA = {}, noteB = {};
    const osmd = fakeOsmd();
    osmd.Sheet.Instruments = [
      { Voices: [{ VoiceEntries: [{ Notes: [noteA] }] }] },
      { Voices: [{ VoiceEntries: [{ Notes: [noteB] }] }] },
    ];
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    r.setVoiceColors(true);
    expect(noteA.NoteheadColor).toBe(voiceColor(0));
    expect(noteB.NoteheadColor).toBe(voiceColor(1));   // global voice index increments across instruments
    r.setVoiceColors(false);
    expect(noteA.NoteheadColor).toBe('#000000');
    expect(noteB.NoteheadColor).toBe('#000000');
  });
});

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

  test('getGuessedChords / highlightChord / clearHighlight are safe without a rendered graphic', () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    expect(r.getGuessedChords()).toEqual([]);          // no graphic → no chords, no throw
    expect(() => r.highlightChord([])).not.toThrow();
    expect(() => r.clearHighlight()).not.toThrow();
  });

  test('onAfterRender is invoked after each render', () => {
    const osmd = fakeOsmd();
    let calls = 0;
    const r = createMusicRenderer({}, { osmdFactory: () => osmd, onAfterRender: () => { calls++; } });
    r.showSegment([1, 2]);
    expect(calls).toBeGreaterThan(0);
  });
});

describe('notesInWindow', () => {
  const five = [{ order: 0 }, { order: 1 }, { order: 2 }, { order: 3 }, { order: 4 }];
  test('inclusive slice between start and end order', () => {
    expect(notesInWindow(five, 1, 3).map(n => n.order)).toEqual([1, 2, 3]);
  });
  test('single-note window', () => {
    expect(notesInWindow(five, 2, 2).map(n => n.order)).toEqual([2]);
  });
  test('swaps when start > end', () => {
    expect(notesInWindow(five, 3, 1).map(n => n.order)).toEqual([1, 2, 3]);
  });
  test('clamps out-of-range bounds to the array', () => {
    expect(notesInWindow(five, -5, 99).map(n => n.order)).toEqual([0, 1, 2, 3, 4]);
  });
  test('empty input → empty', () => {
    expect(notesInWindow([], 0, 2)).toEqual([]);
    expect(notesInWindow(null, 0, 2)).toEqual([]);
  });
});

describe('clampAnchorIndex', () => {
  // ordered reading-order list of {measure, idx}
  const list = [
    { measure: 1, idx: 0 }, { measure: 1, idx: 1 },
    { measure: 2, idx: 0 }, { measure: 2, idx: 1 }, { measure: 2, idx: 2 },
    { measure: 3, idx: 0 },
  ];
  test('exact match returns its position', () => {
    expect(clampAnchorIndex(list, { measure: 2, idx: 1 })).toBe(3);
    expect(clampAnchorIndex(list, { measure: 1, idx: 0 })).toBe(0);
  });
  test('missing idx within a present measure → nearest idx in that measure', () => {
    expect(clampAnchorIndex(list, { measure: 2, idx: 9 })).toBe(4);   // measure 2's last note
  });
  test('measure scrolled out below → first note', () => {
    expect(clampAnchorIndex(list, { measure: 0, idx: 0 })).toBe(0);
  });
  test('measure scrolled out above → last note', () => {
    expect(clampAnchorIndex(list, { measure: 9, idx: 0 })).toBe(5);
  });
  test('empty list or null anchor → 0', () => {
    expect(clampAnchorIndex([], { measure: 1, idx: 0 })).toBe(0);
    expect(clampAnchorIndex(list, null)).toBe(0);
  });
});

describe('createMusicRenderer chord window', () => {
  test('setChordWindow re-renders and is safe without a rendered graphic', () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    const before = osmd.calls.filter(c => c[0] === 'render').length;
    expect(() => r.setChordWindow(true)).not.toThrow();
    expect(osmd.calls.filter(c => c[0] === 'render').length).toBe(before + 1);
    expect(() => r.setChordWindow(false)).not.toThrow();
  });
});

describe('suppression pure helpers', () => {
  test('suppressionKey formats measure:midi:beats with fixed precision', () => {
    expect(suppressionKey({ measure: 2, midi: 60, beats: 4 })).toBe('2:60:4.000000');
    expect(suppressionKey({ measure: 1, midi: 67, beats: 1.5 })).toBe('1:67:1.500000');
  });
  test('notesOfVoice keeps that voice and drops unpitched notes', () => {
    const notes = [
      { measure: 1, midi: 60, onsetBeats: 0, voice: 0 },
      { measure: 1, midi: 64, onsetBeats: 0, voice: 1 },
      { measure: 1, midi: null, onsetBeats: 1, voice: 0 },
    ];
    expect(notesOfVoice(notes, 0)).toEqual([{ measure: 1, midi: 60, beats: 0 }]);
  });
  test('effectiveMuted = suppressed − tempRestored, empty when hearAll', () => {
    const S = [{ measure: 1, midi: 60, beats: 0 }, { measure: 1, midi: 64, beats: 0 }];
    const T = new Set([suppressionKey({ measure: 1, midi: 64, beats: 0 })]);
    expect(effectiveMuted(S, T, false)).toEqual([{ measure: 1, midi: 60, beats: 0 }]);
    expect(effectiveMuted(S, T, true)).toEqual([]);
    // a tempRestored key that isn't in S has no effect
    const T2 = new Set([suppressionKey({ measure: 9, midi: 99, beats: 9 })]);
    expect(effectiveMuted(S, T2, false)).toEqual(S);
  });
});

describe('createMusicRenderer suppression set API', () => {
  test('round-trips the suppressed set and computes the effective muted set', () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    r.setSuppressedNotes([{ measure: 1, midi: 60, beats: 0 }, { measure: 1, midi: 64, beats: 0 }]);
    expect(r.getSuppressedNotes()).toEqual([{ measure: 1, midi: 60, beats: 0 }, { measure: 1, midi: 64, beats: 0 }]);
    expect(r.getMutedNotes()).toEqual([{ measure: 1, midi: 60, beats: 0 }, { measure: 1, midi: 64, beats: 0 }]);
    r.setHearAll(true);
    expect(r.getMutedNotes()).toEqual([]);            // hear-all overrides
    expect(r.getSuppressedNotes()).toHaveLength(2);   // saved set intact
    r.setHearAll(false);
    expect(r.getMutedNotes()).toHaveLength(2);
  });

  test('ignores notes missing midi or beats (no NaN keys)', () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    r.setSuppressedNotes([
      { measure: 1, midi: 60, beats: 0 },   // valid
      { measure: 1, midi: 62 },             // no beats → dropped
      { measure: 1, beats: 1 },             // no midi  → dropped
    ]);
    expect(r.getSuppressedNotes()).toEqual([{ measure: 1, midi: 60, beats: 0 }]);
  });
});

describe('createMusicRenderer tag filter playback notes', () => {
  test('getFilterNotes merges the checked tags, sorts by onset, de-dups', () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    r.setPatterns([
      { name: 'A', notes: [{ measure: 1, midi: 64, beats: 1 }, { measure: 1, midi: 60, beats: 0 }] },
      { name: 'B', notes: [{ measure: 3, midi: 67, beats: 8 }] },
      { name: 'C', notes: [{ measure: 2, midi: 62, beats: 4 }] },   // not in the filter
    ]);
    r.setFilterTags(['A', 'B']);
    expect(r.getFilterNotes()).toEqual([
      { measure: 1, midi: 60, beats: 0 },
      { measure: 1, midi: 64, beats: 1 },
      { measure: 3, midi: 67, beats: 8 },
    ]);
  });

  test('getFilterNotes returns [] when no tags are checked', () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    r.setPatterns([{ name: 'A', notes: [{ measure: 1, midi: 60, beats: 0 }] }]);
    expect(r.getFilterNotes()).toEqual([]);
  });

  test('getFilterNotes de-dups a note shared by two checked tags', () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    r.setPatterns([
      { name: 'A', notes: [{ measure: 1, midi: 60, beats: 0 }] },
      { name: 'B', notes: [{ measure: 1, midi: 60, beats: 0 }] },
    ]);
    r.setFilterTags(['A', 'B']);
    expect(r.getFilterNotes()).toEqual([{ measure: 1, midi: 60, beats: 0 }]);
  });
});

describe('pitchClassFromPitch', () => {
  // Mirror OSMD's Pitch: static getNoteEnumString / accidentalVexflow + the two getters.
  const LETTER = { 0: 'C', 2: 'D', 4: 'E', 5: 'F', 7: 'G', 9: 'A', 11: 'B' };
  const ACC = { sharp: '#', flat: 'b', natural: 'n', doublesharp: '##' };  // none → undefined
  class FakePitch {
    constructor(fundamental, accidental) { this.FundamentalNote = fundamental; this.Accidental = accidental; }
    static getNoteEnumString(t) { return LETTER[t] || ''; }
    static accidentalVexflow(t) { return ACC[t]; }
  }

  test('keeps the notated accidental (the F#-read-as-F fix)', () => {
    expect(pitchClassFromPitch(new FakePitch(5, 'sharp'))).toBe('F#');   // was misread as F
    expect(pitchClassFromPitch(new FakePitch(11, 'flat'))).toBe('Bb');
    expect(pitchClassFromPitch(new FakePitch(7, 'doublesharp'))).toBe('G##');
  });
  test('NONE and NATURAL carry no accidental in the name', () => {
    expect(pitchClassFromPitch(new FakePitch(5, 'none'))).toBe('F');      // accidentalVexflow → undefined
    expect(pitchClassFromPitch(new FakePitch(5, 'natural'))).toBe('F');   // "n" → stripped
  });
  test('null pitch or a non-OSMD object → null (caller falls back to the VexFlow key)', () => {
    expect(pitchClassFromPitch(null)).toBeNull();
    expect(pitchClassFromPitch({ FundamentalNote: 5, Accidental: 'sharp' })).toBeNull();
  });
});

describe('clusterBandsByGap (system clustering, zoom-scaled gap)', () => {
  // Three wrapped systems at y≈100/200/300 (≈100 between mids), each a ~20-tall notehead band.
  const mids = [
    { top: 90, bottom: 110, mid: 100 },
    { top: 95, bottom: 115, mid: 105 },
    { top: 190, bottom: 210, mid: 200 },
    { top: 290, bottom: 310, mid: 300 },
  ];
  test('separates systems when the gap threshold is below the inter-system gap', () => {
    expect(clusterBandsByGap(mids, 60)).toHaveLength(3);
  });
  test('zoomed-down coords with a fixed gap merge into one band — the mobile bug — and a zoom-scaled gap recovers', () => {
    const z = 0.4;
    const scaled = mids.map((m) => ({ top: m.top * z, bottom: m.bottom * z, mid: m.mid * z }));
    expect(clusterBandsByGap(scaled, 60)).toHaveLength(1);        // fixed 60 collapses all lines
    expect(clusterBandsByGap(scaled, 60 * z)).toHaveLength(3);    // gap × zoom restores the 3 systems
  });
  test('empty input → []', () => {
    expect(clusterBandsByGap([], 60)).toEqual([]);
  });
});

import { pitchClassesOf, topChordPerMeasure } from './music-render.js';

describe('pitchClassesOf', () => {
  test('dedupes by name, preserves first-seen order', () => {
    expect(pitchClassesOf([{ name: 'C' }, { name: 'E' }, { name: 'C' }, { name: 'G' }]))
      .toEqual(['C', 'E', 'G']);
  });
  test('ignores entries without a name', () => {
    expect(pitchClassesOf([{ name: 'C' }, {}, { name: null }, { name: 'G' }])).toEqual(['C', 'G']);
  });
  test('null/empty input → []', () => {
    expect(pitchClassesOf(null)).toEqual([]);
    expect(pitchClassesOf([])).toEqual([]);
  });
});

describe('topChordPerMeasure', () => {
  test('takes the first chord of each measure that has one', () => {
    const areas = [
      { measure: 1, chords: [{ name: 'C' }, { name: 'Am' }] },
      { measure: 2, chords: [] },
      { measure: 3, chords: [{ name: 'G' }] },
    ];
    expect(topChordPerMeasure(areas)).toEqual([
      { measure: 1, chord: { name: 'C' } },
      { measure: 3, chord: { name: 'G' } },
    ]);
  });
  test('null input → []', () => {
    expect(topChordPerMeasure(null)).toEqual([]);
  });
});

import { octaveFromMidi, noteSetOf, midiFromVexKey, eventsOf } from './music-render.js';

describe('midiFromVexKey', () => {
  test('parses a VexFlow key (note/octave) into a MIDI number', () => {
    expect(midiFromVexKey('c/4')).toBe(60);    // C4
    expect(midiFromVexKey('b/3')).toBe(59);    // B3 — the register a borrowed B should keep
    expect(midiFromVexKey('bb/3')).toBe(58);   // Bb3
    expect(midiFromVexKey('f#/4')).toBe(66);   // F#4
    expect(midiFromVexKey('cn/5')).toBe(72);   // natural marker stripped → C5
  });
  test('invalid / octaveless input → null', () => {
    expect(midiFromVexKey('b')).toBeNull();
    expect(midiFromVexKey('')).toBeNull();
    expect(midiFromVexKey(null)).toBeNull();
  });
});

describe('octaveFromMidi', () => {
  test('C4 = 60 → "4", E2 = 40 → "2", E4 = 64 → "4"', () => {
    expect(octaveFromMidi(60)).toBe('4');
    expect(octaveFromMidi(40)).toBe('2');
    expect(octaveFromMidi(64)).toBe('4');
  });
  test('B3 = 59 → "3" (octave boundary at C)', () => {
    expect(octaveFromMidi(59)).toBe('3');
  });
  test('non-number → null', () => {
    expect(octaveFromMidi(undefined)).toBeNull();
  });
});

describe('noteSetOf', () => {
  test('keeps name+octave, dedupes same pitch, preserves first-seen order', () => {
    expect(noteSetOf([
      { name: 'C', midi: 60 }, { name: 'E', midi: 64 },
      { name: 'C', midi: 60 }, { name: 'C', midi: 72 },
    ])).toEqual([
      { name: 'C', octave: '4' }, { name: 'E', octave: '4' }, { name: 'C', octave: '5' },
    ]);
  });
  test('ignores entries without a name; null/empty → []', () => {
    expect(noteSetOf([{ name: 'C', midi: 60 }, {}, { name: null, midi: 1 }]))
      .toEqual([{ name: 'C', octave: '4' }]);
    expect(noteSetOf(null)).toEqual([]);
  });
});

describe('eventsOf', () => {
  test('keeps midi+onset+duration in onset order, drops non-numeric midi, defaults missing beat/dur', () => {
    expect(eventsOf([
      { midi: 64, onsetBeats: 2, durBeats: 1 },
      { midi: 60, onsetBeats: 0, durBeats: 2 },
      { midi: 67, onsetBeats: 0 },            // shares onset 0 → same beat (chord); dur defaults to 1
      {}, { midi: null, onsetBeats: 1 },      // dropped (no numeric midi)
    ])).toEqual([
      { midi: 60, beat: 0, durBeats: 2 },
      { midi: 67, beat: 0, durBeats: 1 },
      { midi: 64, beat: 2, durBeats: 1 },
    ]);
    expect(eventsOf(null)).toEqual([]);
  });
});

import { stepWindowAnchors } from './music-render.js';

describe('stepWindowAnchors', () => {
  const n = 10;
  test('moveRight slides both, fixed width; clamps at the end', () => {
    expect(stepWindowAnchors(2, 4, n, 'moveRight')).toEqual({ a: 3, b: 5 });
    expect(stepWindowAnchors(7, 9, n, 'moveRight')).toEqual({ a: 7, b: 9 }); // b at last → no move
  });
  test('moveLeft slides both; clamps at the start', () => {
    expect(stepWindowAnchors(2, 4, n, 'moveLeft')).toEqual({ a: 1, b: 3 });
    expect(stepWindowAnchors(0, 3, n, 'moveLeft')).toEqual({ a: 0, b: 3 }); // a at 0 → no move
  });
  test('expand grows at the end, then falls back to the start edge', () => {
    expect(stepWindowAnchors(2, 4, n, 'expand')).toEqual({ a: 2, b: 5 });
    expect(stepWindowAnchors(3, 9, n, 'expand')).toEqual({ a: 2, b: 9 }); // b at last → grow start
    expect(stepWindowAnchors(0, 9, n, 'expand')).toEqual({ a: 0, b: 9 }); // already full
  });
  test('shrink shrinks at the end but never below one note', () => {
    expect(stepWindowAnchors(2, 4, n, 'shrink')).toEqual({ a: 2, b: 3 });
    expect(stepWindowAnchors(5, 5, n, 'shrink')).toEqual({ a: 5, b: 5 }); // single note → stays
  });
  test('normalizes a reversed range before stepping', () => {
    expect(stepWindowAnchors(6, 3, n, 'moveRight')).toEqual({ a: 4, b: 7 });
  });
});

import { stepWindowToBand } from './music-render.js';

describe('stepWindowToBand', () => {
  // 9 notes across 3 lines: band 0 = idx0-2, band 1 = idx3-5, band 2 = idx6-8.
  const bandOf = [0, 0, 0, 1, 1, 1, 2, 2, 2];
  test('moveDown jumps to the next line at the same position-in-line, keeping width', () => {
    expect(stepWindowToBand(bandOf, 0, 1, +1)).toEqual({ a: 3, b: 4 }); // line0 pos0 → line1 pos0
    expect(stepWindowToBand(bandOf, 1, 2, +1)).toEqual({ a: 4, b: 5 }); // pos1 preserved
  });
  test('moveUp jumps to the previous line', () => {
    expect(stepWindowToBand(bandOf, 4, 5, -1)).toEqual({ a: 1, b: 2 });
  });
  test('no line in that direction → unchanged', () => {
    expect(stepWindowToBand(bandOf, 0, 1, -1)).toEqual({ a: 0, b: 1 }); // already top line
    expect(stepWindowToBand(bandOf, 6, 7, +1)).toEqual({ a: 6, b: 7 }); // already bottom line
  });
  test('clamps position when the target line is shorter', () => {
    const ragged = [0, 0, 0, 0, 1, 1]; // line0 has 4, line1 has 2
    expect(stepWindowToBand(ragged, 3, 3, +1)).toEqual({ a: 5, b: 5 }); // pos3 → clamp to last (pos1)
  });
  test('empty input is safe', () => {
    expect(stepWindowToBand([], 0, 0, +1)).toEqual({ a: 0, b: 0 });
  });
});

import { swapOverlayLayer } from './music-render.js';
import { svgHtmlLabel } from './music-render.js';

describe('svgHtmlLabel', () => {
  // Labels are HTML in a <foreignObject> (not SVG <text>) so glyphs don't collapse on Android/Blink
  // after OSMD's font loads. These pin the structure + positioning the renderer relies on.
  test('wraps the text in a foreignObject > div with the given text', () => {
    const fo = svgHtmlLabel(document, { x: 10, y: 20, fontSize: 9, text: 'Emin+9' });
    expect(fo.tagName.toLowerCase()).toBe('foreignobject');
    const div = fo.firstChild;
    expect(div.tagName.toLowerCase()).toBe('div');
    expect(div.textContent).toBe('Emin+9');
    expect(fo.querySelector('text')).toBeNull();   // must NOT be an SVG <text>
  });

  test("anchor 'start' puts the box left edge at x; baseline maps to box top", () => {
    const fo = svgHtmlLabel(document, { x: 50, y: 30, fontSize: 9, anchor: 'start', text: 'C' });
    expect(Number(fo.getAttribute('x'))).toBe(50);
    expect(Number(fo.getAttribute('y'))).toBe(30 - 9);   // y is the baseline → box top = y - fontSize
  });

  test("anchor 'middle' centres the box on x", () => {
    const fo = svgHtmlLabel(document, { x: 100, y: 30, fontSize: 7, anchor: 'middle', text: 'C4' });
    const w = Number(fo.getAttribute('width'));
    expect(Number(fo.getAttribute('x'))).toBe(100 - w / 2);
    expect(fo.firstChild.getAttribute('style')).toContain('text-align:center');
  });

  test('applies font-size and caller css to the div', () => {
    const fo = svgHtmlLabel(document, { x: 0, y: 0, fontSize: 11, css: 'color:#c62828;font-weight:700;', text: 'G' });
    const style = fo.firstChild.getAttribute('style');
    expect(style).toContain('font-size:11px');
    expect(style).toContain('color:#c62828');
    expect(style).toContain('font-weight:700');
  });
});

describe('swapOverlayLayer', () => {
  const SVG_NS = 'http://www.w3.org/2000/svg';
  const mkSvg = () => document.createElementNS(SVG_NS, 'svg');

  test('builds a fresh layer and returns true on success', () => {
    const svg = mkSvg();
    const ok = swapOverlayLayer(svg, 'lyr', (layer) => {
      const t = document.createElementNS(SVG_NS, 'text'); t.textContent = 'A'; layer.appendChild(t);
    });
    expect(ok).toBe(true);
    expect(svg.querySelectorAll('g.lyr').length).toBe(1);
    expect(svg.querySelector('g.lyr text').textContent).toBe('A');
  });

  test('a throwing build leaves the PREVIOUS layer intact and returns false', () => {
    const svg = mkSvg();
    swapOverlayLayer(svg, 'lyr', (layer) => { const t = document.createElementNS(SVG_NS, 'text'); t.textContent = 'first'; layer.appendChild(t); });
    const ok = swapOverlayLayer(svg, 'lyr', () => { throw new Error('getBBox boom'); });
    expect(ok).toBe(false);
    expect(svg.querySelectorAll('g.lyr').length).toBe(1);                 // still exactly one
    expect(svg.querySelector('g.lyr text').textContent).toBe('first');   // the OLD one — not blanked
  });

  test('a successful build replaces the old layer (no accumulation)', () => {
    const svg = mkSvg();
    swapOverlayLayer(svg, 'lyr', (l) => { const t = document.createElementNS(SVG_NS, 'text'); t.textContent = '1'; l.appendChild(t); });
    swapOverlayLayer(svg, 'lyr', (l) => { const t = document.createElementNS(SVG_NS, 'text'); t.textContent = '2'; l.appendChild(t); });
    expect(svg.querySelectorAll('g.lyr').length).toBe(1);
    expect(svg.querySelector('g.lyr text').textContent).toBe('2');
  });
});

describe('highlightExtraNotes persistence', () => {
  // OSMD's Pitch surface pitchClassFromPitch + the MIDI derivation rely on.
  class FakePitch {
    constructor(halfTone) { this.FundamentalNote = 0; this.Accidental = 0; this._h = halfTone; }
    getHalfTone() { return this._h; }
    static getNoteEnumString() { return 'C'; }
    static accidentalVexflow() { return ''; }
  }

  // Fake OSMD whose render() REBUILDS the notehead SVG (fresh, default-colored <path>) — exactly
  // what OSMD's deferred/font-load re-render does, wiping any paint we applied directly.
  function fakeGraphicOsmd() {
    const gnote = {
      vfnote: [{ attrs: { el: null }, keys: ['c/4'] }],
      vfnoteIndex: 0,
      sourceNote: { Pitch: new FakePitch(48) },   // C4 → MIDI 60
    };
    const measure = { parentSourceMeasure: { MeasureNumber: 1 },
      staffEntries: [{ graphicalVoiceEntries: [{ notes: [gnote] }] }] };
    function rebuildNotehead() {
      const root = document.createElement('div');
      const head = document.createElement('span'); head.setAttribute('class', 'vf-notehead');
      const path = document.createElement('path'); path.setAttribute('fill', '#000000');
      head.appendChild(path); root.appendChild(head);
      document.body.appendChild(root);              // connected → not skipped by the isConnected guard
      gnote.vfnote[0].attrs.el = root;
    }
    return {
      calls: [], Zoom: 1, Sheet: { SourceMeasures: [{}] },
      graphic: { measureList: [[measure]] },
      setOptions(o) { this.calls.push(['setOptions', o]); },
      load() { this.calls.push(['load']); return Promise.resolve(); },
      render() { this.calls.push(['render']); rebuildNotehead(); },
      _gnote: gnote,
    };
  }
  const fillOf = (osmd) => osmd._gnote.vfnote[0].attrs.el.querySelector('path').getAttribute('fill');

  test('re-applies the added-note color after a re-render wipes the SVG', async () => {
    const osmd = fakeGraphicOsmd();
    const r = createMusicRenderer(document.createElement('div'), { osmdFactory: () => osmd });
    await r.loadDetail({ format: 'musicxml', source: '<xml/>' });
    const n = r.highlightExtraNotes([{ measure: 1, midi: 60 }], '#C62828');
    expect(n).toBe(1);
    expect(fillOf(osmd)).toBe('#C62828');
    // OSMD fires a deferred render (post-construction ~1ms / font load) that rebuilds the notehead.
    osmd.render();
    expect(fillOf(osmd)).toBe('#C62828');   // must be re-applied, not left default
  });

  test('loading a new piece drops stale added-note marks', async () => {
    const osmd = fakeGraphicOsmd();
    const r = createMusicRenderer(document.createElement('div'), { osmdFactory: () => osmd });
    await r.loadDetail({ format: 'musicxml', source: '<a/>' });
    r.highlightExtraNotes([{ measure: 1, midi: 60 }], '#C62828');
    await r.loadDetail({ format: 'musicxml', source: '<b/>' });   // fresh piece — no marks
    osmd.render();
    expect(fillOf(osmd)).toBe('#000000');
  });
});
