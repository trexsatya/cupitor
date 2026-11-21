import { createStudyTimeoutPrompt } from './study-timeout-prompt.js'
import { createStudySessionTimeout } from './study-session-timeout.js'

let prompt
beforeEach(() => {
  jest.useFakeTimers()
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '')
    this.querySelector('button').focus()
  }
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open') }
  prompt = createStudyTimeoutPrompt()
})
afterEach(() => {
  document.querySelector('#practiceTimeoutDialog button')?.click()
  jest.useRealTimers()
})

test('timeout stays blocking until the Close button is pressed, then waits for intentional playback', () => {
  const expired = jest.fn(() => prompt.show())
  const timeout = createStudySessionTimeout(expired, { canStart: () => !prompt.blocked })
  timeout.start(1)
  jest.advanceTimersByTime(60000)
  const dialog = document.querySelector('#practiceTimeoutDialog')
  expect(dialog.getAttribute('role')).toBe('alertdialog')
  expect(dialog.hasAttribute('open')).toBe(true)
  expect(document.activeElement).toBe(dialog.querySelector('button'))
  jest.advanceTimersByTime(10 * 60000)
  expect(dialog.isConnected).toBe(true)
  expect(timeout.ensure(1)).toBe(false)
  expect(timeout.start(0)).toBe(false)
  expect(timeout.expired).toBe(true)
  expect(timeout.blocked).toBe(true)
  dialog.querySelector('button').click()
  expect(prompt.blocked).toBe(false)
  expect(timeout.blocked).toBe(false)
  expect(timeout.expired).toBe(true)
  jest.advanceTimersByTime(60000)
  expect(expired).toHaveBeenCalledTimes(1)
  expect(timeout.ensure(1)).toBe(true)
  jest.advanceTimersByTime(60000)
  expect(expired).toHaveBeenCalledTimes(2)
  expect(prompt.blocked).toBe(true)
})

test('Escape, cancellation, backdrop clicks and app shortcuts cannot dismiss or bypass the popup', () => {
  prompt.show()
  const dialog = document.querySelector('#practiceTimeoutDialog')
  const button = dialog.querySelector('button')
  const shortcut = jest.fn()
  document.addEventListener('keydown', shortcut)
  const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
  button.dispatchEvent(escape)
  expect(escape.defaultPrevented).toBe(true)
  const cancel = new Event('cancel', { cancelable: true })
  dialog.dispatchEvent(cancel)
  expect(cancel.defaultPrevented).toBe(true)
  dialog.click()
  button.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  expect(shortcut).not.toHaveBeenCalled()
  const media = new CustomEvent('cupitorMediaKey', { detail: { key: 'play_pause' }, cancelable: true })
  window.dispatchEvent(media)
  expect(media.defaultPrevented).toBe(true)
  expect(prompt.blocked).toBe(true)
  // Enter/Space keep their native button activation behavior, while app
  // shortcuts do not see the same key and start playback after dismissing it.
  const enter = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
  button.dispatchEvent(enter)
  expect(enter.defaultPrevented).toBe(false)
  button.click()
  document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  expect(shortcut).toHaveBeenCalledTimes(1)
  document.removeEventListener('keydown', shortcut)
})

test('repeated expiry checks show one popup and a deferred recorder does not open it early', () => {
  let recording = true
  const timeout = createStudySessionTimeout(() => {
    if (recording) return false
    prompt.show()
  }, { canStart: () => !prompt.blocked })
  timeout.start(1)
  jest.advanceTimersByTime(61000)
  expect(prompt.blocked).toBe(false)
  recording = false
  jest.advanceTimersByTime(1000)
  timeout.check()
  prompt.show()
  expect(document.querySelectorAll('#practiceTimeoutDialog')).toHaveLength(1)
  expect(timeout.ensure(1)).toBe(false)
})

test('a face audio download already in flight cannot start after expiry', async () => {
  const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm')
  const source = fs.readFileSync(path.join(__dirname, 'language.js'), 'utf8')
  let loaded
  const pending = new Promise(resolve => { loaded = resolve })
  const play = jest.fn()
  const context = {
    window: { _practiceActive: true, _practiceMinimized: true, _practiceClipToken: 1,
      _appSettings: { studySessionTimeoutMinutes: 1 } },
    _pracRec: null, _practiceTimeoutPrompt: prompt, createStudySessionTimeout,
    _stopPracticeTts: jest.fn(), loadManualAudioData: () => pending,
    _practiceAudioEl: () => ({ play }), setTimeout, clearTimeout,
  }
  vm.createContext(context)
  const timer = source.slice(source.indexOf('const _practiceSessionTimeout ='), source.indexOf('\nfunction _checkStudySessionTimeouts()'))
  const face = source.slice(source.indexOf('async function _playPracticeFace(face)'), source.indexOf('// Show the panel for a manual card'))
  vm.runInContext(timer + '\n' + face + '\nglobalThis.session = _practiceSessionTimeout', context)
  context.session.start(1)
  const playing = context._playPracticeFace({ url: 'file:///delayed.ogg' })
  jest.advanceTimersByTime(60000)
  expect(prompt.blocked).toBe(true)
  loaded('data:audio/ogg;base64,AA==')
  await playing
  expect(play).not.toHaveBeenCalled()
  expect(context.window._practiceClipToken).toBe(2)
})
