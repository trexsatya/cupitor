import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { openWordMaps } from './word-maps.js'
const require = createRequire(import.meta.url)
const { JSDOM } = require(process.env.CUPITOR_JSDOM || 'jsdom')
function setup() {
  const dom = new JSDOM('<body></body>', { url: 'https://cupitor.test' })
  for (const k of ['window', 'document', 'localStorage', 'Option'])
    globalThis[k] = dom.window[k]
  dom.window.HTMLElement.prototype.showModal = function () {
    this.setAttribute('open', '')
  }
  dom.window.HTMLElement.prototype.close = function () {
    this.removeAttribute('open')
    this.dispatchEvent(new dom.window.Event('close'))
  }
  dom.window.HTMLElement.prototype.scrollTo = function () {}
  dom.window.Element.prototype.replaceChildren ||= function (...nodes) {
    while (this.firstChild) this.removeChild(this.firstChild)
    this.append(...nodes)
  }
  globalThis.confirm = () => true
  return dom
}
function click(text) {
  const b = [...document.querySelectorAll('button')].find(
    (b) => b.textContent === text
  )
  assert.ok(b, text)
  b.click()
}
function input(label, value) {
  const l = [...document.querySelectorAll('label')].find(
    (l) => l.firstChild.textContent === label
  )
  assert.ok(l, label)
  const field = l.querySelector('input,select,textarea')
  field.value = value
  field.dispatchEvent(new window.Event('change'))
  return field
}
function submit() {
  document
    .querySelector('.wm-inspector form')
    .dispatchEvent(new window.Event('submit', { cancelable: true }))
}
const saved = () => JSON.parse(localStorage.getItem('maps'))[0]
test('edit, connect, save and reopen; appearance and lookup survive', () => {
  setup()
  let lookup = ''
  openWordMaps({ storageKey: 'maps', onLookup: (v) => (lookup = v) })
  click('+ Word')
  input('Word / phrase', 'Lodrät')
  submit()
  click('+ Word')
  input('Word / phrase', 'Rät')
  submit()
  click('Connect to another word (C)')
  document
    .querySelector('[data-node]')
    .dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }))
  input('Relationship', 'not related')
  input('Arrows', 'both')
  submit()
  assert.equal(saved().edges[0].marker, '×')
  assert.equal(saved().edges[0].dashed, true)
  // The invisible hit area must not inherit visible arrowheads.
  const lines = document.querySelectorAll('[data-edge] line')
  assert.equal(lines[0].getAttribute('marker-end'), null)
  assert.equal(lines[1].getAttribute('marker-end'), 'url(#wm-arrow)')
  click('Close')
  openWordMaps({ storageKey: 'maps', onLookup: (v) => (lookup = v) })
  assert.equal(document.querySelectorAll('[data-node]').length, 2)
  document
    .querySelector('[data-node]')
    .dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }))
  click('Find vocabulary & clips')
  assert.equal(lookup, 'Lodrät')
})
test('invalid JSON leaves current map intact; JSON can be cancelled', () => {
  setup()
  openWordMaps({ storageKey: 'maps', onLookup() {} })
  click('+ Word')
  const before = localStorage.getItem('maps')
  click('JSON')
  document.querySelector('.wm-script').value = '{"version":2}'
  click('Apply JSON')
  assert.match(document.querySelector('.wm-status').textContent, /Expected/)
  assert.equal(localStorage.getItem('maps'), before)
  click('Cancel')
  assert.equal(document.querySelector('.wm-viewport').hidden, false)
})
test('unreadable stored data is preserved and save failure is visible', () => {
  setup()
  localStorage.setItem('maps', 'damaged')
  openWordMaps({ storageKey: 'maps', onLookup() {} })
  click('+ Word')
  assert.equal(localStorage.getItem('maps'), 'damaged')
  assert.match(
    document.querySelector('.wm-status').textContent,
    /Saving blocked/
  )
})

test('GitHub load does not publish a phantom blank map and Sync marks changes clean', async () => {
  setup()
  const { createWordMapSync } = await import('./word-maps-sync.js')
  let remote = [],
    changes
  const sync = createWordMapSync({
    storageKey: 'maps',
    sourceKey: 'self/main',
    storage: localStorage,
    readFile: async () => JSON.stringify(remote),
    resolveConflicts: async () => null,
    commitFile: async (transform) => {
      changes = JSON.parse(await transform(JSON.stringify(remote)))
      remote = changes.maps
    },
  })
  openWordMaps({ storageKey: 'maps', onLookup() {}, sync })
  await new Promise((r) => setTimeout(r, 0))
  assert.deepEqual(JSON.parse(localStorage.getItem('maps')), [])
  click('New map')
  assert.equal(
    document.querySelector('[aria-label="Saved word map"]').options.length,
    1
  )
  click('+ Word')
  const inline = document.querySelector('foreignObject input')
  inline.value = 'Synced word'
  inline.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }))
  assert.equal(document.querySelector('.wm-sync').textContent, 'Sync*')
  click('Sync*')
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(changes.maps[0].nodes[0].word, 'Synced word')
  assert.equal(document.querySelector('.wm-sync').textContent, 'Sync')
  click('Delete map')
  assert.deepEqual(JSON.parse(localStorage.getItem('maps')), [])
  click('Sync*')
  await new Promise((r) => setTimeout(r, 0))
  assert.deepEqual(remote, [])
})
test('closing during GitHub load keeps newly saved local edits', async () => {
  setup()
  const { createWordMapSync } = await import('./word-maps-sync.js')
  let release
  const pending = new Promise((r) => (release = r))
  const sync = createWordMapSync({
    storageKey: 'maps',
    sourceKey: 'self/main',
    storage: localStorage,
    readFile: () => pending,
    commitFile: async () => {},
    resolveConflicts: async () => null,
  })
  openWordMaps({ storageKey: 'maps', onLookup() {}, sync })
  click('+ Word')
  click('Close')
  const newer = JSON.parse(localStorage.getItem('maps'))
  newer[0].name = 'changed after closing'
  localStorage.setItem('maps', JSON.stringify(newer))
  release('[]')
  await new Promise((r) => setTimeout(r, 0))
  assert.equal(
    JSON.parse(localStorage.getItem('maps'))[0].name,
    'changed after closing'
  )
})

test('one Read/Edit switch toggles editing controls', () => {
  setup()
  openWordMaps({ storageKey: 'maps', onLookup() {} })
  const toggle = document.querySelector('[role=switch][aria-label="Edit mode"]')
  assert.ok(toggle)
  assert.equal(toggle.checked, true)
  toggle.click()
  assert.equal(toggle.checked, false)
  assert.equal(
    [...document.querySelectorAll('button')].find(
      (b) => b.textContent === '+ Word'
    ).hidden,
    true
  )
  toggle.click()
  assert.equal(toggle.checked, true)
  assert.equal(
    [...document.querySelectorAll('button')].find(
      (b) => b.textContent === '+ Word'
    ).hidden,
    false
  )
})
test('lookup minimizes and restoring preserves the selected word, mode and zoom', () => {
  setup()
  let lookup
  openWordMaps({ storageKey: 'maps', onLookup: (word) => (lookup = word) })
  click('+ Word')
  const inline = document.querySelector('foreignObject input')
  inline.value = 'Lodrät'
  inline.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }))
  click('+')
  const dialog = document.querySelector('#wordMapsDialog'),
    canvas = dialog.querySelector('svg')
  const width = canvas.style.width,
    word = dialog.querySelector('[data-node]')
  click('Find vocabulary & clips')
  assert.equal(lookup, 'Lodrät')
  assert.equal(dialog.hasAttribute('open'), false)
  assert.ok(document.querySelector('#wordMapsRestore'))
  document.querySelector('#wordMapsRestore').click()
  assert.equal(document.querySelector('#wordMapsDialog'), dialog)
  assert.equal(dialog.hasAttribute('open'), true)
  assert.equal(canvas.style.width, width)
  assert.equal(dialog.querySelector('[data-node]'), word)
  assert.equal(dialog.querySelector('[role=switch]').checked, true)
  assert.equal(document.querySelector('#wordMapsRestore'), null)
  click('Find vocabulary & clips')
  openWordMaps({ storageKey: 'maps', onLookup() {} })
  assert.equal(document.querySelectorAll('#wordMapsDialog').length, 1)
  assert.equal(document.querySelector('#wordMapsRestore'), null)
  click('Close')
  assert.equal(document.querySelector('#wordMapsDialog'), null)
})
