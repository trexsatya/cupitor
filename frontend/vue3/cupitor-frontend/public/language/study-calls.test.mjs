import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')
const jquery = require('jquery')
const source = fs.readFileSync(new URL('./study-calls.js', import.meta.url), 'utf8')
const { createCallClient, callPayload, installStudyCalls } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))

function fixture() {
  const { window: win } = new JSDOM('<button id="studyCallsBtn"></button>')
  const $ = jquery(win)
  $.fn.dialog = function () { return this }
  return { win, $ }
}

test('RPC correlates acks, ignores duplicates, and fixes caller-supplied protocol fields', async () => {
  const { win } = fixture()
  const sent = []
  win.CallBridge = { postMessage: raw => sent.push(JSON.parse(raw)) }
  const client = createCallClient(win)
  const first = client.rpc('schedule', { op: 'cancel', request_id: 'spoof' })
  const second = client.rpc('getCalls')
  const ack = (request, data) => win.dispatchEvent(new win.CustomEvent('cupitorCallAck', {
    detail: { request_id: request.request_id, op: request.op, ok: true, data },
  }))
  assert.equal(sent[0].op, 'schedule')
  assert.notEqual(sent[0].request_id, 'spoof')
  ack(sent[1], { calls: [] }); ack(sent[0], { id: 'new' }); ack(sent[0], { id: 'duplicate' })
  assert.deepEqual(await first, { id: 'new' })
  assert.deepEqual(await second, { calls: [] })
  client.dispose(); win.close()
})

test('RPC errors, unavailable bridge, synchronous failure and timeout settle', async () => {
  const { win } = fixture()
  const client = createCallClient(win, 5)
  await assert.rejects(client.rpc('getCalls'), /unsupported/)
  win.CallBridge = { postMessage() { throw new Error('broken') } }
  await assert.rejects(client.rpc('getCalls'), /broken/)
  win.CallBridge.postMessage = () => {}
  await assert.rejects(client.rpc('getCalls'), /timeout/)
  win.CallBridge.postMessage = raw => {
    const request = JSON.parse(raw)
    win.dispatchEvent(new win.CustomEvent('cupitorCallAck', { detail: { ...request, ok: false, error: 'permission_denied' } }))
  }
  await assert.rejects(client.rpc('callNow'), /permission_denied/)
  client.dispose(); win.close()
})

test('composer validates real choices, language, and future times', () => {
  const form = { title: ' Question ', question: 'Which?', choices: ' ett\r\n\nen ', language: 'sv-SE' }
  assert.deepEqual(callPayload(form), { title: 'Question', question: 'Which?', choices: ['ett', 'en'], language: 'sv-SE' })
  for (const change of [{ choices: 'one' }, { choices: 'a\n'.repeat(10) }, { question: '' }, { language: 'bad-value-long' }]) {
    assert.throws(() => callPayload({ ...form, ...change }))
  }
  assert.throws(() => callPayload({ ...form, when: 'invalid' }))
  assert.throws(() => callPayload({ ...form, when: '2020-01-01T12:00' }))
})

test('dialog restores durable history safely, selects reminder text, submits and cancels', async () => {
  const { win, $ } = fixture()
  const sent = []
  const calls = [{ id: 'one', title: '<img src=x onerror=alert(1)>', created_at: 1, when_ms: 2,
    status: 'completed', choice: '<b>en</b>' }, { id: 'two', title: 'Later', status: 'scheduled', created_at: 3, when_ms: 4 }]
  win.__cupitorCalls = { calls }
  win.__cupitorNotifLists = { lists: [{ external_key: 'list', name: 'Words', items: [{ external_id: 'word', title: 'en katt', body: 'a cat' }] }] }
  win.CallBridge = { postMessage(raw) {
    const request = JSON.parse(raw); sent.push(request)
    const data = request.op === 'getCapabilities' ? { supported: true, permission: 'granted', full_screen: true, exact_alarms: true } :
      request.op === 'getCalls' ? { calls } : { id: 'three' }
    win.dispatchEvent(new win.CustomEvent('cupitorCallAck', { detail: { ...request, ok: true, data } }))
  } }
  const installed = installStudyCalls(win, $)
  installed.open()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal($('#studyCallsDialog img').length, 0)
  assert.match($('[data-call-history]').text(), /Answer: <b>en<\/b>/)
  $('[data-call-source]').val(JSON.stringify(['list', 'word'])).trigger('change')
  assert.equal($('[data-call-question]').val(), 'en katt\na cat')
  $('[data-call-submit=now]').trigger('click')
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(sent.find(r => r.op === 'callNow').choices, ['Yes', 'No'])
  $('[data-call-history] button').trigger('click')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(sent.find(r => r.op === 'cancel').id, 'two')
  win.dispatchEvent(new win.CustomEvent('cupitorCalls', { detail: { calls: [] } }))
  assert.match($('[data-call-history]').text(), /No calls yet/)
  installed.client.dispose(); win.close()
})
