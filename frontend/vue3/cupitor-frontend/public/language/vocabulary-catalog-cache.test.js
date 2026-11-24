import { IDBFactory } from 'fake-indexeddb'
import { TextEncoder } from 'util'
import { createVocabularyCatalogCache } from './vocabulary-catalog-cache.js'
beforeAll(() => { global.indexedDB = new IDBFactory(); global.TextEncoder = TextEncoder })
test('derived chunks are shared across views of one source, isolated across sources and bounded by a cache budget', async () => {
  const first = createVocabularyCatalogCache('owner/repo/shared')
  await first.putAll([['hi/chunk', 'हिन्दी']])
  expect(await createVocabularyCatalogCache('owner/repo/shared').get('hi/chunk')).toBe('हिन्दी')
  expect(await createVocabularyCatalogCache('different/repo/shared').get('hi/chunk')).toBeNull()
  await first.putAll([['hi/chunk', null]])
  expect(await createVocabularyCatalogCache('owner/repo/shared').get('hi/chunk')).toBeNull()
  const bounded = createVocabularyCatalogCache('bounded', { maxBytes: 128 })
  await bounded.putAll(Array.from({ length: 10 }, (_, i) => ['chunk-' + i, 'x'.repeat(64)]))
  const restored = createVocabularyCatalogCache('bounded', { maxBytes: 128 })
  const remaining = await Promise.all(Array.from({ length: 10 }, (_, i) => restored.get('chunk-' + i)))
  expect(remaining.filter(Boolean).length).toBeLessThanOrEqual(2)
})
