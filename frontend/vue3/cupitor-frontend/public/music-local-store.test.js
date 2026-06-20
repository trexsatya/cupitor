// public/music-local-store.test.js
import { IDBFactory } from 'fake-indexeddb';
import { createMusicStore } from './music-local-store.js';

// Fresh isolated IndexedDB per store instance.
function freshStore() {
  return createMusicStore({ indexedDB: new IDBFactory() });
}

const entryA = { id: 'a', title: 'A', contentHash: 'h1', search: { chords: 'C' } };
const entryB = { id: 'b', title: 'B', contentHash: 'h2', search: { chords: 'G' } };
const detailA = { meta: { id: 'a' }, voices: [], format: 'musicxml', source: '<a/>' };
const detailB = { meta: { id: 'b' }, voices: [], format: 'note-text', source: 'b' };

describe('createMusicStore', () => {
  test('putPieces then getEntries returns entries with synced:false', async () => {
    const store = freshStore();
    await store.putPieces('western', [{ entry: entryA, detail: detailA }]);
    const rows = await store.getEntries('western');
    expect(rows).toEqual([{ entry: entryA, synced: false }]);
  });

  test('getDetail returns the stored detail, null when absent', async () => {
    const store = freshStore();
    await store.putPieces('western', [{ entry: entryA, detail: detailA }]);
    expect(await store.getDetail('western', 'a')).toEqual(detailA);
    expect(await store.getDetail('western', 'missing')).toBeNull();
  });

  test('systems are isolated (same id, different system)', async () => {
    const store = freshStore();
    await store.putPieces('western', [{ entry: entryA, detail: detailA }]);
    await store.putPieces('sargam', [{ entry: { ...entryA, title: 'A-sargam' }, detail: detailB }]);
    const w = await store.getEntries('western');
    const s = await store.getEntries('sargam');
    expect(w).toHaveLength(1);
    expect(s).toHaveLength(1);
    expect(w[0].entry.title).toBe('A');
    expect(s[0].entry.title).toBe('A-sargam');
    expect(await store.getDetail('sargam', 'a')).toEqual(detailB);
  });

  test('putPieces overwrites an existing id and resets synced:false', async () => {
    const store = freshStore();
    await store.putPieces('western', [{ entry: entryA, detail: detailA }]);
    await store.markSynced('western', ['a']);
    expect((await store.getEntries('western'))[0].synced).toBe(true);
    const entryA2 = { ...entryA, contentHash: 'h1b' };
    await store.putPieces('western', [{ entry: entryA2, detail: detailA }]);
    const rows = await store.getEntries('western');
    expect(rows).toHaveLength(1);
    expect(rows[0].entry.contentHash).toBe('h1b');
    expect(rows[0].synced).toBe(false);
  });

  test('markSynced flips only the named ids', async () => {
    const store = freshStore();
    await store.putPieces('western', [
      { entry: entryA, detail: detailA },
      { entry: entryB, detail: detailB },
    ]);
    await store.markSynced('western', ['a']);
    const rows = await store.getEntries('western');
    const byId = Object.fromEntries(rows.map(r => [r.entry.id, r.synced]));
    expect(byId).toEqual({ a: true, b: false });
  });

  test('getUnpushed returns only synced:false records paired with their detail', async () => {
    const store = freshStore();
    await store.putPieces('western', [
      { entry: entryA, detail: detailA },
      { entry: entryB, detail: detailB },
    ]);
    await store.markSynced('western', ['a']);
    const unpushed = await store.getUnpushed('western');
    expect(unpushed).toEqual([{ entry: entryB, detail: detailB }]);
  });

  test('putVocab then getVocab round-trips per system; missing system → []', async () => {
    const store = freshStore();
    const vocab = [{ id: 'x_1_2', category: 'licks' }];
    await store.putVocab('western', vocab);
    expect(await store.getVocab('western')).toEqual(vocab);
    expect(await store.getVocab('sargam')).toEqual([]);   // isolated per system
  });
});
