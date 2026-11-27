import { measureBeatCounters, beatX, beatCounterLayout, copyBeatCounterEdits } from './music-beats.js';
import { createMusicRenderer } from './music-render.js';
import { createMusicStore } from './music-local-store.js';
import { indexedDB } from 'fake-indexeddb';

test.each([[4, 4, 4], [3, 4, 3], [6, 8, 6], [2, 2, 2], [5, 8, 5]])(
  '%i/%i counts time-signature units', (numerator, denominator, count) => {
    const rows = measureBeatCounters({ measure: 1, numerator, denominator, duration: numerator * 4 / denominator });
    expect(rows.map(r => r.label)).toEqual(Array.from({ length: count }, (_, i) => String(i + 1)));
    expect(rows[1].beat).toBeCloseTo(4 / denominator);
  });

test('pickup, off-beat pickup and short final bar have distinct counting', () => {
  expect(measureBeatCounters({ measure: 1, duration: 1, pickup: true }).map(r => [r.label, r.beat])).toEqual([['4', 0]]);
  expect(measureBeatCounters({ measure: 1, duration: 1.5, pickup: true }).map(r => [r.label, r.beat])).toEqual([['3.5', 0], ['4', .5]]);
  expect(measureBeatCounters({ measure: 8, duration: 2 }).map(r => r.label)).toEqual(['1', '2']);
});

test('beat positions follow uneven engraved anchors and interpolate sustained notes', () => {
  const anchors = [{ beat: 0, x: 30 }, { beat: .5, x: 60 }, { beat: 1, x: 90 }, { beat: 3, x: 150 }, { beat: 4, x: 210 }];
  expect(beatX(1, anchors)).toBe(90);
  expect(beatX(2, anchors)).toBe(120);
  expect(beatX(3.5, anchors)).toBe(180);
});

function fixture() {
  const host = document.createElement('div'); document.body.appendChild(host);
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); host.appendChild(svg);
  const source = (number, duration, numerator = 4, denominator = 4) => ({
    MeasureNumber: number, Duration: { RealValue: duration / 4 }, ActiveTimeSignature: { Numerator: numerator, Denominator: denominator },
  });
  const sources = [source(0, 1), source(1, 4), source(2, 3, 3)];
  const staff = (sm, times, bottom = 100, rest = false) => ({
    parentSourceMeasure: sm,
    stave: { getNoteStartX: () => 15, getNoteEndX: () => 215, getBottomLineY: () => bottom },
    staffEntries: times.map(([beat, x]) => {
      const el = document.createElementNS(svg.namespaceURI, 'g');
      const head = document.createElementNS(svg.namespaceURI, 'g'); head.setAttribute('class', 'vf-notehead');
      head.getBBox = () => ({ x: x - 5, y: 0, width: 10, height: 10 }); el.appendChild(head); svg.appendChild(el);
      return { relInMeasureTimestamp: { RealValue: beat / 4 }, graphicalVoiceEntries: [{ notes: [{
        sourceNote: { isWholeRest: () => rest }, vfnote: [{ attrs: { el } }],
      }] }] };
    }),
  });
  const list = [
    [staff(sources[0], [[0, 30]])],
    [staff(sources[1], [[0, 30], [1, 80], [2, 140]]), staff(sources[1], [[0, 30]], 180)],
    [staff(sources[2], [[0, 100]], 180, true)],
  ];
  return { host, svg, sources, osmd: { Sheet: { SourceMeasures: sources }, graphic: { measureList: list } } };
}
afterEach(() => { document.body.innerHTML = ''; });

test('layout includes pickup 0, changing meters, rests and a single row under both staves', () => {
  const { host, osmd } = fixture();
  const rows = beatCounterLayout(osmd, host);
  expect(rows.map(r => `${r.measure}:${r.label}`)).toEqual(['1:4', '2:1', '2:2', '2:3', '2:4', '3:1', '3:2', '3:3']);
  expect(rows.find(r => r.key === '2:2').x).toBe(80);
  expect(rows.find(r => r.key === '2:1').y).toBe(198);
  // A centered whole-bar rest must not pull count 1 into the middle of the bar.
  expect(rows.find(r => r.key === '3:1').x).toBe(20);
  expect(beatCounterLayout(osmd, host, { from: 3, to: 3 }).map(r => r.label)).toEqual(['1', '2', '3']);
});

test('undrawn measures and stale DOM entries cannot create phantom labels', () => {
  const { host, svg, osmd } = fixture();
  svg.remove();
  expect(beatCounterLayout(osmd, host)).toEqual([]);
});

test('each page owns its count row', () => {
  const { host, svg, osmd } = fixture();
  const second = document.createElementNS(svg.namespaceURI, 'svg'); host.appendChild(second);
  const entry = osmd.graphic.measureList[2][0].staffEntries[0];
  second.appendChild(entry.graphicalVoiceEntries[0].notes[0].vfnote[0].attrs.el);
  const rows = beatCounterLayout(osmd, host);
  expect(rows.filter(r => r.svg === svg)).toHaveLength(5);
  expect(rows.filter(r => r.svg === second).map(r => r.key)).toEqual(['3:1', '3:2', '3:3']);
});

test('dragging stores score-space offsets, including at a different screen zoom', async () => {
  const { host, svg, osmd } = fixture();
  Object.assign(osmd, { setOptions: jest.fn(), load: jest.fn(), render: jest.fn() });
  svg.getScreenCTM = () => ({ inverse: () => ({}) });
  svg.createSVGPoint = () => ({ x: 0, y: 0, matrixTransform() { return { x: this.x * 2, y: this.y * 2 }; } });
  const changed = jest.fn();
  const renderer = createMusicRenderer(host, { osmdFactory: () => osmd, onBeatCountersChange: changed });
  await renderer.loadDetail({ format: 'musicxml', source: '<score-partwise/>' });
  renderer.setBeatCounterEditing(true);
  host.querySelector('[data-counter-key="2:2"]').firstChild.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, button: 0, clientX: 50, clientY: 50 }));
  document.dispatchEvent(new MouseEvent('pointermove', { clientX: 60, clientY: 45 }));
  document.dispatchEvent(new MouseEvent('pointerup', { clientX: 60, clientY: 45 }));
  expect(renderer.getBeatCounters()).toEqual({ '2:2': { dx: 20, dy: -10 } });
  expect(changed).toHaveBeenCalledTimes(1);
  expect(renderer.getSelectedBeatCounter()).toMatchObject({ key: '2:2', dx: 20, dy: -10 });
});

test('manual edits survive redraw and reload, can be hidden, and reset to automatic', async () => {
  const { host, osmd } = fixture();
  Object.assign(osmd, { setOptions: jest.fn(), load: jest.fn(), render: jest.fn() });
  const changed = jest.fn(), selected = jest.fn();
  const renderer = createMusicRenderer(host, { osmdFactory: () => osmd,
    onBeatCountersChange: changed, onBeatCounterSelect: selected });
  const detail = { format: 'musicxml', source: '<score-partwise/>', beatCounters: { '2:2': { label: 'two', dx: 7, dy: -4 } } };
  await renderer.loadDetail(detail);
  const label = () => host.querySelector('[data-counter-key="2:2"]');
  expect(label().textContent).toBe('two');
  expect(label().querySelector('[role=button]')).toBeNull();
  renderer.setBeatCounterEditing(true);
  label().firstChild.click();
  expect(renderer.getSelectedBeatCounter()).toMatchObject({ key: '2:2', label: 'two', dx: 7 });
  renderer.updateBeatCounter('2:2', { label: '2 &', dx: 12, dy: 6, hidden: true });
  const saved = renderer.getBeatCounters();
  renderer.setBeatCounterEditing(false);
  expect(label()).toBeNull();
  renderer.setZoom(.6);
  renderer.setBeatCounterEditing(true);
  expect(label().textContent).toBe('2 &');
  expect(Number(label().getAttribute('x')) + Number(label().getAttribute('width')) / 2).toBe(92);
  await renderer.loadDetail({ ...detail, beatCounters: saved });
  expect(renderer.getBeatCounters()).toEqual(saved);
  renderer.resetBeatCounter('2:2');
  expect(label().textContent).toBe('2');
  expect(changed).toHaveBeenLastCalledWith({});
  renderer.setBeatCounters(false);
  expect(host.querySelector('.beat-counter-layer')).toBeNull();
  renderer.setBeatCounters(true);
  expect(label().textContent).toBe('2');
  await renderer.loadDetail({ ...detail, beatCounters: undefined });
  expect(renderer.getBeatCounters()).toEqual({});
});

test('manual edits are copied and invalid offsets discarded', () => {
  const input = { '2:1': { label: '<b>1</b>', dx: 3, dy: NaN, hidden: true } };
  const copy = copyBeatCounterEdits(input); copy['2:1'].dx = 4;
  expect(input['2:1'].dx).toBe(3);
  expect(copy['2:1'].dy).toBeUndefined();
});

test('piece storage round-trip preserves overrides without leaking them to another piece', async () => {
  const store = createMusicStore({ indexedDB });
  const edits = { '1:4': { label: '4', dx: -8, dy: 6 }, '2:2': { hidden: true } };
  await store.putPieces('western', [
    { entry: { id: 'counted-piece' }, detail: { source: 'xml', beatCounters: edits } },
    { entry: { id: 'other-piece' }, detail: { source: 'xml' } },
  ]);
  expect((await store.getDetail('western', 'counted-piece')).beatCounters).toEqual(edits);
  expect((await store.getDetail('western', 'other-piece')).beatCounters).toBeUndefined();
});

test('vendored OSMD uses sequential edit keys even when its pickup is measure zero', async () => {
  // Exercise the real model and SVG output, rather than assuming the shape of
  // OSMD timestamps/rest flags. Only text metrics and browser SVG bounds are stubbed.
  const canvas = jest.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    font: '', measureText: text => ({ width: String(text).length * 6 }),
  });
  const oldBox = SVGElement.prototype.getBBox;
  SVGElement.prototype.getBBox = () => ({ x: 20, y: 0, width: 10, height: 10 });
  const host = document.createElement('div'); document.body.appendChild(host);
  Object.defineProperty(host, 'offsetWidth', { value: 900 });
  const { OpenSheetMusicDisplay } = require('./vendor/opensheetmusicdisplay.min.js');
  const osmd = new OpenSheetMusicDisplay(host, { backend: 'svg', autoResize: false });
  try {
    await osmd.load(`<?xml version="1.0"?><score-partwise version="3.1">
      <part-list><score-part id="P1"><part-name>Piano</part-name></score-part></part-list><part id="P1">
      <measure number="0" implicit="yes"><attributes><divisions>4</divisions>
      <time><beats>4</beats><beat-type>4</beat-type></time><clef><sign>G</sign><line>2</line></clef></attributes>
      <note><pitch><step>C</step><octave>4</octave></pitch><duration>4</duration><type>quarter</type></note></measure>
      <measure number="1"><note><rest measure="yes"/><duration>16</duration></note></measure>
      </part></score-partwise>`);
    osmd.render();
    expect(osmd.Sheet.SourceMeasures[0].MeasureNumber).toBe(0);
    const rows = beatCounterLayout(osmd, host);
    expect(rows.map(r => `${r.measure}:${r.label}`)).toEqual(['1:4', '2:1', '2:2', '2:3', '2:4']);
    const rest = osmd.graphic.measureList[1][0];
    expect(rows.find(r => r.key === '2:1').x).toBe(rest.stave.getNoteStartX() + 5);
  } finally {
    osmd.clear(); canvas.mockRestore();
    if (oldBox) SVGElement.prototype.getBBox = oldBox; else delete SVGElement.prototype.getBBox;
  }
});
