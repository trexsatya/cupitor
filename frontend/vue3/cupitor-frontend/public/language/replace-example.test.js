const fs = require('fs')
const path = require('path')

const source = fs.readFileSync(path.join(__dirname, 'language.js'), 'utf8')
const start = source.indexOf('async function _findAltCaptures(')
const end = source.indexOf('window._openReplaceItemDialog =', start)
if (start < 0 || end < 0) throw new Error('Replacement functions missing')
const code = source.slice(start, end)

function picker(item) {
  const arr = [item]
  const win = { _recordings: { Test: { items: { query: { bucket: arr } } } } }
  const dialog = { length: 1, width: () => 1000, html: jest.fn(), dialog: jest.fn((op) => op === 'isOpen' ? true : dialog) }
  const build = jest.fn(async () => [])
  const open = new Function('window', '$', '_', '_isVirtual', '_refuseReadOnlyPlaylist', '_isManualItem',
    'buildAutomaticItems', code + ';return _openReplaceItemDialog')(
    win, () => dialog, { escape: x => x }, () => false, () => false, () => false, build)
  return { open: () => open('query', 'bucket', 0, { recName: 'Test' }), build, dialog }
}

test.each([
  ['vars status', 'vars|status|vars status'],
  ['se till', 'se|till|se till'],
  ['gäll', 'gäll|gälla']
])('replacement searches the matched %s instead of the original broad query', async (word, searchText) => {
  const p = picker({ word, searchText, id: 'current', lineIndex: 1 })
  await p.open()
  expect(p.build).toHaveBeenCalledWith({ words: [word], matchesPerWord: 30 })
  expect(p.dialog.html.mock.calls[0][0]).toContain(`“${word}”`)
})

test('legacy cards without a word use their word bucket before the broad query', async () => {
  const p = picker({ searchText: 'vars|status|vars status', id: 'current', lineIndex: 1 })
  await p.open()
  expect(p.build).toHaveBeenCalledWith({ words: ['bucket'], matchesPerWord: 30 })
})
