import fs from 'fs'
import path from 'path'
import $ from 'jquery'
import _ from 'lodash'
import { buildNotifItems, makeNotifKey, webpageNotifLists } from './notif-bridge'
import { buildPlaylistCallItems, playlistCallDefaults } from './playlist-calls'
import { installStudyCalls } from './study-calls'

test('the real playlist dialog creates calls, preserves the schedule and resyncs removals', async () => {
  document.body.innerHTML = '<button id="studyCallsBtn"></button>'
  $.fn.dialog = function () { return this.show() }
  $.fn.select2 = function () { return this }
  window.alert = jest.fn()
  window.confirm = () => true
  const card = (id, source, target) => ({ manual: true, id, source, target })
  window._recordings = { Animals: { items: { Manual: { Card: [card('cat', 'katt', 'cat'), card('dog', 'hund', 'dog')] } } } }
  window._recording = { currentName: 'Animals' }
  window.__cupitorNotifSchedules = { schedules: [{ key: 'ebbinghaus', name: 'Ebbinghaus', kind: 'series' }] }
  window.__cupitorNotifLists = { lists: [] }
  const sent = []
  window.NotifBridge = { postMessage(raw) {
    const r = JSON.parse(raw); sent.push(r)
    const lists = window.__cupitorNotifLists.lists
    const list = lists.find(l => l.external_key === r.external_key)
    if (r.op === 'createList') lists.push({ ...r, source: 'webpage', status: 'active' })
    if (r.op === 'syncItems') list.items = r.items
    if (r.op === 'setDelivery') {
      const { response_type, ...config } = r.call_config
      Object.assign(list, { delivery: r.delivery, call_config: { ...config, answer_type: response_type } })
    }
    const data = r.op === 'getCapabilities' ? { supported: true, permission: 'granted', delivery_modes: ['notification', 'call'] } : undefined
    window.dispatchEvent(new CustomEvent('cupitorNotifAck', { detail: { ...r, ok: true, data } }))
  } }
  const source = fs.readFileSync(path.join(__dirname, 'language.js'), 'utf8')
  const section = source.slice(source.indexOf('const _NOTIF_PENDING'), source.indexOf('// Browser test helper (no NotifBridge needed)'))
  const dependencies = { $, _, installStudyCalls,
    _buildPlaylistCallItems: buildPlaylistCallItems, _playlistCallDefaults: playlistCallDefaults,
    _buildNotifItems: buildNotifItems, _makeNotifKey: makeNotifKey, _webpageNotifLists: webpageNotifLists,
    _isVirtual: () => false, _refuseReadOnlyPlaylist: () => false, _saveRecording: jest.fn(),
    listRecordings: () => Object.keys(window._recordings),
    _ownerLabeller: () => ({ prefix: n => n }), _recordingItemCountByName: () => 2 }
  const api = new Function(...Object.keys(dependencies), section + '\nreturn { resync: _notifResyncAll };')(...Object.values(dependencies))
  const flush = async () => { for (let i = 0; i < 15; i++) await Promise.resolve() }
  window._openPlaylistCalls()
  await flush()
  expect($('#notifDelivery').val()).toBe('call')
  expect($('#studyCallsDialog')).toHaveLength(0)
  expect($('#notifCallPreview').text()).toContain('2 question')
  $('#notifEnableBtn').trigger('click'); await flush()
  expect(window.alert).not.toHaveBeenCalled()
  const created = sent.find(r => r.op === 'createList')
  expect(created.delivery).toBe('call')
  expect(created.items[0].payload.study_call.accepted_answers).toEqual(['cat'])
  expect(created.call_config.max_retries).toBe(3)
  $('#notifCallDirection').val('target-source').trigger('change')
  $('#notifCallType').val('choice').trigger('change')
  $('#notifEnableBtn').trigger('click'); await flush()
  const synced = sent.filter(r => r.op === 'syncItems').pop()
  expect(synced.items[0].payload.study_call.question).toBe('cat')
  expect(sent.some(r => r.op === 'setDelivery')).toBe(true)
  expect(sent.some(r => r.op === 'setSchedule')).toBe(false)
  delete window._recordings.Animals.callSettings
  window._openPlaylistCalls(); await flush()
  expect($('#notifCallType').val()).toBe('choice')
  expect($('#notifCallDirection').val()).toBe('target-source')
  window._recordings.Animals.items.Manual.Card.forEach(i => { i.enabled = false })
  api.resync(); await flush()
  expect(sent.filter(r => r.op === 'syncItems').pop().items).toEqual([])
})
