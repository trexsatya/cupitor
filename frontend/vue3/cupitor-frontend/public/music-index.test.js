// public/music-index.test.js
import { encodeNoteText, primaryVoice } from './music-encoding.js';
import { fnv1a, buildIndexEntry, splitTiers, getSystemFromUrl, getMusicResourceUrl, mergeIndex, rebuildAndPush, computeChanges, mergeLocalRemote, retryPush, filterByTags, removePieceFromLibrary, pushPending } from './music-index.js';

const txt = 'G4# D5# D5 C5#\nB4 C5# B4 A4# G4#';

describe('index assembly', () => {
  test('fnv1a is stable and changes with input', () => {
    expect(fnv1a('abc')).toBe(fnv1a('abc'));
    expect(fnv1a('abc')).not.toBe(fnv1a('abd'));
    expect(typeof fnv1a('abc')).toBe('string');
  });

  test('primaryVoice returns the voice with the most notes', () => {
    const doc = encodeNoteText(txt, { id: 'jethalal_bgm', key: 'G#m' });
    expect(primaryVoice(doc).pitch.length).toBe(9);
  });

  test('buildIndexEntry: metadata + packed search fields + pointer + hash', () => {
    const doc = encodeNoteText(txt, { id: 'jethalal_bgm', title: 'Jethalal BGM', system: 'western', key: 'G#m' });
    const entry = buildIndexEntry(doc, txt);
    expect(entry.id).toBe('jethalal_bgm');
    expect(entry.system).toBe('western');
    expect(entry.format).toBe('note-text');
    expect(entry.noteCount).toBe(9);
    expect(entry.voiceCount).toBe(1);
    expect(entry.channels).toEqual(['pitch', 'interval', 'sargam']);
    expect(entry.search.contour).toBe('7,-1,-1,-2,2,-2,-1,-2');
    expect(entry.detailPath).toBe('details/jethalal_bgm.json');
    expect(entry.contentHash).toBe(fnv1a(txt));
    expect(entry.tags).toEqual([]);   // new pieces start untagged
    expect(entry.guessedKey).toMatch(/^[A-G][#b]? (major|minor)$/);   // Krumhansl guess, e.g. "G# minor"
  });

  test('splitTiers: detail carries voices + inline source', () => {
    const doc = encodeNoteText(txt, { id: 'jethalal_bgm', key: 'G#m' });
    const { entry, detail } = splitTiers(doc, txt);
    expect(entry.id).toBe('jethalal_bgm');
    expect(detail.format).toBe('note-text');
    expect(detail.source).toBe(txt);
    expect(detail.voices[0].pitch.length).toBe(9);
  });
});

describe('system routing (mirrors ?lang=)', () => {
  test('defaults to western when ?system is absent', () => {
    expect(getSystemFromUrl('https://x/music.html').name).toBe('western');
  });
  test('reads ?system=sargam', () => {
    expect(getSystemFromUrl('https://x/music.html?system=sargam').name).toBe('sargam');
  });
  test('resource url points at db/music/<system> on gh-pages', () => {
    expect(getMusicResourceUrl('western'))
      .toBe('https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/music/western');
    expect(getMusicResourceUrl('sargam'))
      .toBe('https://raw.githubusercontent.com/trexsatya/trexsatya.github.io/gh-pages/db/music/sargam');
  });
});

describe('rebuild & push (payload assembly)', () => {
  test('mergeIndex replaces entry by id, keeps others', () => {
    const existing = [{ id: 'a', noteCount: 1 }, { id: 'b', noteCount: 2 }];
    const merged = mergeIndex(existing, [{ id: 'b', noteCount: 99 }, { id: 'c', noteCount: 3 }]);
    expect(merged.find(e => e.id === 'b').noteCount).toBe(99);
    expect(merged.find(e => e.id === 'a').noteCount).toBe(1);
    expect(merged.find(e => e.id === 'c').noteCount).toBe(3);
  });

  test('rebuildAndPush builds index.json + one detail file per changed piece', async () => {
    const calls = [];
    const fakeCommitter = async (files) => { calls.push(files); return { ok: true }; };
    const pieces = [{ id: 'jethalal_bgm', title: 'Jethalal BGM', format: 'note-text',
                      source: 'G4# A4# B4', key: 'G#m' }];
    const result = await rebuildAndPush({
      system: 'western', pieces, currentIndex: [], committer: fakeCommitter, updatedAt: '2026-06-20'
    });
    expect(result.changed).toEqual(['jethalal_bgm']);
    const files = calls[0];
    const paths = files.map(f => f.path);
    expect(paths).toContain('db/music/western/index.json');
    expect(paths).toContain('db/music/western/details/jethalal_bgm.json');
    const idxFile = files.find(f => f.path === 'db/music/western/index.json');
    const idx = JSON.parse(await idxFile.getContent(null));
    expect(idx[0].id).toBe('jethalal_bgm');
    expect(idx[0].updatedAt).toBe('2026-06-20');
  });

  test('rebuildAndPush skips pieces whose contentHash is unchanged', async () => {
    const fakeCommitter = async () => ({ ok: true });
    const src = 'G4# A4# B4';
    const first = await rebuildAndPush({ system: 'western',
      pieces: [{ id: 'x', format: 'note-text', source: src, key: 'C' }],
      currentIndex: [], committer: fakeCommitter });
    const existing = first.index;            // index after first build
    const second = await rebuildAndPush({ system: 'western',
      pieces: [{ id: 'x', format: 'note-text', source: src, key: 'C' }],
      currentIndex: existing, committer: fakeCommitter });
    expect(second.changed).toEqual([]);      // unchanged -> skipped
  });

  test('runs chord inference — entry gains chordSymbol channel + search.chords', async () => {
    const fakeCommitter = async () => ({ ok: true });
    const res = await rebuildAndPush({ system: 'western',
      pieces: [{ id: 'triad', format: 'note-text', source: 'C4 E4 G4', key: 'C' }],
      currentIndex: [], committer: fakeCommitter });
    const entry = res.index.find(e => e.id === 'triad');
    expect(entry.channels).toContain('chordSymbol');
    expect(entry.search.chords).toBe('C');
  });
});

describe('computeChanges (pure)', () => {
  // Tags and the practice note are the user's own metadata: a rebuild re-derives everything else from
  // the source, so anything typed by hand has to be carried over or it is silently lost on re-import.
  test('a rebuild keeps the practice note and the tags', () => {
    const first = computeChanges({
      system: 'western',
      pieces: [{ id: 'triad', format: 'note-text', source: 'C4 E4 G4', key: 'C' }],
      currentIndex: [], updatedAt: '2026-06-20',
    });
    const edited = first.index.map((e) => ({ ...e, tags: ['warmup'], note: 'slow the last bar' }));
    const again = computeChanges({
      system: 'western',
      pieces: [{ id: 'triad', format: 'note-text', source: 'C4 E4 G4 B4', key: 'C' }],   // source changed
      currentIndex: edited, updatedAt: '2026-06-21',
    });
    const entry = again.index.find((e) => e.id === 'triad');
    expect(entry.note).toBe('slow the last bar');
    expect(entry.tags).toEqual(['warmup']);
  });

  test('a fresh piece starts with an empty note', () => {
    const { index } = computeChanges({
      system: 'western',
      pieces: [{ id: 'triad2', format: 'note-text', source: 'C4 E4 G4', key: 'C' }],
      currentIndex: [], updatedAt: '2026-06-20',
    });
    expect(index.find((e) => e.id === 'triad2').note).toBe('');
  });

  test('returns changed ids, paired entry+detail, and merged index', () => {
    const { changed, changedPieces, index } = computeChanges({
      system: 'western',
      pieces: [{ id: 'triad', format: 'note-text', source: 'C4 E4 G4', key: 'C' }],
      currentIndex: [], updatedAt: '2026-06-20',
    });
    expect(changed).toEqual(['triad']);
    expect(changedPieces).toHaveLength(1);
    expect(changedPieces[0].entry.id).toBe('triad');
    expect(changedPieces[0].entry.system).toBe('western');
    expect(changedPieces[0].entry.updatedAt).toBe('2026-06-20');
    expect(changedPieces[0].detail.format).toBe('note-text');
    expect(index.find(e => e.id === 'triad')).toBeTruthy();
  });

  test('skips a piece whose contentHash is unchanged, unless force', () => {
    const args = {
      system: 'western',
      pieces: [{ id: 'x', format: 'note-text', source: 'C4 E4 G4', key: 'C' }],
      currentIndex: [],
    };
    const first = computeChanges(args);
    const second = computeChanges({ ...args, currentIndex: first.index });
    expect(second.changed).toEqual([]);
    const forced = computeChanges({ ...args, currentIndex: first.index, force: true });
    expect(forced.changed).toEqual(['x']);
  });
});

describe('mergeLocalRemote (pure)', () => {
  const remote = [{ id: 'a', title: 'A-remote' }, { id: 'b', title: 'B-remote' }];

  test('remote-only: passes through, no unpushed', () => {
    const { index, unpushedIds } = mergeLocalRemote(remote, []);
    expect(index.map(e => e.id).sort()).toEqual(['a', 'b']);
    expect(unpushedIds.size).toBe(0);
  });

  test('local unpushed overrides remote and is flagged', () => {
    const local = [{ entry: { id: 'a', title: 'A-local' }, synced: false }];
    const { index, unpushedIds } = mergeLocalRemote(remote, local);
    expect(index.find(e => e.id === 'a').title).toBe('A-local');
    expect(unpushedIds.has('a')).toBe(true);
    expect(unpushedIds.size).toBe(1);
  });

  test('local synced absent from remote is included as pushed', () => {
    const local = [{ entry: { id: 'c', title: 'C-local' }, synced: true }];
    const { index, unpushedIds } = mergeLocalRemote(remote, local);
    expect(index.map(e => e.id).sort()).toEqual(['a', 'b', 'c']);
    expect(unpushedIds.size).toBe(0);
  });

  test('local synced already in remote: remote wins, not flagged', () => {
    const local = [{ entry: { id: 'a', title: 'A-stale-local' }, synced: true }];
    const { index, unpushedIds } = mergeLocalRemote(remote, local);
    expect(index.find(e => e.id === 'a').title).toBe('A-remote');
    expect(unpushedIds.size).toBe(0);
  });

  test('handles empty / missing inputs', () => {
    const { index, unpushedIds } = mergeLocalRemote([], []);
    expect(index).toEqual([]);
    expect(unpushedIds.size).toBe(0);
  });
});

describe('rebuildAndPush with local store', () => {
  function fakeStore() {
    const calls = { put: [], synced: [] };
    return {
      calls,
      async putPieces(system, items) { calls.put.push({ system, ids: items.map(i => i.entry.id) }); },
      async markSynced(system, ids) { calls.synced.push({ system, ids }); },
      async getEntries() { return []; },
      async getDetail() { return null; },
      async getUnpushed() { return []; },
    };
  }
  const piece = { id: 'p1', format: 'note-text', source: 'C4 E4 G4', key: 'C' };

  test('writes to the store before pushing, then marks synced on success', async () => {
    const order = [];
    const store = fakeStore();
    const origPut = store.putPieces;
    store.putPieces = async (...a) => { order.push('put'); return origPut(...a); };
    const committer = async () => { order.push('push'); };
    const res = await rebuildAndPush({ system: 'western', pieces: [piece], currentIndex: [], committer, store });
    expect(res.pushed).toBe(true);
    expect(order).toEqual(['put', 'push']);
    expect(store.calls.put[0].ids).toEqual(['p1']);
    expect(store.calls.synced[0].ids).toEqual(['p1']);
  });

  test('push failure: returns pushed:false + pushError, store still written, no rethrow, NOT marked synced', async () => {
    const store = fakeStore();
    const committer = async () => { throw new Error('offline'); };
    const res = await rebuildAndPush({ system: 'western', pieces: [piece], currentIndex: [], committer, store });
    expect(res.pushed).toBe(false);
    expect(res.pushError).toBe('offline');
    expect(store.calls.put[0].ids).toEqual(['p1']); // saved locally
    expect(store.calls.synced).toEqual([]);         // never marked synced
  });

  test('local write failure: surfaces localError but still attempts push', async () => {
    const store = fakeStore();
    store.putPieces = async () => { throw new Error('quota'); };
    let pushed = false;
    const committer = async () => { pushed = true; };
    const res = await rebuildAndPush({ system: 'western', pieces: [piece], currentIndex: [], committer, store });
    expect(res.localError).toBe('quota');
    expect(pushed).toBe(true);
    expect(res.pushed).toBe(true);
  });
});

describe('retryPush', () => {
  const unpushedFixture = [
    { entry: { id: 'u1', title: 'U1' }, detail: { meta: { id: 'u1' }, format: 'note-text', source: 'x' } },
  ];
  function storeWithUnpushed(list) {
    const calls = { synced: [] };
    return {
      calls,
      async getUnpushed() { return list; },
      async markSynced(system, ids) { calls.synced.push({ system, ids }); },
    };
  }

  test('pushes index.json (full current index) + a detail file per unpushed piece, then marks synced', async () => {
    let pushedFiles = null;
    const committer = async (files) => { pushedFiles = files; };
    const store = storeWithUnpushed(unpushedFixture);
    const currentIndex = [{ id: 'u1', title: 'U1' }, { id: 'already', title: 'Already' }];
    const res = await retryPush({ system: 'western', currentIndex, committer, store });
    expect(res.pushed).toBe(true);
    expect(res.changed).toEqual(['u1']);
    const paths = pushedFiles.map(f => f.path);
    expect(paths).toContain('db/music/western/index.json');
    expect(paths).toContain('db/music/western/details/u1.json');
    expect(paths).not.toContain('db/music/western/details/already.json');
    const idx = JSON.parse(await pushedFiles.find(f => f.path === 'db/music/western/index.json').getContent(null));
    expect(idx.map(e => e.id).sort()).toEqual(['already', 'u1']);
    expect(store.calls.synced[0].ids).toEqual(['u1']);
  });

  test('committer throws: returns pushed:false + pushError, does not mark synced, no rethrow', async () => {
    const store = storeWithUnpushed(unpushedFixture);
    const committer = async () => { throw new Error('rate limit'); };
    const res = await retryPush({ system: 'western', currentIndex: [{ id: 'u1' }], committer, store });
    expect(res.pushed).toBe(false);
    expect(res.pushError).toBe('rate limit');
    expect(res.changed).toEqual([]);
    expect(store.calls.synced).toEqual([]);
  });
});

describe('tags: preserved across a rebuild', () => {
  test('computeChanges carries the prior entry tags onto a rebuilt (changed) entry', () => {
    const doc = encodeNoteText(txt, { id: 'p', title: 'P', system: 'western', key: 'G#m' });
    const first = computeChanges({ system: 'western', pieces: [{ id: 'p', title: 'P', format: 'note-text', source: txt, key: 'G#m' }] });
    // user tagged the piece after the first build
    const tagged = first.index.map(e => e.id === 'p' ? { ...e, tags: ['licks', 'study'] } : e);
    // re-import with changed source → entry is rebuilt; tags must survive
    const second = computeChanges({
      system: 'western', currentIndex: tagged, force: true,
      pieces: [{ id: 'p', title: 'P', format: 'note-text', source: txt + '\nA4', key: 'G#m' }],
    });
    expect(second.index.find(e => e.id === 'p').tags).toEqual(['licks', 'study']);
  });
});

describe('filterByTags (pure)', () => {
  const lib = [
    { id: 'a', tags: ['jazz', 'study'] },
    { id: 'b', tags: ['rock'] },
    { id: 'c' },                       // untagged
  ];
  test('no active tags → all entries unchanged', () => {
    expect(filterByTags(lib, new Set()).map(e => e.id)).toEqual(['a', 'b', 'c']);
    expect(filterByTags(lib, []).map(e => e.id)).toEqual(['a', 'b', 'c']);
  });
  test('keeps entries having ANY active tag', () => {
    expect(filterByTags(lib, new Set(['study'])).map(e => e.id)).toEqual(['a']);
    expect(filterByTags(lib, new Set(['jazz', 'rock'])).map(e => e.id)).toEqual(['a', 'b']);
  });
  test('an untagged entry never matches a filter', () => {
    expect(filterByTags(lib, new Set(['anything'])).map(e => e.id)).toEqual([]);
  });
});

describe('removePieceFromLibrary (pure)', () => {
  test('drops the piece from the index and all its vocab entries', () => {
    const index = [{ id: 'p' }, { id: 'q' }];
    const vocab = [{ id: 'p_1_2', pieceId: 'p' }, { id: 'q_1_1', pieceId: 'q' }, { id: 'p_3_4', pieceId: 'p' }];
    const out = removePieceFromLibrary(index, vocab, 'p');
    expect(out.index.map(e => e.id)).toEqual(['q']);
    expect(out.vocab.map(v => v.id)).toEqual(['q_1_1']);
  });
});

describe('pushPending', () => {
  function storeWith(unpushed) {
    const calls = { synced: [] };
    return { calls, async getUnpushed() { return unpushed; }, async markSynced(system, ids) { calls.synced.push(ids); } };
  }
  test('one commit: index.json + non-null unpushed details + vocab.json (when pushVocab); skips null details', async () => {
    let files = null;
    const committer = async (f) => { files = f; };
    const store = storeWith([
      { entry: { id: 'withDetail' }, detail: { format: 'x', source: 's' } },
      { entry: { id: 'tagOnly' }, detail: null },   // tag-only edit: no local detail → skip the detail file
    ]);
    const index = [{ id: 'withDetail' }, { id: 'tagOnly' }];
    const vocab = [{ id: 'v1' }];
    const res = await pushPending({ system: 'western', currentIndex: index, vocab, pushVocab: true, committer, store });
    expect(res.pushed).toBe(true);
    const paths = files.map(f => f.path);
    expect(paths).toContain('db/music/western/index.json');
    expect(paths).toContain('db/music/western/details/withDetail.json');
    expect(paths).not.toContain('db/music/western/details/tagOnly.json');   // null detail skipped
    expect(paths).toContain('db/music/western/vocab.json');
    expect(JSON.parse(await files.find(f => f.path.endsWith('vocab.json')).getContent(null))).toEqual(vocab);
    expect(store.calls.synced[0]).toEqual(['withDetail', 'tagOnly']);   // both marked synced
  });
  test('pushVocab false → no vocab.json', async () => {
    let files = null;
    const committer = async (f) => { files = f; };
    const store = storeWith([]);
    const res = await pushPending({ system: 'western', currentIndex: [{ id: 'a' }], vocab: [], pushVocab: false, committer, store });
    expect(res.pushed).toBe(true);
    expect(files.map(f => f.path)).toEqual(['db/music/western/index.json']);
  });
  test('pushTags true → tags.json with the registry; false → none', async () => {
    let files = null;
    const committer = async (f) => { files = f; };
    const tags = [{ name: 'riff', color: '#e6194B' }];
    let res = await pushPending({ system: 'western', currentIndex: [{ id: 'a' }], tags, pushTags: true, committer, store: storeWith([]) });
    expect(res.pushed).toBe(true);
    expect(files.map(f => f.path)).toContain('db/music/western/tags.json');
    expect(JSON.parse(await files.find(f => f.path.endsWith('tags.json')).getContent(null))).toEqual(tags);
    res = await pushPending({ system: 'western', currentIndex: [{ id: 'a' }], tags, pushTags: false, committer, store: storeWith([]) });
    expect(files.map(f => f.path)).not.toContain('db/music/western/tags.json');
  });
  test('committer throws → pushed:false + pushError, not marked synced', async () => {
    const store = storeWith([{ entry: { id: 'a' }, detail: { x: 1 } }]);
    const committer = async () => { throw new Error('offline'); };
    const res = await pushPending({ system: 'western', currentIndex: [{ id: 'a' }], vocab: [], pushVocab: true, committer, store });
    expect(res.pushed).toBe(false);
    expect(res.pushError).toBe('offline');
    expect(store.calls.synced).toEqual([]);
  });
});
