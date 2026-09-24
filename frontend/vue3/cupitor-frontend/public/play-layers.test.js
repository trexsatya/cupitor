import { overlappingStack, stackAt, layerLabel, layerPosition } from './play-layers.js';

const box = (id, left, top, w = 10, h = 10, extra = {}) => ({ id, rect: { left, top, width: w, height: h }, ...extra });
const rectOf = o => o.rect;
const ids = list => list.map(o => o.id);

describe('overlappingStack', () => {
  const bg = box('bg', 0, 0, 100, 100);
  const far = box('far', 500, 500);
  const mid = box('mid', 5, 5);
  const top = box('top', 8, 8);
  const objects = [bg, far, mid, top]; // bottom → top

  test('lists the selection and everything overlapping it, topmost first', () => {
    const sel = new Set([top]);
    expect(ids(overlappingStack(objects, [top.rect], rectOf, o => sel.has(o)))).toEqual(['top', 'mid', 'bg']);
  });

  test('with several selected, an object in the gap between them is not listed', () => {
    const a = box('a', 0, 0), b = box('b', 100, 0), gap = box('gap', 50, 0);
    const sel = new Set([a, b]);
    expect(ids(overlappingStack([gap, a, b], [a.rect, b.rect], rectOf, o => sel.has(o)))).toEqual(['b', 'a']);
  });

  test('skips hidden and unpickable objects, but never the selection itself', () => {
    const hidden = box('hidden', 0, 0, 50, 50, { visible: false });
    const locked = box('locked', 0, 0, 50, 50, { selectable: false });
    const selLocked = box('selLocked', 0, 0, 50, 50, { selectable: false });
    const list = [hidden, locked, selLocked];
    expect(ids(overlappingStack(list, [selLocked.rect], rectOf, o => o === selLocked))).toEqual(['selLocked']);
  });
});

describe('layerLabel', () => {
  test('uses text, then sticky inner text, then uid', () => {
    expect(layerLabel({ type: 'textbox', text: 'hello\nworld' })).toBe('textbox: hello world');
    expect(layerLabel({ type: 'group', customData: { type: 'stickyNote' },
      getObjects: () => [{ type: 'rect' }, { type: 'textbox', text: 'note' }] })).toBe('stickyNote: note');
    expect(layerLabel({ type: 'rect', uid: 'abc123456' })).toBe('rect …23456');
  });
});

describe('layerPosition', () => {
  test('counts from the bottom and names the ends', () => {
    const [a, b, c] = [{}, {}, {}];
    expect(layerPosition([a, b, c], [c])).toBe('Layer 3 of 3 · top');
    expect(layerPosition([a, b, c], [b])).toBe('Layer 2 of 3');
    expect(layerPosition([a, b, c], [a])).toBe('Layer 1 of 3 · bottom');
    expect(layerPosition([a, b, c], [a, c])).toBe('2 selected');
  });
});

describe('stackAt', () => {
  test('returns pickable hits topmost first', () => {
    const a = { id: 'a', hit: true }, b = { id: 'b', hit: false }, c = { id: 'c', hit: true },
      hidden = { id: 'hidden', hit: true, visible: false };
    expect(ids(stackAt([a, b, c, hidden], o => o.hit))).toEqual(['c', 'a']);
  });
});
