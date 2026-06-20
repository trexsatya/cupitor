import { measureRangeFromNoteRange } from './music-render.js';
import { collapsedChordSpans } from './music-render.js';
import { measureRangeFromChordMatch } from './music-render.js';
import { responsiveZoom } from './music-render.js';
import { createMusicRenderer } from './music-render.js';
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
  test('multi-voice: returns a non-inverted covering range (regression)', () => {
    // voice 2 measures are not globally monotonic vs voice 1; the old endpoint-only
    // logic returned an inverted/shrunk [1,2]. Covering min/max must give [1,3].
    const d = { voices: [
      { chordSymbol: ['C', 'C', 'G', 'Am'], measureIndex: [1, 1, 2, 3], pitch: [1, 2, 3, 4], interval: [], sargam: [], duration: [], lyric: [] },
      { chordSymbol: ['Am', 'F'],           measureIndex: [1, 2],       pitch: [9, 9],       interval: [], sargam: [], duration: [], lyric: [] }
    ]};
    const r = measureRangeFromChordMatch(d, [0, 3]);
    expect(r[0]).toBeLessThanOrEqual(r[1]);   // never inverted
    expect(r).toEqual([1, 3]);
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
    expect(osmd.calls[0]).toEqual(['setOptions', { backend: 'svg', drawingParameters: 'compacttight', drawTitle: false }]);
  });

  test('loadDetail loads musicxml source, renders, reports total measures', async () => {
    const osmd = fakeOsmd();
    const r = createMusicRenderer({}, { osmdFactory: () => osmd });
    const res = await r.loadDetail({ format: 'musicxml', source: '<xml/>' });
    expect(res).toEqual({ ok: true, totalMeasures: 4 });
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
