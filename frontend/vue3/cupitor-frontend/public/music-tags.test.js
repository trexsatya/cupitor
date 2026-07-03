import { tagColor, noteId, addTag, removeTag, colorMap, mergeRegistry, indexAssignments, firstTagForKey, revealedTagForKey, toggleNote, noteStyle, TAG_PALETTE } from './music-tags.js';

const id = (measure, midi, beats) => ({ measure, midi, beats });

describe('tagColor', () => {
  test('cycles the palette', () => {
    expect(tagColor(0)).toBe(TAG_PALETTE[0]);
    expect(tagColor(TAG_PALETTE.length)).toBe(TAG_PALETTE[0]);
    expect(tagColor(1)).toBe(TAG_PALETTE[1]);
  });
});

describe('noteId', () => {
  test('matches the measure:midi:beats shape with fixed beat precision', () => {
    expect(noteId(id(3, 60, 1.5))).toBe('3:60:1.500000');
  });
});

describe('registry: addTag / removeTag / colorMap', () => {
  test('addTag adds with the next palette color', () => {
    const { registry, added } = addTag([], 'riff');
    expect(added).toBe(true);
    expect(registry).toEqual([{ name: 'riff', color: TAG_PALETTE[0] }]);
  });
  test('addTag is a no-op for a duplicate or blank name, and trims', () => {
    const base = [{ name: 'riff', color: '#x' }];
    expect(addTag(base, 'riff').added).toBe(false);
    expect(addTag(base, '   ').added).toBe(false);
    expect(addTag([], '  lick  ').registry[0].name).toBe('lick');
  });
  test('removeTag drops the named tag', () => {
    expect(removeTag([{ name: 'a', color: '#1' }, { name: 'b', color: '#2' }], 'a').map((t) => t.name)).toEqual(['b']);
  });
  test('colorMap maps name → color', () => {
    expect(colorMap([{ name: 'a', color: '#1' }, { name: 'b', color: '#2' }])).toEqual({ a: '#1', b: '#2' });
  });
});

describe('mergeRegistry', () => {
  test('adds tag names used by a piece that are missing from the registry', () => {
    const reg = mergeRegistry([{ name: 'a', color: '#aa' }], [{ name: 'a', notes: [] }, { name: 'b', notes: [] }]);
    expect(reg.map((t) => t.name)).toEqual(['a', 'b']);
    expect(reg[0].color).toBe('#aa');                 // existing color preserved
    expect(reg[1].color).toBe(tagColor(1));           // new gets next palette color
  });
  test('honours a legacy color carried on a pattern', () => {
    const reg = mergeRegistry([], [{ name: 'c', color: '#legacy', notes: [] }]);
    expect(reg).toEqual([{ name: 'c', color: '#legacy' }]);
  });
});

describe('assignments: toggleNote / firstTagForKey', () => {
  test('toggleNote creates the assignment entry on first paint, then adds/removes', () => {
    let a = toggleNote([], 'riff', id(1, 60, 0));
    expect(a).toEqual([{ name: 'riff', notes: [{ measure: 1, midi: 60, beats: 0 }] }]);
    a = toggleNote(a, 'riff', id(2, 62, 0));
    expect(a[0].notes).toHaveLength(2);
    a = toggleNote(a, 'riff', id(1, 60, 0));          // remove
    expect(a[0].notes).toEqual([{ measure: 2, midi: 62, beats: 0 }]);
  });
  test('firstTagForKey returns the first tag name (by order) containing the key', () => {
    const indexed = indexAssignments([
      { name: 'a', notes: [id(1, 60, 0)] },
      { name: 'b', notes: [id(1, 60, 0), id(2, 62, 0)] },
    ]);
    expect(firstTagForKey(indexed, noteId(id(1, 60, 0)))).toBe('a'); // shared → first wins
    expect(firstTagForKey(indexed, noteId(id(2, 62, 0)))).toBe('b');
    expect(firstTagForKey(indexed, noteId(id(9, 9, 9)))).toBeNull();
  });
});

describe('noteStyle', () => {
  const indexed = indexAssignments([
    { name: 'a', notes: [id(1, 60, 0)] },
    { name: 'b', notes: [id(2, 62, 0)] },
  ]);
  const colorOf = (n) => ({ a: '#aa', b: '#bb' }[n]);
  test('filter off: tagged notes get their registry color, untagged get none, nothing dims', () => {
    expect(noteStyle(indexed, noteId(id(1, 60, 0)), false, null, colorOf)).toEqual({ color: '#aa', dim: false });
    expect(noteStyle(indexed, noteId(id(9, 9, 9)), false, null, colorOf)).toEqual({ color: null, dim: false });
  });
  test('filter on: selected tag stays colored; everything else dims', () => {
    const sel = new Set(['a']);
    expect(noteStyle(indexed, noteId(id(1, 60, 0)), true, sel, colorOf)).toEqual({ color: '#aa', dim: false });
    expect(noteStyle(indexed, noteId(id(2, 62, 0)), true, sel, colorOf)).toEqual({ color: null, dim: true });
    expect(noteStyle(indexed, noteId(id(9, 9, 9)), true, sel, colorOf)).toEqual({ color: null, dim: true });
  });

  test('overlapping tags: a note shared with an EARLIER tag still lights for the revealed one', () => {
    // 'first' claims the note before 'second' does; revealing only 'second' must still light it
    // (regression: firstTagForKey attributed it to 'first' → the note wrongly stayed dimmed).
    const shared = indexAssignments([
      { name: 'first', notes: [id(2, 64, 4.5), id(2, 67, 5)] },
      { name: 'second', notes: [id(2, 64, 4.5)] },       // note also in 'first'
    ]);
    const c = (n) => ({ first: '#f1', second: '#f2' }[n]);
    expect(noteStyle(shared, noteId(id(2, 64, 4.5)), true, new Set(['second']), c)).toEqual({ color: '#f2', dim: false });
    // both revealed → earliest-in-order revealed tag colors it (deterministic)
    expect(noteStyle(shared, noteId(id(2, 64, 4.5)), true, new Set(['first', 'second']), c)).toEqual({ color: '#f1', dim: false });
  });
});

describe('revealedTagForKey', () => {
  const indexed = indexAssignments([
    { name: 'a', notes: [id(1, 60, 0)] },
    { name: 'b', notes: [id(1, 60, 0), id(2, 62, 0)] },   // shares note with 'a'
  ]);
  test('honors the allowed set; null allowed → any tag (first wins)', () => {
    expect(revealedTagForKey(indexed, noteId(id(1, 60, 0)), new Set(['b']))).toBe('b'); // skip hidden 'a'
    expect(revealedTagForKey(indexed, noteId(id(1, 60, 0)), new Set(['a', 'b']))).toBe('a'); // earliest revealed
    expect(revealedTagForKey(indexed, noteId(id(1, 60, 0)), new Set())).toBeNull();          // none revealed
    expect(revealedTagForKey(indexed, noteId(id(1, 60, 0)), null)).toBe('a');                // any
  });
});
