import { createRecordingVideoAttempt, VIDEO_RECOVERY_MS } from './recording-video'

beforeEach(() => { jest.useFakeTimers(); jest.setSystemTime(0) })
afterEach(() => jest.useRealTimers())

function setup() {
  const state = { current: true, paused: false }
  const attempt = createRecordingVideoAttempt({ videoId: 'wanted', isCurrent: () => state.current, isPaused: () => state.paused })
  const result = attempt.wait(new Promise(() => {})).catch(e => e)
  return { attempt, result, state }
}

test('a pending metadata/ready/load/seek wait is bounded by one 20-second budget', async () => {
  const { attempt, result } = setup()
  jest.advanceTimersByTime(VIDEO_RECOVERY_MS - 100)
  expect(attempt.active()).toBe(true)
  jest.advanceTimersByTime(100)
  expect((await result).kind).toBe('timeout')
  expect(attempt.active()).toBe(false)
  expect(jest.getTimerCount()).toBe(0)
})

test.each([-1, 0, 2, 3, 5])('state %s and a stale playhead do not prove playback or extend recovery', async state => {
  const { attempt, result } = setup()
  for (let i = 0; i < 20; i++) {
    attempt.observe(100 + i, state, 'wanted')
    jest.advanceTimersByTime(1000)
  }
  expect(attempt.played).toBe(false)
  expect((await result).kind).toBe('timeout')
})

test('a different video or initial seek jump cannot extend the deadline', async () => {
  const { attempt, result } = setup()
  attempt.observe(0, 1, 'wanted')
  attempt.observe(150, 1, 'wanted')
  attempt.observe(151, 1, 'old-video')
  expect(attempt.played).toBe(false)
  jest.advanceTimersByTime(VIDEO_RECOVERY_MS)
  expect((await result).kind).toBe('timeout')
})

test('real playback refreshes recovery and a later endless buffer is still bounded', async () => {
  const { attempt, result } = setup()
  attempt.observe(100, 1, 'wanted')
  for (let i = 1; i <= 30; i++) {
    jest.advanceTimersByTime(1000)
    attempt.observe(100 + i, 1, 'wanted')
  }
  expect(attempt.played).toBe(true)
  expect(attempt.active()).toBe(true)
  attempt.observe(130, 3, 'wanted')
  jest.advanceTimersByTime(VIDEO_RECOVERY_MS)
  expect((await result).kind).toBe('timeout')
})

test('navigation/stop cancels a pending operation and late completion cannot revive it', async () => {
  const { attempt, result } = setup()
  attempt.cancel()
  expect((await result).kind).toBe('cancelled')
  attempt.observe(1, 1, 'wanted')
  attempt.observe(2, 1, 'wanted')
  expect(attempt.active()).toBe(false)
  expect(jest.getTimerCount()).toBe(0)
})

test('a recoverable error after playback stays in recovery until genuine progress resumes', async () => {
  const { attempt, result } = setup()
  attempt.observe(1, 1, 'wanted')
  attempt.observe(1.1, 1, 'wanted')
  expect(attempt.played).toBe(true)
  attempt.noteError()
  attempt.observe(1.1, 2, 'wanted')
  expect(attempt.recovering).toBe(true)
  attempt.observe(1.1, 1, 'wanted')
  attempt.observe(1.2, 1, 'wanted')
  expect(attempt.recovering).toBe(false)
  attempt.noteError()
  jest.advanceTimersByTime(VIDEO_RECOVERY_MS)
  expect((await result).kind).toBe('timeout')
})

test('loss of ownership also settles the wait and cancels the timer', async () => {
  const { attempt, result, state } = setup()
  state.current = false
  jest.advanceTimersByTime(100)
  expect((await result).kind).toBe('cancelled')
  expect(jest.getTimerCount()).toBe(0)
})

test('an explicit pause freezes the recovery budget without marking playback failed', async () => {
  const { attempt, result, state } = setup()
  jest.advanceTimersByTime(10000)
  state.paused = true
  jest.advanceTimersByTime(60000)
  expect(attempt.active()).toBe(true)
  state.paused = false
  jest.advanceTimersByTime(10000)
  expect((await result).kind).toBe('timeout')
})

test('confirmed errors settle each attempt even when the same video is retried', async () => {
  for (let i = 0; i < 2; i++) {
    const { attempt, result } = setup()
    attempt.request()
    expect(attempt.requested).toBe(true)
    attempt.fail('unavailable', 100)
    const error = await result
    expect(error.kind).toBe('unavailable')
    expect(error.code).toBe(100)
  }
})
