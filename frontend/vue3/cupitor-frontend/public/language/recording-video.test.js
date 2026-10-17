import { createRecordingVideoAttempt, confirmRecordingSeek, VIDEO_RECOVERY_MS } from './recording-video'

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

function seekSetup({ start = 120, acceptAfter = 1, ...options } = {}) {
  const state = { id: 'wanted', time: 0, playerState: 1, current: true, foreground: true }
  const player = {
    getVideoData: () => ({ video_id: state.id }), getCurrentTime: () => state.time,
    getPlayerState: () => state.playerState,
    seekTo: jest.fn(target => { if (player.seekTo.mock.calls.length >= acceptAfter) state.time = target }),
  }
  const result = confirmRecordingSeek({ player, videoId: 'wanted', start,
    isCurrent: () => state.current, isForeground: () => state.foreground, ...options }).catch(e => e)
  return { state, player, result }
}

test('a seek succeeds only after two settled samples from the requested video', async () => {
  const { result, player } = seekSetup()
  let resolved = false
  result.then(() => { resolved = true })
  await Promise.resolve()
  expect(resolved).toBe(false)
  jest.advanceTimersByTime(100)
  expect(await result).toBe(true)
  expect(player.seekTo).toHaveBeenCalledWith(120, true)
  expect(jest.getTimerCount()).toBe(0)
})

test('ignored initial seeks retry and can recover without playing from zero', async () => {
  const { result, player } = seekSetup({ acceptAfter: 3 })
  jest.advanceTimersByTime(2100)
  expect(await result).toBe(true)
  expect(player.seekTo).toHaveBeenCalledTimes(3)
})

test.each([120, 1])('a video stuck at zero never reports seek success for target %s', async start => {
  const { result } = seekSetup({ start, acceptAfter: Infinity })
  jest.advanceTimersByTime(3000)
  expect((await result).kind).toBe('seek-failed')
  expect(jest.getTimerCount()).toBe(0)
})

test.each([-1, NaN, Infinity])('invalid target %s fails without a retry loop or player commands', async start => {
  const { result, player } = seekSetup({ start })
  expect((await result).kind).toBe('invalid-clip')
  expect(player.seekTo).not.toHaveBeenCalled()
  expect(jest.getTimerCount()).toBe(0)
})

test('a matching cached timestamp from the previous video cannot satisfy a seek', async () => {
  const { result, state } = seekSetup()
  state.id = 'previous'
  jest.advanceTimersByTime(3000)
  expect((await result).kind).toBe('seek-failed')
})

test.each([-1, 2, 3, 5])('a fresh load cannot confirm a cached timestamp while in state %s', async playerState => {
  const { result, state } = seekSetup({ requirePlaying: true })
  state.playerState = playerState
  jest.advanceTimersByTime(3000)
  expect((await result).kind).toBe('seek-failed')
})

test('a superseded seek cancels without any further player commands', async () => {
  const { result, state, player } = seekSetup({ acceptAfter: Infinity })
  state.current = false
  jest.advanceTimersByTime(10000)
  expect(await result).toBe(false)
  expect(player.seekTo).toHaveBeenCalledTimes(1)
  expect(jest.getTimerCount()).toBe(0)
})

test('a paused new load is started during silent preparation before verifying its position', async () => {
  const state = { time: 0, playerState: 2 }
  const player = { getVideoData: () => ({ video_id: 'wanted' }), getCurrentTime: () => state.time,
    getPlayerState: () => state.playerState, seekTo: t => { state.time = t },
    playVideo: jest.fn(() => { state.playerState = 1 }) }
  const result = confirmRecordingSeek({ player, videoId: 'wanted', start: 120,
    requirePlaying: true, isCurrent: () => true })
  jest.advanceTimersByTime(100)
  expect(await result).toBe(true)
  expect(player.playVideo).toHaveBeenCalledTimes(1)
})

test('seeking stays parked in the background and uses the foreground clock on return', async () => {
  let activeTime = 0
  const { result, state, player } = seekSetup({ acceptAfter: 2, now: () => activeTime })
  state.foreground = false
  jest.advanceTimersByTime(60000)
  expect(player.seekTo).toHaveBeenCalledTimes(1)
  state.foreground = true
  activeTime = 1000
  jest.advanceTimersByTime(200)
  expect(await result).toBe(true)
})

function mutePlayer(muted = false) {
  return { isMuted: () => muted, mute: jest.fn(() => { muted = true }),
    unMute: jest.fn(() => { muted = false }), pauseVideo: jest.fn() }
}

test('load/seek retries keep sound off until positioning is confirmed', () => {
  const { attempt } = setup()
  const player = mutePlayer()
  attempt.preparePlayer(player)
  attempt.preparePlayer(player)
  expect(player.isMuted()).toBe(true)
  attempt.releaseMute()
  expect(player.isMuted()).toBe(false)
  attempt.dispose()
  expect(player.unMute).toHaveBeenCalledTimes(1)
})

test('an intentionally muted player stays muted after preparation', () => {
  const { attempt } = setup()
  const player = mutePlayer(true)
  attempt.preparePlayer(player)
  attempt.releaseMute()
  expect(player.isMuted()).toBe(true)
  expect(player.unMute).not.toHaveBeenCalled()
})

test('cancelling preparation pauses before restoring sound and cannot unmute a replacement', () => {
  const { attempt } = setup()
  const player = mutePlayer()
  attempt.preparePlayer(player)
  attempt.cancel()
  expect(player.pauseVideo.mock.invocationCallOrder[0]).toBeLessThan(player.unMute.mock.invocationCallOrder[0])
  player.mute()
  attempt.releaseMute()
  attempt.dispose()
  expect(player.isMuted()).toBe(true)
  expect(player.unMute).toHaveBeenCalledTimes(1)
})
