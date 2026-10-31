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
  click('Connect to another word')
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
