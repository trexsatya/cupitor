import { createStudyChrome } from './study-chrome'

beforeEach(() => jest.useFakeTimers())
afterEach(() => jest.useRealTimers())

function setup() {
  const render = jest.fn(), state = { blocked: false }
  const chrome = createStudyChrome({ render, blocked: () => state.blocked })
  return { chrome, render, state }
}

test('shows on entry, hides after three idle seconds, and a tap restarts the timer', () => {
  const { chrome, render } = setup()
  chrome.activate()
  jest.advanceTimersByTime(2999)
  expect(chrome.isVisible()).toBe(true)
  jest.advanceTimersByTime(1)
  expect(render).toHaveBeenLastCalledWith(false)
  chrome.show()
  expect(chrome.isVisible()).toBe(true)
  jest.advanceTimersByTime(2000)
  chrome.show()
  jest.advanceTimersByTime(2000)
  expect(chrome.isVisible()).toBe(true)
  jest.advanceTimersByTime(1000)
  expect(chrome.isVisible()).toBe(false)
})

test('editing, recording and held gestures prevent hiding until the interaction ends', () => {
  const { chrome, state } = setup()
  state.blocked = true
  chrome.activate()
  jest.advanceTimersByTime(9000)
  expect(chrome.isVisible()).toBe(true)
  state.blocked = false
  jest.advanceTimersByTime(300)
  expect(chrome.isVisible()).toBe(false)
})

test('leaving a view cancels its timer and reopening starts with visible controls', () => {
  const { chrome, render } = setup()
  chrome.activate()
  jest.advanceTimersByTime(2500)
  chrome.deactivate()
  jest.advanceTimersByTime(6000)
  expect(render).toHaveBeenLastCalledWith(true)
  expect(chrome.isVisible()).toBe(true)
  chrome.activate()
  jest.advanceTimersByTime(3000)
  expect(chrome.isVisible()).toBe(false)
})
