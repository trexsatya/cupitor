import { createPracticeVideoCues } from './practice-video.js'

function setup(ready = true) {
  const player = { pauseVideo: jest.fn(), cueVideoById: jest.fn(), loadVideoById: jest.fn(), playVideo: jest.fn() }
  const state = { ready, active: true }
  let release
  const waitUntil = jest.fn(() => new Promise(resolve => { release = resolve }))
  const cues = createPracticeVideoCues({ getPlayer: () => player, isReady: () => state.ready,
    isActive: () => state.active, waitUntil })
  return { player, state, cues, waitUntil, release: () => release() }
}
test('preparing a card pauses immediately and cues at its start without autoplay or seeking', async () => {
  const { cues, player } = setup()
  const token = cues.invalidate()
  expect(player.pauseVideo).toHaveBeenCalledTimes(1)
  await expect(cues.cue('video-a', 95, token)).resolves.toBe(true)
  expect(player.cueVideoById).toHaveBeenCalledWith({ videoId: 'video-a', startSeconds: 95 })
  expect(player.loadVideoById).not.toHaveBeenCalled()
  expect(player.playVideo).not.toHaveBeenCalled()
})
test('a stale request cannot cue even when its old card becomes current again', async () => {
  const { cues, player } = setup()
  const old = cues.invalidate()
  cues.invalidate()
  const current = cues.invalidate()
  await expect(cues.cue('video-a', 1, old)).resolves.toBe(false)
  await cues.cue('video-a', 10, current)
  expect(player.cueVideoById.mock.calls).toEqual([[{ videoId: 'video-a', startSeconds: 10 }]])
})
test('navigation cancels a cue waiting for the player to become ready', async () => {
  const { cues, player, state, release, waitUntil } = setup(false)
  const pending = cues.cue('old', 10, cues.invalidate())
  expect(waitUntil).toHaveBeenCalledTimes(1)
  cues.invalidate()
  state.ready = true
  release()
  await expect(pending).resolves.toBe(false)
  expect(player.cueVideoById).not.toHaveBeenCalled()
})
test('late preparation cannot pause a deliberately started listen', async () => {
  const { cues, player, state, release } = setup(false)
  const pending = cues.cue('video-a', 10, cues.invalidate())
  cues.invalidate()
  player.playVideo()
  const pauses = player.pauseVideo.mock.calls.length
  state.ready = true
  release()
  await pending
  expect(player.pauseVideo).toHaveBeenCalledTimes(pauses)
  expect(player.cueVideoById).not.toHaveBeenCalled()
})
test('closing practice ends the ready wait without loading a hidden video', async () => {
  const { cues, player, state, release, waitUntil } = setup(false)
  const pending = cues.cue('video-a', 10, cues.invalidate())
  state.active = false
  expect(waitUntil.mock.calls[0][0]()).toBe(true)
  release()
  await expect(pending).resolves.toBe(false)
  expect(player.cueVideoById).not.toHaveBeenCalled()
})

function delayedSound(initiallyMuted = false) {
  const state = { muted: initiallyMuted, id: 'old', status: 1 }
  const waiters = []
  const player = {
    isMuted: () => state.muted,
    mute: jest.fn(() => { state.muted = true }), unMute: jest.fn(() => { state.muted = false }),
    pauseVideo: jest.fn(), cueVideoById: jest.fn(),
    getPlayerState: () => state.status, getVideoData: () => ({ video_id: state.id })
  }
  const cues = createPracticeVideoCues({ getPlayer: () => player, isReady: () => true, isActive: () => true,
    waitUntil: predicate => new Promise(resolve => waiters.push(() => { if (predicate()) resolve() })) })
  return { cues, player, state, settle: (id) => { state.id = id; state.status = 5; waiters.forEach(check => check()) } }
}

test('transition mutes before the asynchronous pause and restores sound only after the new cue is acknowledged', async () => {
  const { cues, player, state, settle } = delayedSound()
  const token = cues.invalidate()
  const pending = cues.cue('new', 10, token)
  expect(state.muted).toBe(true)
  expect(player.mute.mock.invocationCallOrder[0]).toBeLessThan(player.pauseVideo.mock.invocationCallOrder[0])
  expect(player.unMute).not.toHaveBeenCalled()
  settle('new')
  await pending
  expect(state.muted).toBe(false)
})

test('a superseded cue cannot restore sound; deliberate Play can cancel the transition mute', async () => {
  const { cues, state, settle } = delayedSound()
  const pending = cues.cue('old', 10, cues.invalidate())
  const current = cues.invalidate()
  settle('old')
  await expect(pending).resolves.toBe(false)
  expect(state.muted).toBe(true)
  expect(cues.beginPlayback(current - 1)).toBe(false)
  expect(state.muted).toBe(true)
  expect(cues.beginPlayback(current)).toBe(true)
  expect(state.muted).toBe(false)
})

test('transition cleanup preserves a user-muted player', async () => {
  const { cues, state, settle } = delayedSound(true)
  const pending = cues.cue('new', 10, cues.invalidate())
  settle('new')
  await pending
  cues.releaseMute()
  expect(state.muted).toBe(true)
})

test('a normal pause or leaving Practice does not acquire a new transition mute', () => {
  const { cues, player, state } = delayedSound()
  cues.invalidate({ mute: false })
  expect(state.muted).toBe(false)
  expect(player.mute).not.toHaveBeenCalled()
  expect(player.pauseVideo).toHaveBeenCalled()
})
