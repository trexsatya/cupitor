const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs/promises')
const path = require('node:path')
const os = require('node:os')
const { buildLanguageCatalog } = require('./build-language-catalog.cjs')

test('native catalog preserves the web registry and its study capability boundary', async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'cupitor-language-catalog-'))
  try {
    const file = path.join(directory, 'language/language-catalog.json')
    await buildLanguageCatalog(file)
    const { LANGUAGES } = await import('../public/language/language-config.js')
    const catalog = JSON.parse(await fs.readFile(file, 'utf8'))
    assert.equal(catalog.version, 1)
    assert.deepEqual(catalog.languages, Object.values(LANGUAGES))
    assert.deepEqual(catalog.languages.filter(language => language.capabilities.study).map(language => language.code),
      Object.values(LANGUAGES).filter(language => language.capabilities.study).map(language => language.code))
    assert.ok(catalog.languages.some(language => !language.capabilities.study), 'metadata languages do not become study choices')
  } finally { await fs.rm(directory, { recursive: true, force: true }) }
})
