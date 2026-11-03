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

function colourInput(label, value) {
  const input = document.querySelector('[aria-label="' + label + '"]')
  assert.ok(input, label)
  input.value = value
  input.dispatchEvent(new window.Event('input'))
  return input
}
function finishNewWord() {
  document
    .querySelector('foreignObject input')
    .dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }))
}
test('node foreground/background codes update swatches, canvas and saved maps', () => {
  setup()
  openWordMaps({ storageKey: 'maps', onLookup() {} })
  click('+ Word')
  finishNewWord()
  colourInput('Background color hex code', '#AbC')
  colourInput('Text color hex code', '123456')
  assert.equal(
    document.querySelector('[aria-label="Background color picker"]').value,
    '#aabbcc'
  )
  assert.equal(
    document.querySelector('[aria-label="Text color picker"]').value,
    '#123456'
  )
  submit()
  assert.equal(saved().nodes[0].color, '#aabbcc')
  assert.equal(saved().nodes[0].textColor, '#123456')
  assert.equal(
    document.querySelector('[data-node] rect').getAttribute('fill'),
    '#aabbcc'
  )
  assert.equal(
    document.querySelector('[data-node] text').getAttribute('fill'),
    '#123456'
  )
  colourInput('Text color picker', '#654321')
  assert.equal(
    document.querySelector('[aria-label="Text color hex code"]').value,
    '#654321'
  )
  submit()
  click('Close')
  openWordMaps({ storageKey: 'maps', onLookup() {} })
  assert.equal(
    document.querySelector('[data-node] text').getAttribute('fill'),
    '#654321'
  )
  assert.equal(
    document.querySelector('[data-node] rect').getAttribute('fill'),
    '#aabbcc'
  )
  document.querySelector('[role=switch]').click()
  document
    .querySelector('[data-node]')
    .dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }))
  document
    .querySelector('[data-node]')
    .dispatchEvent(
      new window.KeyboardEvent('keydown', { key: 'F2', bubbles: true })
    )
  const editor = document.querySelector('foreignObject input')
  assert.equal(editor.style.color, 'rgb(101, 67, 33)')
  assert.equal(editor.style.background, 'rgb(170, 187, 204)')
})
test('invalid colour codes cannot overwrite a saved node', () => {
  setup()
  openWordMaps({ storageKey: 'maps', onLookup() {} })
  click('+ Word')
  finishNewWord()
  const before = localStorage.getItem('maps')
  const code = colourInput('Text color hex code', '#invalid')
  assert.equal(code.checkValidity(), false)
  submit()
  assert.equal(localStorage.getItem('maps'), before)
  colourInput('Text color hex code', '#111')
  assert.equal(code.checkValidity(), true)
  submit()
  assert.equal(saved().nodes[0].textColor, '#111111')
})
test('group styling accepts colour codes and angled shapes', () => {
  setup()
  openWordMaps({ storageKey: 'maps', onLookup() {} })
  click('+ Word')
  finishNewWord()
  click('+ Word')
  finishNewWord()
  const ids = [...document.querySelectorAll('[data-node]')].map((n) =>
    n.getAttribute('data-node')
  )
  document
    .querySelector('[data-node="' + ids[0] + '"]')
    .onpointerdown(
      new window.MouseEvent('pointerdown', { button: 0, shiftKey: true })
    )
  colourInput('Background color for all hex code', '#001122')
  colourInput('Text color for all hex code', '#ffeedd')
  input('Shape for all', 'parallelogram')
  submit()
  for (const n of saved().nodes) {
    assert.equal(n.color, '#001122')
    assert.equal(n.textColor, '#ffeedd')
    assert.equal(n.shape, 'parallelogram')
  }
})

test('hexagon and parallelogram shapes render polygons and persist on reload', () => {
  setup()
  openWordMaps({ storageKey: 'maps', onLookup() {} })
  click('+ Word')
  finishNewWord()
  for (const shape of ['hexagon', 'parallelogram']) {
    input('Shape', shape)
    submit()
    assert.equal(saved().nodes[0].shape, shape)
    const points = document
      .querySelector('[data-node] polygon')
      .getAttribute('points')
      .split(' ')
    assert.equal(points.length, shape === 'hexagon' ? 6 : 4)
    assert.equal(document.querySelector('[data-node] rect'), null)
    const polygon = document.querySelector('[data-node] polygon')
    assert.equal(polygon.getAttribute('fill'), saved().nodes[0].color)
  }
  click('Close')
  openWordMaps({ storageKey: 'maps', onLookup() {} })
  assert.ok(document.querySelector('[data-node] polygon'))
})

test('compact toolbar keeps secondary actions in More and closes after an action', () => {
  setup()
  openWordMaps({ storageKey: 'maps', onLookup() {} })
  const more = document.querySelector('.wm-more-toggle'),
    actions = document.querySelector('.wm-more-actions')
  assert.equal(more.getAttribute('aria-expanded'), 'false')
  assert.ok(actions.contains(document.querySelector('[aria-label="Map name"]')))
  assert.ok(
    [...actions.querySelectorAll('button')].find(
      (b) => b.textContent === 'JSON'
    )
  )
  assert.ok(
    !actions.contains(
      [...document.querySelectorAll('button')].find(
        (b) => b.textContent === '+ Word'
      )
    )
  )
  more.click()
  assert.equal(more.getAttribute('aria-expanded'), 'true')
  click('New map')
  assert.equal(more.getAttribute('aria-expanded'), 'false')
  assert.equal(actions.classList.contains('is-open'), false)
})
test('details can collapse, reopen for the same word, and stay closed while adding inline', () => {
  setup()
  openWordMaps({ storageKey: 'maps', onLookup() {} })
  const details = document.querySelector('.wm-details-toggle')
  assert.equal(details.getAttribute('aria-expanded'), 'false')
  click('+ Word')
  assert.equal(details.getAttribute('aria-expanded'), 'false')
  finishNewWord()
  document.querySelector('[role=switch]').click()
  const selectWord = () =>
    document
      .querySelector('[data-node]')
      .dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter' }))
  selectWord()
  assert.equal(details.getAttribute('aria-expanded'), 'true')
  details.click()
  assert.equal(details.getAttribute('aria-expanded'), 'false')
  selectWord()
  assert.equal(details.getAttribute('aria-expanded'), 'true')
})

test('Fit map keeps an empty phone canvas at a readable entry scale', () => {
  setup()
  openWordMaps({ storageKey: 'maps', onLookup() {} })
  const viewport = document.querySelector('.wm-viewport')
  Object.defineProperty(viewport, 'clientWidth', { value: 360 })
  Object.defineProperty(viewport, 'clientHeight', { value: 600 })
  click('−')
  click('Fit map')
  assert.equal(document.querySelector('.wm-viewport svg').style.width, '2400px')
})

test('search opens the correct map, highlights all matching nodes and restores a minimized editor', () => {
  setup()
  const maps = ['first', 'second'].map(id => ({ version: 1, id, name: id, edges: [], nodes: [
    { id: id + '-a', word: 'Gräl', x: 1800, y: 1200 },
    { id: id + '-b', word: 'Bråk', x: 2100, y: 1300 },
  ] }))
  localStorage.setItem('maps', JSON.stringify(maps))
  const original = localStorage.getItem('maps')
  openWordMaps({ storageKey: 'maps', onLookup() {}, focus: { mapId: 'second', nodeId: 'second-b', query: 'gräl|bråk' } })
  assert.equal(document.querySelector('[aria-label="Saved word map"]').value, 'second')
  assert.equal(document.querySelectorAll('.wm-search-match').length, 2)
  assert.equal(document.querySelector('[aria-label="Edit mode"]').checked, false)
  assert.equal(document.querySelector('.wm-inspector h3').textContent, 'Bråk')
  // Lookup minimizes this exact instance. A different result must retarget it,
  // instead of just restoring the previously selected map.
  click('Find vocabulary & clips')
  assert.ok(document.querySelector('#wordMapsRestore'))
  openWordMaps({ storageKey: 'maps', onLookup() {}, focus: { mapId: 'first', nodeId: 'first-a', query: 'gräl' } })
  assert.equal(document.querySelector('#wordMapsRestore'), null)
  assert.equal(document.querySelectorAll('#wordMapsDialog').length, 1)
  assert.equal(document.querySelector('[aria-label="Saved word map"]').value, 'first')
  assert.equal(document.querySelector('.wm-search-match').getAttribute('data-node'), 'first-a')
  assert.equal(localStorage.getItem('maps'), original, 'search highlights never change saved node colors or data')
})

test('fullscreen uses the native API, follows Escape and exits when the map closes', async () => {
  setup()
  let active = null
  Object.defineProperty(document, 'fullscreenElement', { get: () => active })
  window.HTMLElement.prototype.requestFullscreen = async function () {
    active = this
    this.dispatchEvent(new window.Event('fullscreenchange', { bubbles: true }))
  }
  document.exitFullscreen = async () => {
    const previous = active
    active = null
    previous?.dispatchEvent(new window.Event('fullscreenchange', { bubbles: true }))
  }
  openWordMaps({ storageKey: 'maps', onLookup() {} })
  const dialog = document.querySelector('#wordMapsDialog')
  document.querySelector('[aria-label="Enter fullscreen"]').click()
  await Promise.resolve()
  assert.equal(active, dialog)
  assert.ok(dialog.classList.contains('wm-fullscreen'))
  assert.equal(document.querySelector('[aria-label="Exit fullscreen"]').getAttribute('aria-pressed'), 'true')
  await document.exitFullscreen() // native Escape
  assert.equal(dialog.classList.contains('wm-fullscreen'), false)
  document.querySelector('[aria-label="Enter fullscreen"]').click()
  await Promise.resolve()
  click('Close')
  assert.equal(active, null)
})

test('fullscreen fills the WebView when its native API is unavailable or refused', async () => {
  setup()
  openWordMaps({ storageKey: 'maps', onLookup() {} })
  const dialog = document.querySelector('#wordMapsDialog')
  document.querySelector('[aria-label="Enter fullscreen"]').click()
  await Promise.resolve()
  assert.ok(dialog.classList.contains('wm-fullscreen'))
  document.querySelector('[aria-label="Exit fullscreen"]').click()
  assert.equal(dialog.classList.contains('wm-fullscreen'), false)
  dialog.requestFullscreen = () => Promise.reject(new Error('unsupported in this WebView'))
  document.querySelector('[aria-label="Enter fullscreen"]').click()
  await Promise.resolve()
  assert.ok(dialog.classList.contains('wm-fullscreen'))
})

test('GitHub refresh preserves a search highlight using the new map content', async () => {
  setup()
  const local = { version: 1, id: 'm', name: 'Map', edges: [], nodes: [{id:'a', word:'Gräl', x:200,y:200}] }
  localStorage.setItem('maps', JSON.stringify([local]))
  let finishPull
  const ready = new Promise(resolve => { finishPull = resolve })
  const sync = {dirty: () => false, pull: async (_getMaps, adopt) => {
    await ready
    adopt([{...local, nodes:[{id:'b', word:'Gräl', x:1500,y:1200}]}])
    return {conflicts:0}
  }}
  openWordMaps({storageKey:'maps', onLookup() {}, sync, focus:{mapId:'m',nodeId:'a',query:'gräl'}})
  assert.equal(document.querySelector('.wm-search-match').getAttribute('data-node'), 'a')
  finishPull()
  await new Promise(resolve => setTimeout(resolve, 0))
  assert.equal(document.querySelector('.wm-search-match').getAttribute('data-node'), 'b')
  assert.equal(document.querySelector('.wm-inspector h3').textContent, 'Gräl')
})

test('matching words show cross-map destinations and open the matching map', () => {
  setup()
  const first = {
    version: 1, id: 'first', name: 'Movement', edges: [],
    nodes: [{ id: 'n1', word: 'störtdyka', x: 300, y: 200, lookup: '', note: '' }]
  }
  const second = {
    version: 1, id: 'second', name: 'Actions', edges: [],
    nodes: [{ id: 'n2', word: 'Störtdyka', x: 400, y: 300, lookup: '', note: '' }]
  }
  localStorage.setItem('maps', JSON.stringify([first, second]))
  openWordMaps({ storageKey: 'maps', onLookup() {} })
  assert.ok(document.querySelector('.wm-cross-map-indicator'))
  const firstNode = document.querySelector('[data-node]')
  firstNode.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
  const destination = [...document.querySelectorAll('.wm-inspector button')].find(b => b.textContent === 'Actions')
  assert.ok(destination)
  destination.click()
  assert.equal(document.querySelector('[aria-label="Saved word map"]').value, 'second')
  assert.equal(document.querySelector('[data-node]').getAttribute('data-node'), 'n2')
})

test('read-mode double tap searches subtitles and minimizes the map', () => {
  setup()
  let lookup = ''
  const map = {
    version: 1, id: 'one', name: 'Words', edges: [],
    nodes: [{ id: 'n1', word: 'vansinnig', lookup: 'vansinnig|galen', x: 300, y: 200 }]
  }
  localStorage.setItem('maps', JSON.stringify([map]))
  openWordMaps({ storageKey: 'maps', onLookup: value => { lookup = value } })
  let node = document.querySelector('[data-node]')
  node.onpointerdown({ button: 0, preventDefault() {}, timeStamp: 100 })
  node = document.querySelector('[data-node]')
  node.onpointerdown({ button: 0, preventDefault() {}, timeStamp: 250 })
  assert.equal(lookup, 'vansinnig|galen')
  assert.equal(document.querySelector('#wordMapsDialog').hasAttribute('open'), false)
})

test('selected nodes can be copied, pasted, deleted and restored with undo/redo', () => {
  setup()
  openWordMaps({ storageKey: 'maps', onLookup() {} })
  click('+ Word')
  finishNewWord()
  const node = document.querySelector('[data-node]')
  node.onkeydown({ target: node, key: 'Enter', preventDefault() {} })
  const dialog = document.querySelector('#wordMapsDialog')
  dialog.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'c', ctrlKey: true, bubbles: true, cancelable: true }))
  dialog.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'v', ctrlKey: true, bubbles: true, cancelable: true }))
  assert.equal(saved().nodes.length, 2)
  dialog.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Delete', bubbles: true, cancelable: true }))
  assert.equal(saved().nodes.length, 1)
  click('Undo')
  assert.equal(saved().nodes.length, 2)
  click('Redo')
  assert.equal(saved().nodes.length, 1)
})


test('folder browsing, nested moves, new maps and reload preserve stable identities', () => {
  setup()
  const first = {version: 1, id: 'one', name: 'Conflict', nodes: [], edges: []}
  const second = {...first, id: 'two', name: 'Light', folder: 'Swedish/Nature'}
  localStorage.setItem('maps', JSON.stringify([first, second]))
  openWordMaps({storageKey: 'maps', onLookup() {}})
  click('Browse maps')
  const field = document.querySelector('[aria-label="Map folder path"]')
  field.value = 'Swedish/People/Conflict'
  document.querySelector('.wm-folder-form').dispatchEvent(new window.Event('submit', {cancelable: true}))
  let data = JSON.parse(localStorage.getItem('maps'))
  assert.equal(data.find(m => m.id === 'one').folder, 'Swedish/People/Conflict')
  assert.equal(data.find(m => m.id === 'two').folder, 'Swedish/Nature')
  assert.ok(document.querySelector('[data-folder="Swedish/People"]'))
  document.querySelector('[data-folder="Swedish/People"]').click()
  assert.equal(document.querySelectorAll('.wm-library-map').length, 1)
  click('New map')
  data = JSON.parse(localStorage.getItem('maps'))
  assert.equal(data.length, 3)
  assert.equal(data[2].folder, 'Swedish/People')
  assert.notEqual(data[2].id, 'one')
  document.querySelector('[data-folder="*"]').click()
  const filter = document.querySelector('[aria-label="Filter maps"]')
  filter.value = 'Light'; filter.dispatchEvent(new window.Event('input'))
  assert.equal(document.querySelectorAll('.wm-library-map').length, 1)
  document.querySelector('[data-map-id="two"]').click()
  assert.equal(document.querySelector('[aria-label="Saved word map"]').value, 'two')
  click('Close')
  openWordMaps({storageKey: 'maps', onLookup() {}})
  assert.equal(saved().folder, 'Swedish/People/Conflict')
  assert.equal(document.querySelectorAll('select[aria-label="Saved word map"] optgroup').length, 3)
})

test('fullscreen retains canvas controls and zoom level while toolbar is hidden', () => {
  setup()
  openWordMaps({storageKey: 'maps', onLookup() {}})
  document.querySelector('[aria-label="Enter fullscreen"]').click()
  const controls = document.querySelector('.wm-work .wm-zoom-controls')
  assert.ok(controls)
  const width = parseFloat(document.querySelector('.wm-viewport svg').style.width)
  controls.querySelector('[aria-label="Zoom in"]').click()
  assert.ok(parseFloat(document.querySelector('.wm-viewport svg').style.width) > width)
  assert.match(document.querySelector('[aria-label="Zoom level"]').textContent, /%/)
  controls.querySelector('[aria-label="Zoom out"]').click()
  assert.equal(parseFloat(document.querySelector('.wm-viewport svg').style.width), width)
})
