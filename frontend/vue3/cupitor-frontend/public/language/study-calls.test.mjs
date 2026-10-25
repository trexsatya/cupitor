import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const { JSDOM } = require('jsdom')
const jquery = require('jquery')
const source = fs.readFileSync(new URL('./study-calls.js', import.meta.url), 'utf8')
const { createCallClient, callPayload, callLanguageFromLocation, installStudyCalls, parseCallImport, scheduleImportedCalls, CALL_IMPORT_EXAMPLE } = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'))

function fixture(url = 'https://cupitor.test/language.html') {
  const { window: win } = new JSDOM('<button id="studyCallsBtn"></button>', { url })
  const $ = jquery(win)
  $.fn.dialog = function () { return this }
  return { win, $ }
}

test('page lang selects defaults for new calls and Settings without changing imported questions', () => {
  for (const [query, expected] of [['', 'sv-SE'], ['swedish', 'sv-SE'], ['spanish', 'es-ES'], ['en', 'en-US'],
    ['es-MX', 'es-MX'], ['HI', 'hi-IN'], ['not-a-language', 'sv-SE']]) {
    assert.equal(callLanguageFromLocation({ href: `https://cupitor.test/language.html?lang=${query}` }), expected)
  }
  const { win, $ } = fixture('https://cupitor.test/language.html?lang=spanish')
  const installed = installStudyCalls(win, $); installed.open()
  assert.equal($('[data-call-preview-language]').val(), 'es-ES')
  $('[data-call-add]').trigger('click')
  assert.equal($('[data-call-language]').val(), 'es-ES')
  $('[data-call-language]').val('en-US').trigger('change')
  $('[data-call-back-top]').trigger('click'); $('[data-call-add]').trigger('click')
  assert.equal($('[data-call-language]').val(), 'es-ES', 'each new question starts from the page language')
  $('[data-call-back-top]').trigger('click'); $('[data-call-open-import]').trigger('click')
  $('[data-call-import-load-example]').trigger('click')
  $('[data-call-import-drafts] button').filter((_, el) => el.textContent === 'Edit').first().trigger('click')
  assert.equal($('[data-call-language]').val(), 'sv-SE', 'an explicit imported language takes priority')
  installed.client.dispose(); win.close()
})

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
  assert.deepEqual(callPayload(form), { title: 'Question', question: 'Which?', choices: ['ett', 'en'], language: 'sv-SE',
    response_type: 'choice', max_retries: 3, match_threshold: 0.8, voice_response: true })
  for (const change of [{ choices: 'one' }, { choices: 'a\n'.repeat(10) }, { question: '' }, { language: 'bad-value-long' }]) {
    assert.throws(() => callPayload({ ...form, ...change }))
  }
  assert.throws(() => callPayload({ ...form, when: 'invalid' }))
  assert.throws(() => callPayload({ ...form, when: '2020-01-01T12:00' }))
})

test('free responses require accepted answers and preserve retry and fuzzy settings', () => {
  const form = { title: 'Capital', question: 'Capital of Sweden?', language: 'sv-SE', responseType: 'text',
    acceptedAnswers: 'Stockholm\nStockholms stad', maxRetries: 3, matchThreshold: 0.8 }
  const payload = callPayload(form)
  assert.deepEqual(payload.choices, [])
  assert.deepEqual(payload.accepted_answers, ['Stockholm', 'Stockholms stad'])
  assert.equal(payload.max_retries, 3)
  assert.equal(payload.match_threshold, 0.8)
  assert.equal(payload.voice_response, true)
  for (const change of [{ acceptedAnswers: '' }, { acceptedAnswers: '...' }, { maxRetries: -1 }, { maxRetries: 1.5 },
    { maxRetries: 11 }, { matchThreshold: 0.2 }]) assert.throws(() => callPayload({ ...form, ...change }))
  assert.equal(callPayload({ ...form, maxRetries: 0, voiceResponse: false }).max_retries, 0)
  assert.equal(callPayload({ ...form, voiceResponse: false }).voice_response, false)
  assert.throws(() => callPayload({ ...form, responseType: 'choice', choices: 'a\nb', correctChoice: '' }))
})

test('dialog restores durable history safely, selects reminder text, submits and cancels', async () => {
  const { win, $ } = fixture()
  const sent = []
  const calls = [{ id: 'one', title: '<img src=x onerror=alert(1)>', created_at: 1, when_ms: 2,
    status: 'completed', choice: '<b>en</b>', spoken_response: '<script>bad</script>', correct: true,
    attempts: [{ answer: 'one', correct: false }, { answer: '<b>en</b>', correct: true }] },
    { id: 'two', title: 'Later', status: 'scheduled', created_at: 3, when_ms: 4 }]
  win.__cupitorCalls = { calls }
  win.__cupitorNotifLists = { lists: [{ external_key: 'list', name: 'Words', items: [{ external_id: 'word', title: 'en katt', body: 'a cat' }] }] }
  win.CallBridge = { postMessage(raw) {
    const request = JSON.parse(raw); sent.push(request)
    const data = request.op === 'getCapabilities' ? { supported: true, permission: 'granted', full_screen: true, exact_alarms: true, speech_input: true } :
      request.op === 'getCalls' ? { calls } : { id: 'three' }
    win.dispatchEvent(new win.CustomEvent('cupitorCallAck', { detail: { ...request, ok: true, data } }))
  } }
  const installed = installStudyCalls(win, $)
  installed.open()
  await new Promise(resolve => setImmediate(resolve))
  assert.equal($('#studyCallsDialog img').length, 0)
  assert.match($('[data-call-history]').text(), /Answer: <b>en<\/b>/)
  assert.match($('[data-call-history]').text(), /Attempts \(2\)/)
  assert.equal($('#studyCallsDialog script').length, 0)
  $('[data-call-source]').val(JSON.stringify(['list', 'word'])).trigger('change')
  assert.equal($('[data-call-question]').val(), 'en katt\na cat')
  $('[data-call-correct]').val('1')
  $('[data-call-submit=now]').trigger('click')
  await new Promise(resolve => setImmediate(resolve))
  assert.deepEqual(sent.find(r => r.op === 'callNow').choices, ['Yes', 'No'])
  assert.equal(sent.find(r => r.op === 'callNow').correct_choice_index, 1)
  assert.equal(sent.find(r => r.op === 'callNow').voice_response, true)
  $('[data-call-type]').val('text').trigger('change')
  $('[data-call-accepted]').val('Stockholm\nStockholms stad')
  $('[data-call-retries]').val('2')
  $('[data-call-submit=now]').trigger('click')
  await new Promise(resolve => setImmediate(resolve))
  const free = sent.filter(r => r.op === 'callNow').at(-1)
  assert.equal(free.response_type, 'text')
  assert.equal(free.max_retries, 2)
  assert.deepEqual(free.accepted_answers, ['Stockholm', 'Stockholms stad'])
  $('[data-call-pending] button').filter((_, el) => el.textContent === 'Cancel call').trigger('click')
  await new Promise(resolve => setImmediate(resolve))
  assert.equal(sent.find(r => r.op === 'cancel').id, 'two')
  win.dispatchEvent(new win.CustomEvent('cupitorCalls', { detail: { calls: [] } }))
  assert.match($('[data-call-history]').text(), /No calls yet/)
  installed.client.dispose(); win.close()
})


test('JSON imports validate all questions, custom alternatives and free response aliases', () => {
  const calls = parseCallImport(JSON.stringify(CALL_IMPORT_EXAMPLE))
  assert.equal(calls.length, 2)
  assert.equal(calls[0].correct_choice_index, 0)
  assert.equal(calls[0].max_retries, 3)
  assert.deepEqual(calls[1].accepted_answers, ['Stockholm', 'Stockholms stad'])
  for (const bad of ['{broken', JSON.stringify({ version: 2, calls: [] }),
    JSON.stringify([{ question: 'Bad', choices: ['A', 'B'] }]),
    JSON.stringify({ calls: [CALL_IMPORT_EXAMPLE.calls[0], { question: 'Missing answer', response_type: 'text' }] }),
    JSON.stringify(Array(5001).fill(CALL_IMPORT_EXAMPLE.calls[0]))]) assert.throws(() => parseCallImport(bad))
  assert.throws(() => parseCallImport(JSON.stringify(Array(51).fill(CALL_IMPORT_EXAMPLE.calls[0])), Date.now(), 50), /Settings/)
  assert.equal(parseCallImport(JSON.stringify(Array(120).fill(CALL_IMPORT_EXAMPLE.calls[0]))).length, 120)
  assert.throws(() => parseCallImport('x'.repeat(1024 * 1024 + 1)))
  const now = Date.now(), start = now + 600000
  const planned = scheduleImportedCalls(calls, start, 5, now)
  assert.equal(planned[1].when_ms - planned[0].when_ms, 300000)
  const explicit = { ...calls[1], when_ms: start + 900000 }
  assert.equal(scheduleImportedCalls([calls[0], explicit], start, 5, now)[1].when_ms, explicit.when_ms)
  assert.throws(() => scheduleImportedCalls(calls, '', 5, now))
  assert.throws(() => scheduleImportedCalls(calls, start, 0, now))
})

test('file calls remain editable, schedule together once, and scheduled calls can be edited', async () => {
  const { win, $ } = fixture()
  const sent = []
  let calls = []
  win.CallBridge = { postMessage(raw) {
    const r = JSON.parse(raw); sent.push(r)
    if (r.op === 'scheduleBatch') calls = r.calls.map((c, i) => ({ ...c, id: String(i), status: 'scheduled', created_at: Date.now() }))
    if (r.op === 'setEnabled') calls = calls.map(c => c.id === r.id ? { ...c, enabled: r.enabled, status: r.enabled ? 'scheduled' : 'disabled' } : c)
    if (r.op === 'remove') calls = calls.filter(c => c.id !== r.id)
    if (r.op === 'update') calls = calls.map(c => c.id === r.id ? { ...c, ...r } : c)
    const data = r.op === 'getCapabilities' ? { supported: true, permission: 'granted', speech_input: true,
      batch_schedule: true, edit_scheduled: true, pending_controls: true } : r.op === 'getCalls' ? { calls } : true
    win.dispatchEvent(new win.CustomEvent('cupitorCallAck', { detail: { ...r, ok: true, data } }))
  } }
  const installed = installStudyCalls(win, $)
  installed.open()
  const flush = () => new Promise(resolve => setImmediate(resolve))
  await flush()
  const file = $('[data-call-import-file]')[0]
  Object.defineProperty(file, 'files', { configurable: true, value: [{ size: 100, text: async () => JSON.stringify(CALL_IMPORT_EXAMPLE) }] })
  $(file).trigger('change'); await flush()
  assert.equal($('[data-call-import-drafts] .study-call-history-row').length, 2)
  $('[data-call-import-drafts] button').filter((_, el) => el.textContent === 'Edit').first().trigger('click')
  assert.equal($('[data-call-question]').val(), CALL_IMPORT_EXAMPLE.calls[0].question)
  $('[data-call-question]').val('Edited multiple choice question')
  $('[data-call-choices]').val('One\nTwo\nThree').trigger('input')
  $('[data-call-correct]').val('1')
  $('[data-call-import-select]').val('1').trigger('change')
  assert.equal($('[data-call-type]').val(), 'text')
  $('[data-call-accepted]').val('Stockholm\nStockholms stad\nStockholm city')
  $('[data-call-import-save]').trigger('click')
  const start = new Date(Date.now() + 600000)
  $('[data-call-import-start]').val(new Date(start - start.getTimezoneOffset() * 60000).toISOString().slice(0, 16))
  $('[data-call-import-schedule]').trigger('click'); await flush()
  const batch = sent.find(r => r.op === 'scheduleBatch')
  assert.equal(batch.calls[0].question, 'Edited multiple choice question')
  assert.deepEqual(batch.calls[0].choices, ['One', 'Two', 'Three'])
  assert.equal(batch.calls[0].correct_choice_index, 1)
  assert.equal(batch.calls[1].accepted_answers.length, 3)
  $('[data-call-import-schedule]').trigger('click'); await flush()
  assert.equal(sent.filter(r => r.op === 'scheduleBatch').length, 1)
  $('[data-call-pending] button').filter((_, el) => el.textContent === 'Edit call').first().trigger('click')
  $('[data-call-question]').val('Edited after scheduling')
  $('[data-call-submit=later]').trigger('click'); await flush()
  assert.equal(sent.find(r => r.op === 'update').question, 'Edited after scheduling')
  $('[data-call-pending] button').filter((_, el) => el.textContent === 'Disable').first().trigger('click'); await flush()
  assert.equal(sent.find(r => r.op === 'setEnabled').enabled, false)
  assert.match($('[data-call-pending]').text(), /Disabled/)
  $('[data-call-pending] button').filter((_, el) => el.textContent === 'Enable').first().trigger('click'); await flush()
  assert.equal(sent.filter(r => r.op === 'setEnabled').at(-1).enabled, true)
  $('[data-call-pending] button').filter((_, el) => el.textContent === 'Remove').first().trigger('click'); await flush()
  assert.equal(calls.length, 1)
  assert.equal($('[data-call-pending] .study-call-history-row').length, 1)
  installed.client.dispose(); win.close()
})

test('history is hidden until requested and keeps only the newest 100 terminal calls', async () => {
  const { win, $ } = fixture()
  win.__cupitorCalls = { calls: Array.from({ length: 150 }, (_, i) => ({ id: String(i), title: 'Done ' + i,
    status: 'completed', created_at: i, finished_at: i, when_ms: 1 })) }
  const installed = installStudyCalls(win, $); installed.open()
  assert.equal($('[data-call-history]').css('display'), 'none')
  assert.equal($('[data-call-history] .study-call-history-row').length, 100)
  assert.match($('[data-call-history]').text(), /Done 149/)
  assert.doesNotMatch($('[data-call-history]').text(), /Done 49(?:[^0-9]|$)/)
  $('[data-call-history-toggle]').trigger('click')
  assert.equal($('[data-call-history-toggle]').attr('aria-expanded'), 'true')
  assert.notEqual($('[data-call-history]').css('display'), 'none')
  installed.client.dispose(); win.close()
})

test('history details show the complete choice question, correct answer, response and attempts safely', () => {
  const { win, $ } = fixture()
  const question = 'Question line one\n' + 'Long question. '.repeat(275) + '<img src=x onerror=alert(1)>'
  const choice = '<b>correct answer</b>'
  const call = { id: 'details', title: '<script>title</script>', question, choices: [choice, 'Other'],
    correct_choice_index: 0, response_type: 'choice', status: 'completed', when_ms: 1700000000000,
    finished_at: 1700000060000, choice, answer: choice, correct: true, spoken_response: 'correct anser',
    attempts: [{ answer: 'Other', correct: false, response_mode: 'tap', at: 1700000010000 },
      { answer: '', reason: 'no_input', correct: false, response_mode: 'voice' },
      { answer: choice, correct: true, response_mode: 'voice', at: 1700000050000 }] }
  win.__cupitorCalls = { calls: [call] }
  const installed = installStudyCalls(win, $); installed.open()
  $('[data-call-history-toggle]').trigger('click')
  $('#studyCallsDialog').scrollTop(123)
  $('[data-call-view-details]').trigger('click')
  const $details = $('[data-call-history-detail]')
  assert.equal($('[data-call-view=history-detail]').css('display'), 'block')
  assert.equal($('[data-call-back-top]').text(), '← Back to call history')
  const section = name => $details.find('section').filter((_, el) => $(el).find('h3').text() === name)
  assert.equal(section('Question').find('p').text(), question, 'no truncation or loss of line breaks')
  assert.deepEqual(section('Alternatives').find('li').map((_, el) => $(el).find('.study-call-detail-text').text()).get(), call.choices)
  assert.equal(section('Correct answer').find('p').text(), '1. ' + choice, 'index zero is a valid correct answer')
  assert.match(section('Your answer').text(), /Heard: correct anser/)
  assert.equal(section('Attempts (3)').find('.study-call-detail-attempt').length, 3)
  assert.match(section('Attempts (3)').text(), /No speech heard/)
  assert.match(section('Attempts (3)').text(), /On screen/)
  assert.equal($details.find('img, script, b').length, 0, 'imported text never becomes markup')
  assert.equal($('[data-call-nav]').css('display'), 'none')
  $('[data-call-back-top]').trigger('click')
  assert.equal($('[data-call-view=history]').css('display'), 'block')
  assert.equal($('#studyCallsDialog').scrollTop(), 123, 'Back restores the history position')
  assert.equal(win.document.activeElement, $('[data-call-view-details]')[0])
  $('[data-call-back-top]').trigger('click')
  assert.equal($('[data-call-view=list]').css('display'), 'block')
  installed.client.dispose(); win.close()
})

test('history details include all accepted answers and handle unanswered and older calls', () => {
  const { win, $ } = fixture()
  const aliases = Array.from({ length: 20 }, (_, i) => `Accepted phrasing ${i + 1}`)
  win.__cupitorCalls = { calls: [
    { id: 'free', title: 'Capital', question: 'Capital?\nExplain your answer.', response_type: 'text',
      accepted_answers: aliases, status: 'failed', answer: 'Gothenburg', correct: false,
      attempts: [{ answer: 'Gothenburg', correct: false, response_mode: 'typed' }] },
    { id: 'missed', title: 'Missed', question: 'A missed question', choices: ['A', 'B'], correct_choice_index: 1, status: 'missed' },
    { id: 'legacy', title: 'Older call', status: 'completed', choice: 'Legacy answer' },
  ] }
  const installed = installStudyCalls(win, $); installed.open()
  $('[data-call-history-toggle]').trigger('click')
  const open = id => $(`[data-call-history-rows] [data-call-id=${id}] [data-call-view-details]`).trigger('click')
  open('free')
  assert.deepEqual($('[data-call-history-detail] li').map((_, el) => $(el).text()).get(), aliases)
  assert.match($('[data-call-history-detail]').text(), /GothenburgIncorrect/)
  assert.match($('[data-call-history-detail]').text(), /Typed/)
  $('[data-call-back-top]').trigger('click'); open('missed')
  assert.match($('[data-call-history-detail]').text(), /2\. B/)
  assert.match($('[data-call-history-detail]').text(), /No answer was recorded/)
  $('[data-call-back-top]').trigger('click'); open('legacy')
  assert.match($('[data-call-history-detail]').text(), /question was not saved/)
  assert.match($('[data-call-history-detail]').text(), /No correct answer was configured/)
  assert.match($('[data-call-history-detail]').text(), /Legacy answer/)
  assert.doesNotMatch($('[data-call-history-detail]').text(), /undefined|Invalid Date/)
  installed.client.dispose(); win.close()
})

test('an open history detail follows snapshots and clears data when a call leaves the retained profile history', () => {
  const { win, $ } = fixture()
  const call = { id: 'current', title: 'Current', question: 'Original question', status: 'completed', finished_at: 1 }
  win.__cupitorCalls = { calls: [call] }
  const installed = installStudyCalls(win, $); installed.open()
  $('[data-call-history-toggle]').trigger('click'); $('[data-call-view-details]').trigger('click')
  const update = calls => win.dispatchEvent(new win.CustomEvent('cupitorCalls', { detail: { calls } }))
  update([{ ...call, question: 'Updated full question' }])
  assert.match($('[data-call-history-detail]').text(), /Updated full question/)
  update([call, ...Array.from({ length: 100 }, (_, i) => ({ id: 'new-' + i, title: 'New', status: 'completed', finished_at: i + 2 }))])
  assert.match($('[data-call-history-detail]').text(), /no longer in this profile’s latest 100/)
  assert.doesNotMatch($('[data-call-history-detail]').text(), /Original question|Updated full question/)
  assert.equal($('[data-call-history-rows] [data-call-view-details]').length, 100)
  update([])
  assert.doesNotMatch($('[data-call-history-detail]').text(), /Original question/)
  $('[data-call-back-top]').trigger('click')
  assert.match($('[data-call-history-rows]').text(), /No calls yet/)
  installed.client.dispose(); win.close()
})

test('a cold notification tap opens the exact missed history item and Back returns through history', async () => {
  const { win, $ } = fixture()
  win.__cupitorCalls = { calls: [
    { id: 'other', title: 'Another call', question: 'Other question', status: 'completed', finished_at: 2 },
    { id: 'missed', title: 'Missed Swedish question', question: 'Vad betyder försynt?', choices: ['Stillsam', 'Högljudd'],
      correct_choice_index: 0, status: 'missed', finished_at: 1 },
  ] }
  win.__cupitorStudyCallOpened = { id: 'missed', open_id: 'cold-tap' }
  const installed = installStudyCalls(win, $)
  await new Promise(resolve => $(resolve))
  assert.equal($('[data-call-view=history-detail]').css('display'), 'block')
  assert.match($('[data-call-history-detail]').text(), /Vad betyder försynt\?/)
  assert.match($('[data-call-history-detail]').text(), /1\. Stillsam/)
  assert.match($('[data-call-history-detail]').text(), /No answer was recorded/)
  assert.doesNotMatch($('[data-call-history-detail]').text(), /Other question/)
  assert.equal(win.__cupitorStudyCallOpened, null)
  $('[data-call-back-top]').trigger('click')
  assert.equal($('[data-call-view=history]').css('display'), 'block')
  win.dispatchEvent(new win.CustomEvent('cupitorStudyCallOpened', { detail: { id: 'missed', open_id: 'cold-tap' } }))
  assert.equal($('[data-call-view=history]').css('display'), 'block', 'duplicate delivery must not undo Back')
  $('[data-call-back-top]').trigger('click')
  assert.equal($('[data-call-view=list]').css('display'), 'block')
  installed.client.dispose(); win.close()
})

test('a warm notification tap opens details before a delayed snapshot and handles expired history', () => {
  const { win, $ } = fixture()
  const installed = installStudyCalls(win, $); installed.open()
  const tap = detail => win.dispatchEvent(new win.CustomEvent('cupitorStudyCallOpened', { detail }))
  for (const detail of [{}, { id: 7 }, { id: '' }, { id: 'x'.repeat(129) }]) tap(detail)
  assert.equal($('[data-call-view=list]').css('display'), 'block')
  $('[data-call-open-settings]').trigger('click')
  tap({ id: 'later', open_id: 'tap-1', profile_id: 99 })
  assert.equal($('[data-call-back-top]').text(), '← Back to call history')
  assert.match($('[data-call-history-detail]').text(), /no longer in this profile’s latest 100/)
  win.dispatchEvent(new win.CustomEvent('cupitorCalls', { detail: { calls: [
    { id: 'later', title: 'Later', question: 'Full missed question', status: 'missed' },
  ] } }))
  assert.match($('[data-call-history-detail]').text(), /Full missed question/)
  $('[data-call-back-top]').trigger('click')
  tap({ id: 'later', open_id: 'tap-2' })
  assert.equal($('[data-call-view=history-detail]').css('display'), 'block', 'a new tap may reopen the same call')
  tap({ id: 'evicted', open_id: 'tap-3' })
  assert.match($('[data-call-history-detail]').text(), /no longer in this profile’s latest 100/)
  assert.doesNotMatch($('[data-call-history-detail]').text(), /Full missed question/)
  installed.client.dispose(); win.close()
})

test('new alternatives keep the selected correct answer while typing and removing rows', async () => {
  const { win, $ } = fixture()
  const installed = installStudyCalls(win, $); installed.open()
  $('[data-call-add]').trigger('click')
  $('[data-call-alternative-add]').trigger('click')
  $('[data-call-alternatives] input[type=radio]').eq(2).prop('checked', true).trigger('change')
  $('[data-call-alternatives] input[type=text]').eq(2).val('Third answer').trigger('input')
  assert.equal($('[data-call-correct]').val(), '2')
  $('[data-call-alternatives] button').first().trigger('click')
  assert.equal($('[data-call-correct]').val(), '1')
  assert.deepEqual($('[data-call-choices]').val().split('\n'), ['No', 'Third answer'])
  assert.equal($('[data-call-alternatives] input[type=radio]').eq(1).prop('checked'), true)
  installed.client.dispose(); win.close()
})

test('settings persist queue capacity and voice; large imports paginate and support pasted JSON', async () => {
  const { win, $ } = fixture(), sent = []
  let limit = 50, voiceName = '', rate = 1
  const questions = Array.from({length:120}, (_, i) => ({...CALL_IMPORT_EXAMPLE.calls[0], title:`Question ${i + 1}`}))
  const pending = questions.map((call, i) => ({...call, id:String(i), when_ms:Date.now()+3600000+i*60000, status:'scheduled'}))
  win.CallBridge = {postMessage(raw) {
    const r=JSON.parse(raw); sent.push(r)
    if(r.op==='setSettings') { limit=r.pending_limit; voiceName=r.voice_name; rate=r.speech_rate }
    const data=r.op==='getCapabilities' ? {supported:true, permission:'granted', batch_schedule:true, settings:true,
      pending_limit:limit, pending_count:120, voice_selection:true, voice_name:voiceName, speech_rate:rate} :
      r.op==='getCalls' ? {calls:pending} : r.op==='getVoices' ? {voices:[{name:'sv-test',language:'sv-SE',label:'Swedish voice'}]} : true
    win.dispatchEvent(new win.CustomEvent('cupitorCallAck',{detail:{...r,ok:true,data}}))
  }}
  const installed=installStudyCalls(win,$); installed.open()
  const flush=()=>new Promise(resolve=>setImmediate(resolve)); await flush()
  assert.equal($('[data-call-pending] .study-call-history-row').length,50)
  $('[data-call-pending-more]').trigger('click')
  assert.equal($('[data-call-pending] .study-call-history-row').length,100)
  $('[data-call-search]').val('Question 120').trigger('input')
  assert.equal($('[data-call-pending] .study-call-history-row').length,1)
  $('[data-call-open-import]').trigger('click')
  assert.equal($('[data-call-status]').text(),'')
  $('[data-call-import-paste]').val(JSON.stringify({calls:questions}))
  $('[data-call-import-paste-submit]').trigger('click')
  assert.match($('[data-call-status]').text(),/Settings/)
  $('[data-call-open-settings]').trigger('click'); await flush()
  $('[data-call-limit]').val('500')
  $('[data-call-default-voice]').val('sv-test'); $('[data-call-default-rate]').val('0.75')
  $('[data-call-preview-voice]').trigger('click'); await flush()
  const preview=sent.find(r=>r.op==='previewVoice')
  assert.equal(preview.voice_name,'sv-test'); assert.equal(preview.speech_rate,0.75)
  $('[data-call-save-settings]').trigger('click'); await flush()
  assert.equal(limit,500); assert.equal(voiceName,'sv-test'); assert.equal(rate,0.75)
  $('[data-call-open-import]').trigger('click'); $('[data-call-import-paste-submit]').trigger('click')
  assert.equal($('[data-call-import-drafts] .study-call-history-row').length,50)
  assert.match($('[data-call-import-count]').text(),/120/)
  $('[data-call-import-more]').trigger('click')
  assert.equal($('[data-call-import-drafts] .study-call-history-row').length,100)
  assert.match($('[data-call-import-name]').text(),/Pasted JSON/)
  installed.client.dispose(); win.close()
})

test('foreground refresh preserves voice settings until the user saves them', async () => {
  const { win, $ } = fixture(), sent = []
  let saved = { pending_limit: 50, voice_name: '', speech_rate: 1 }
  win.CallBridge = { postMessage(raw) {
    const r = JSON.parse(raw); sent.push(r)
    if (r.op === 'setSettings') saved = { pending_limit: r.pending_limit, voice_name: r.voice_name, speech_rate: r.speech_rate }
    const data = r.op === 'getCapabilities' ? { supported: true, permission: 'granted', settings: true, voice_selection: true, ...saved } :
      r.op === 'getVoices' ? { voices: [{ name: 'sv-one', language: 'sv-SE' }, { name: 'sv-two', language: 'sv-SE' }] } :
        r.op === 'getCalls' ? { calls: [] } : true
    win.dispatchEvent(new win.CustomEvent('cupitorCallAck', { detail: { ...r, ok: true, data } }))
  } }
  const installed = installStudyCalls(win, $); installed.open()
  // Native select/system dialogs can emit a foreground event before Save is tapped.
  Object.defineProperty($('#studyCallsDialog')[0], 'offsetWidth', { configurable: true, value: 400 })
  const flush = () => new Promise(resolve => setImmediate(resolve)); await flush()
  $('[data-call-open-settings]').trigger('click'); await flush()
  $('[data-call-default-voice]').val('sv-two')
  win.dispatchEvent(new win.CustomEvent('cupitorAppLifecycle', { detail: { isForeground: true } })); await flush()
  assert.equal($('[data-call-default-voice]').val(), 'sv-two', 'resume before the native change event must preserve the selection')
  $('[data-call-default-voice]').val('sv-two').trigger('change')
  $('[data-call-default-rate]').val('0.75').trigger('change')
  $('[data-call-limit]').val('200').trigger('input')
  win.dispatchEvent(new win.CustomEvent('cupitorAppLifecycle', { detail: { isForeground: true } })); await flush()
  assert.equal($('[data-call-default-voice]').val(), 'sv-two')
  assert.equal($('[data-call-default-rate]').val(), '0.75')
  assert.equal($('[data-call-limit]').val(), '200')
  $('[data-call-save-settings]').trigger('click'); await flush()
  assert.deepEqual(saved, { pending_limit: 200, voice_name: 'sv-two', speech_rate: 0.75 })
  $('[data-call-back-top]').trigger('click'); $('[data-call-open-settings]').trigger('click'); await flush()
  assert.equal($('[data-call-default-voice]').val(), 'sv-two')
  installed.client.dispose(); win.close()
})

test('language dropdowns filter voices, reset incompatible choices and preserve imported locales', async () => {
  const { win, $ } = fixture(), sent = []
  const voices = [{ name: 'sv-one', language: 'sv-SE' }, { name: 'sv-two', language: 'sv-FI' },
    { name: 'en-one', language: 'en-GB' }, { name: 'en-two', language: 'en-US' }]
  win.CallBridge = { postMessage(raw) {
    const r = JSON.parse(raw); sent.push(r)
    const data = r.op === 'getCapabilities' ? { supported: true, permission: 'granted', settings: true, voice_selection: true, voice_name: 'en-one', speech_rate: 1 } :
      r.op === 'getVoices' ? { voices } : r.op === 'getCalls' ? { calls: [] } : true
    win.dispatchEvent(new win.CustomEvent('cupitorCallAck', { detail: { ...r, ok: true, data } }))
  } }
  const installed = installStudyCalls(win, $); installed.open()
  const flush = () => new Promise(resolve => setImmediate(resolve)); await flush()
  $('[data-call-open-settings]').trigger('click'); await flush()
  const options = selector => $(selector).find('option').toArray().map(option => option.value)
  assert.equal($('[data-call-preview-language]')[0].tagName, 'SELECT')
  assert.equal($('[data-call-preview-language]').val(), 'sv-SE', 'the page language selects the initial filter')
  assert.deepEqual(options('[data-call-default-voice]'), ['', 'sv-one', 'sv-two'])
  $('[data-call-preview-language]').val('en-GB').trigger('change')
  assert.deepEqual(options('[data-call-default-voice]'), ['', 'en-one', 'en-two'])
  $('[data-call-preview-language]').val('sv-SE').trigger('change')
  assert.deepEqual(options('[data-call-default-voice]'), ['', 'sv-one', 'sv-two'])
  assert.equal($('[data-call-default-voice]').val(), '', 'the previous English voice is cleared')
  $('[data-call-default-voice]').val('sv-two').trigger('change')
  $('[data-call-preview-voice]').trigger('click'); await flush()
  assert.deepEqual([sent.at(-1).op, sent.at(-1).voice_name, sent.at(-1).language], ['previewVoice', 'sv-two', 'sv-SE'])
  $('[data-call-back-top]').trigger('click'); $('[data-call-add]').trigger('click'); await flush()
  assert.equal($('[data-call-language]')[0].tagName, 'SELECT')
  assert.deepEqual(options('[data-call-voice-name]'), ['__default__', '', 'sv-one', 'sv-two'])
  assert.match($('[data-call-editor-voice-note]').text(), /Settings voice is for .*en-GB/)
  $('[data-call-preview-editor]').trigger('click'); await flush()
  assert.equal(sent.at(-1).voice_name, '', 'a different-language Settings voice previews the actual device fallback')
  $('[data-call-voice-name]').val('sv-one').trigger('change')
  $('[data-call-language]').val('en-GB').trigger('change')
  assert.deepEqual(options('[data-call-voice-name]'), ['__default__', '', 'en-one', 'en-two'])
  assert.equal($('[data-call-voice-name]').val(), '__default__')
  $('[data-call-back-top]').trigger('click'); $('[data-call-open-import]').trigger('click')
  $('[data-call-import-paste]').val(JSON.stringify({ calls: [{ ...CALL_IMPORT_EXAMPLE.calls[0], language: 'fr-CA' }] }))
  $('[data-call-import-paste-submit]').trigger('click')
  $('[data-call-import-drafts] button').filter((_, el) => el.textContent === 'Edit').trigger('click')
  assert.equal($('[data-call-language]').val(), 'fr-CA', 'an imported language absent from installed voices is preserved')
  assert.deepEqual(options('[data-call-voice-name]'), ['__default__', ''])
  installed.client.dispose(); win.close()
})

test('Back follows nested screens and leaves unfinished edits without changing calls', async () => {
  const { win, $ } = fixture(), sent = []
  const pending = { ...CALL_IMPORT_EXAMPLE.calls[0], id: 'pending', status: 'scheduled', when_ms: Date.now() + 3600000 }
  win.CallBridge = { postMessage(raw) {
    const r = JSON.parse(raw); sent.push(r)
    const data = r.op === 'getCapabilities' ? { supported: true, permission: 'granted', settings: true, edit_scheduled: true } :
      r.op === 'getCalls' ? { calls: [pending] } : true
    win.dispatchEvent(new win.CustomEvent('cupitorCallAck', { detail: { ...r, ok: true, data } }))
  } }
  const installed = installStudyCalls(win, $); installed.open()
  const flush = () => new Promise(resolve => setImmediate(resolve)); await flush()
  const view = () => $('[data-call-view]').filter((_, el) => $(el).css('display') !== 'none').attr('data-call-view')
  const back = () => $('[data-call-back-top]').trigger('click')
  assert.equal($('[data-call-back-bar]').css('display'), 'none')
  $('[data-call-open-import]').trigger('click')
  $('[data-call-import-load-example]').trigger('click')
  $('[data-call-open-settings]').trigger('click'); await flush()
  assert.match($('[data-call-back-top]').text(), /Back to import review/)
  $('[data-call-history-toggle]').trigger('click')
  assert.match($('[data-call-back-top]').text(), /Back to settings/)
  back(); assert.equal(view(), 'settings')
  back(); assert.equal(view(), 'import')
  assert.equal($('[data-call-import-drafts] .study-call-history-row').length, 2)
  $('[data-call-import-drafts] button').filter((_, el) => el.textContent === 'Edit').first().trigger('click')
  assert.match($('[data-call-back-top]').text(), /Back to import review/)
  $('[data-call-question]').val('') // Invalid form must still allow Back, without autosaving.
  back(); assert.equal(view(), 'import')
  $('[data-call-import-drafts] button').filter((_, el) => el.textContent === 'Edit').first().trigger('click')
  assert.equal($('[data-call-question]').val(), CALL_IMPORT_EXAMPLE.calls[0].question)
  $('[data-call-editor-cancel]').trigger('click'); assert.equal(view(), 'import')
  back(); assert.equal(view(), 'list')
  $('[data-call-pending] button').filter((_, el) => el.textContent === 'Edit call').trigger('click')
  $('[data-call-question]').val('Unsaved change')
  back(); assert.equal(view(), 'list')
  $('[data-call-add]').trigger('click'); assert.equal($('[data-call-submit=later]').text(), 'Schedule call')
  back(); assert.equal(view(), 'list')
  assert.equal(sent.filter(r => ['update', 'schedule', 'scheduleBatch', 'callNow'].includes(r.op)).length, 0)
  assert.equal($('[data-call-back-bar]').css('display'), 'none')
  installed.client.dispose(); win.close()
})

test('voice import settings preserve overrides and reject invalid types and speeds', () => {
  const call={...CALL_IMPORT_EXAMPLE.calls[0],voice_name:'sv-test',speech_rate:0.75}
  assert.equal(parseCallImport(JSON.stringify([call]))[0].voice_name,'sv-test')
  assert.equal(parseCallImport(JSON.stringify([call]))[0].speech_rate,0.75)
  for(const change of [{speech_rate:0.1},{speech_rate:2},{speech_rate:'0.75'},{voice_name:4}])
    assert.throws(()=>parseCallImport(JSON.stringify([{...call,...change}])))
})


test('repetition pauses inherit or override across import, export and scheduling', () => {
  const form = { title: 'Words', question: 'Which?', choices: 'A\nB', language: 'sv-SE', correctChoice: 0 }
  assert.equal(callPayload(form).repetition_pause_seconds, undefined)
  for (const value of [0, 0.5, 3, 120]) assert.equal(callPayload({ ...form, repetitionPause: value }).repetition_pause_seconds, value)
  for (const value of [null, '3', -1, 120.1, NaN, Infinity]) assert.throws(() => callPayload({ ...form, repetitionPause: value }), /repetition pause/)
  const file = { version: 1, defaults: { language: 'sv-SE', repetition_pause_seconds: 7.5 }, calls: [
    CALL_IMPORT_EXAMPLE.calls[0], { ...CALL_IMPORT_EXAMPLE.calls[1], repetition_pause_seconds: 0 },
  ] }
  const calls = parseCallImport(JSON.stringify(file))
  assert.deepEqual(calls.map(c => c.repetition_pause_seconds), [7.5, 0])
  const scheduled = scheduleImportedCalls(parseCallImport(JSON.stringify({version:1,calls})), Date.now()+600000)
  assert.deepEqual(scheduled.map(c => c.repetition_pause_seconds), [7.5, 0])
  assert.throws(() => parseCallImport(JSON.stringify({ ...file, defaults: { repetition_pause_seconds: '5' } })), /Call 1.*repetition pause/)
})

test('repetition Settings preserve drafts on foreground and editor overrides survive import', async () => {
  const { win, $ } = fixture(), sent = []
  let pause = 3
  win.CallBridge = { postMessage(raw) {
    const r = JSON.parse(raw); sent.push(r)
    if (r.op === 'setSettings') pause = r.repetition_pause_seconds
    const data = r.op === 'getCapabilities' ? { supported:true, permission:'granted', settings:true,
      pending_limit:50, repetition_controls:true, repetition_pause_seconds:pause,
      command_hints:{sv:'vänta / kör / igen / en gång till',en:'wait / go / again'} } :
      r.op === 'getCalls' ? { calls:[] } : true
    win.dispatchEvent(new win.CustomEvent('cupitorCallAck',{detail:{...r,ok:true,data}}))
  } }
  const flush = () => new Promise(resolve=>setImmediate(resolve))
  const installed = installStudyCalls(win,$); installed.open(); await flush()
  $('[data-call-open-settings]').trigger('click'); await flush()
  assert.equal($('[data-call-default-pause]').val(),'3')
  $('[data-call-default-pause]').val('7.5').trigger('input')
  win.dispatchEvent(new win.CustomEvent('cupitorAppLifecycle',{detail:{isForeground:true}})); await flush()
  assert.equal($('[data-call-default-pause]').val(),'7.5')
  $('[data-call-save-settings]').trigger('click'); await flush()
  assert.equal(pause,7.5)
  $('[data-call-add]').trigger('click')
  assert.equal($('[data-call-repetition-pause]').val(),'')
  assert.match($('[data-call-repetition-pause]').attr('placeholder'),/7.5/)
  assert.match($('[data-call-command-hint]').text(),/vänta/)
  $('[data-call-language]').val('en-US').trigger('change')
  assert.match($('[data-call-command-hint]').text(),/wait/)
  $('[data-call-back-top]').trigger('click'); $('[data-call-open-import]').trigger('click')
  $('[data-call-import-paste]').val(JSON.stringify({calls:[{...CALL_IMPORT_EXAMPLE.calls[0],repetition_pause_seconds:2.5}]}))
  $('[data-call-import-paste-submit]').trigger('click')
  $('[data-call-import-drafts] button').filter((_,el)=>el.textContent==='Edit').first().trigger('click')
  assert.equal($('[data-call-repetition-pause]').val(),'2.5')
  $('[data-call-repetition-pause]').val('4')
  $('[data-call-import-save]').trigger('click')
  $('[data-call-import-drafts] button').filter((_,el)=>el.textContent==='Edit').first().trigger('click')
  assert.equal($('[data-call-repetition-pause]').val(),'4')
  installed.client.dispose(); win.close()
})
