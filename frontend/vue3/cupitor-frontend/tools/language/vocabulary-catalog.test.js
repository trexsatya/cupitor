import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { TextEncoder } from 'util'
import { auditVocabularyCatalog } from './vocabulary-catalog-migration.js'
let root
beforeAll(() => { global.TextEncoder = TextEncoder })
beforeEach(() => { root = mkdtempSync(join(tmpdir(), 'cupitor-vocabulary-split-')); mkdirSync(join(root, 'swedish')); mkdirSync(join(root, 'shared')) })
afterEach(() => rmSync(root, { recursive: true, force: true }))
const fixture = () => {
  writeFileSync(join(root, 'swedish/vocabulary.txt'), '#Food\n(drink)|dricka|')
  writeFileSync(join(root, 'shared/vocabulary-meanings.json'), JSON.stringify({ version: 1, meanings: {}, groups: { drink: {
    language: 'sv', category: 'Food', line: '(drink)|dricka|', forms: [], hintOverrides: { hi: ['पीना'], th: ['ดื่ม'] },
  } } }))
}
test('stages a verified split without changing vocabulary or the legacy catalog', async () => {
  fixture()
  const before = readFileSync(join(root, 'shared/vocabulary-meanings.json'), 'utf8')
  const report = await auditVocabularyCatalog({ dataDir: join(root, 'swedish'), outDir: join(root, 'staged') })
  expect(report.changedDisplays).toBe(0)
  expect(report.changedSearches).toBe(0)
  expect(report.maxChunkBytes).toBeLessThanOrEqual(65536)
  expect(readFileSync(join(root, 'shared/vocabulary-meanings.json'), 'utf8')).toBe(before)
  expect(readFileSync(join(root, 'swedish/vocabulary.txt'), 'utf8')).not.toContain('[entry:')
  expect(existsSync(join(root, 'staged/shared/vocabulary-catalog/index.json'))).toBe(true)
  expect(readFileSync(join(root, 'staged/vocabulary/vocabulary.txt'), 'utf8')).toContain('[entry:')
})
test('refuses to overwrite the source or stage an already migrated legacy snapshot', async () => {
  fixture()
  await expect(auditVocabularyCatalog({ dataDir: join(root, 'swedish'), outDir: root })).rejects.toThrow(/staging/)
  mkdirSync(join(root, 'shared/vocabulary-catalog'))
  writeFileSync(join(root, 'shared/vocabulary-catalog/index.json'), '{}')
  await expect(auditVocabularyCatalog({ dataDir: join(root, 'swedish') })).rejects.toThrow(/already uses split/)
})
