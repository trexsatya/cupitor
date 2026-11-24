const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, 'language.js'), 'utf8')
const begin = source.indexOf('function _practiceLoopSilenceSeconds(')
const end = source.indexOf('// Watch the playhead for the whole time', begin)
const watchBegin = source.indexOf('function _pracRecWatch()', end)
const watchEnd = source.indexOf('// Rewind to the take before', watchBegin)
if (begin < 0 || end < begin || watchBegin < 0 || watchEnd < watchBegin) throw new Error('Loop controls missing')

const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }
function fixture({ pauseOnRecordStart = false } = {}) {
  const state = {
    item: {}, phase:'idle', clipStart:10, clipStop:16,
    loop:false, loopTake:null, loopToken:0, loopPlayed:false,
    loopSeeking:false, loopSeekTimer:null, takes:[],
    timer:null, token:0, watchPos:null, awaiting:null,
  }
  const calls = [], deleted = [], audioPlays = [], audios = []
  let tick = () => {}, position = 11, next = 0, sourcePaused = false, now = 1000
  class AudioMock {
    constructor(url) { this.url = url; this.listeners = {}; this.paused = false; audios.push(this) }
    addEventListener(key, listener) { this.listeners[key] = listener }
    pause() { this.paused = true }
    play() { audioPlays.push(this.url); return Promise.resolve() }
  }
  const context = {
    _pracRec:state,
    isYoutubeAdPlaying:()=>false,
    window: { _practiceActive:true, _practiceMinimized:false, _appSettings:{},
      ytPlayer: {seekTo:(t, play)=>{calls.push(['seek',t,play]); position=t}} },
    _pracRecTakeOverPlayhead:()=>calls.push(['takeover']),
    _pracRecPlayVideo:()=>{ sourcePaused = false; calls.push(['play']) },
    _pracRecPauseVideo:()=>{ sourcePaused = true; calls.push(['pause']) },
    practicePaddingSeconds:value=>Number.isFinite(Number(value)) ? Math.max(0, Number(value)) : 0,
    _practicePadding:()=>({before:0, after:0}),
    _pracRecNow:()=>position,
    _pracRecRefreshClip:async()=>{},
    _practiceSpeakOverShown:()=>true,
    _takeDueForPass:()=>null,
    _pracRecClipEnd:t=>t,
    _TAKE_MAX_STEP:5,
    _TAKE_SAME_SPOT:0.12,
    _renderPracticeRecBar:note=>calls.push(['render',note]),
    _practiceSessionTimeout:{ensure() {}},
    _pracRecStartError:e=>String(e),
    _loadSpeakOverAudio:async url=>'data:audio/webm;base64,' + url.slice(-1),
    _deleteSpeakOverAudio:url=>deleted.push(url),
    _speakOverAudioRpc:async op=>{
      calls.push([op])
      if (op === 'recordStart') {
        if (pauseOnRecordStart) sourcePaused = true
        return 'webrec://started_' + (++next)
      }
      if (op === 'recordStop') return 'webrec://take_' + next
      return true
    },
    ensureMicPermissionViaBridge:async()=>'unknown',
    spotifyClips:()=>[],
    spotifyPlayer:{},
    clearTimeout:()=>{},
    setTimeout:()=>1,
    clearInterval:()=>{},
    setInterval:cb=>{tick=cb;return 1},
    Date: { now: () => now }, Math, Number, Promise, Audio:AudioMock, console,
  }
  vm.createContext(context)
  vm.runInContext(source.slice(begin,end) + '\n' + source.slice(watchBegin,watchEnd),context)
  return {
    context,state,calls,deleted,audios,audioPlays,
    tick:()=>tick(),advance:ms=>{now+=ms;tick()},setPosition:t=>{position=t},sourcePaused:()=>sourcePaused,flush,
  }
}

describe('continuous Practice Speak Over loop', () => {
  test('an ad parks loop seeks until content returns', async () => {
    const h = fixture()
    h.context.isYoutubeAdPlaying = () => true
    h.context._pracRecLoopToggle()
    await flush()
    h.context._pracRecWatch()
    h.setPosition(20)
    h.tick()
    expect(h.calls.filter(([op]) => op === 'seek')).toHaveLength(0)
    h.context.isYoutubeAdPlaying = () => false
    h.tick()
    expect(h.calls.filter(([op]) => op === 'seek')).toEqual([['seek', 10, true]])
  })
  test('Spotify keeps playing through loop recording and pauses for timestamped recording', () => {
    const h = fixture()
    const start = source.indexOf('function _practiceSpotifyOptions(it)')
    const end = source.indexOf('function _togglePracticePlayback()', start)
    expect(start).toBeGreaterThanOrEqual(0)
    expect(end).toBeGreaterThan(start)
    h.state.key = 'card'
    h.context._pracRecKey = () => 'card'
    vm.runInContext(source.slice(start, end), h.context)
    const options = h.context._practiceSpotifyOptions(h.state.item)

    h.state.loop = true
    h.state.phase = 'starting'
    h.state.loopSuspended = false
    expect(options.isPaused()).toBe(false)
    h.state.phase = 'recording'
    expect(options.isPaused()).toBe(false)
    h.state.loopSuspended = true
    expect(options.isPaused()).toBe(true)
    h.state.loop = false
    expect(options.isPaused()).toBe(true)
    h.state.phase = 'idle'
    h.context._practiceSessionTimeout.expired = true
    expect(options.isPaused()).toBe(true)
  })

  test('restores playback at the current position if the microphone pauses it', async () => {
    const h = fixture({ pauseOnRecordStart: true })
    h.context._pracRecLoopToggle()
    await flush()
    h.setPosition(12)
    const seeks = h.calls.filter(([op]) => op === 'seek').length
    expect(await h.context._pracRecLoopStart()).toBe(true)
    expect(h.sourcePaused()).toBe(false)
    expect(h.state.t1).toBe(12)
    expect(h.calls.filter(([op]) => op === 'seek')).toHaveLength(seeks)
  })

  test('recording does not pause the source; only latest take overlays on every loop', async () => {
    const h=fixture(), {context:ctx,state:st}=h
    ctx._pracRecLoopToggle(); await flush()
    expect(st.loop).toBe(true)
    expect(h.calls).toContainEqual(['seek',10,true])
    expect(h.calls).toContainEqual(['play'])
    ctx._pracRecWatch()
    h.setPosition(10.25); h.tick()
    h.setPosition(11); h.tick()
    expect(await ctx._pracRecLoopStart()).toBe(true)
    expect(st.phase).toBe('recording')
    expect(st.t1).toBe(11)
    h.setPosition(15.98); h.tick()
    expect(h.calls.filter(c=>c[0]==='seek').length).toBeGreaterThanOrEqual(2)
    expect(h.calls.some(c=>c[0]==='pause')).toBe(false)
    expect(await ctx._pracRecLoopStop()).toBe(true)
    expect(st.phase).toBe('idle')
    expect(st.loopTake.url).toBe('webrec://take_1')

    h.setPosition(12); h.tick()
    expect(await ctx._pracRecLoopStart()).toBe(true)
    expect(await ctx._pracRecLoopStop()).toBe(true)
    expect(st.loopTake.url).toBe('webrec://take_2')
    expect(h.deleted).toContain('webrec://take_1')
    expect(st.loopTake).toBeTruthy()

    h.setPosition(10.2); h.tick()   // completed seek back to clip start
    h.setPosition(10.3); h.tick()
    h.setPosition(11.9); h.tick()
    h.setPosition(12.1); h.tick()  // crossed latest recording mark at 12
    await flush()
    expect(h.audioPlays).toHaveLength(1)
    expect(h.calls.some(c=>c[0]==='pause')).toBe(false)
    h.setPosition(15.98); h.tick()
    expect(h.audios[0].paused).toBe(false) // long take continues while source rewinds
    h.audios[0].listeners.ended()
    h.setPosition(10.2); h.tick()
    h.setPosition(10.3); h.tick()
    h.setPosition(11.9); h.tick()
    h.setPosition(12.1); h.tick()
    await flush()
    expect(h.audioPlays).toHaveLength(1) // not restarted within the same pass
    h.setPosition(15.98); h.tick()
    h.setPosition(10.2); h.tick()
    h.setPosition(10.3); h.tick()
    h.setPosition(11.9); h.tick()
    h.setPosition(12.1); h.tick()
    await flush()
    expect(h.audioPlays).toHaveLength(2)
    expect(st.loopTake.url).toBe('webrec://take_2')
  })

  test('a fractional gap starts when the take ends and cannot restart a disabled loop', async () => {
    const h = fixture()
    const { context: ctx, state: st } = h
    ctx.window._appSettings.practiceLoopSilenceSeconds = 1.25
    ctx._pracRecLoopToggle()
    await flush()
    ctx._pracRecWatch()
    h.setPosition(10.2)
    h.tick()
    st.loopTake = { url: 'webrec://take_1', t1: 11 }
    h.setPosition(11.1)
    h.tick()
    await flush()
    expect(h.audioPlays).toHaveLength(1)

    h.setPosition(16)
    h.tick()
    expect(h.sourcePaused()).toBe(true)
    const seeks = () => h.calls.filter(([op]) => op === 'seek').length
    const initialSeeks = seeks()
    h.advance(3000)
    expect(seeks()).toBe(initialSeeks)
    expect(h.audios[0].paused).toBe(false)
    h.audios[0].listeners.ended()
    h.tick()
    h.advance(1249)
    expect(seeks()).toBe(initialSeeks)
    h.advance(1)
    expect(seeks()).toBe(initialSeeks + 1)
    expect(h.sourcePaused()).toBe(false)

    h.setPosition(10.2)
    h.tick()
    h.setPosition(16)
    h.tick()
    expect(h.sourcePaused()).toBe(true)
    ctx._pracRecLoopToggle()
    h.advance(2000)
    expect(seeks()).toBe(initialSeeks + 1)
  })

  test('microphone startup during the gap leaves the source paused until the next repeat', async () => {
    const h = fixture()
    const ctx = h.context
    ctx.window._appSettings.practiceLoopSilenceSeconds = 1
    ctx._pracRecLoopToggle()
    await flush()
    ctx._pracRecWatch()
    h.setPosition(10.2)
    h.tick()
    h.setPosition(16)
    h.tick()
    expect(await ctx._pracRecLoopStart()).toBe(true)
    expect(h.sourcePaused()).toBe(true)
    h.advance(1000)
    expect(h.sourcePaused()).toBe(false)
  })

  test('a late stop after minimizing cannot resurrect or leak a take', async () => {
    const h=fixture(), {context:ctx,state:st}=h
    ctx._pracRecLoopToggle(); await flush()
    expect(await ctx._pracRecLoopStart()).toBe(true)
    const pendingStop = ctx._pracRecLoopStop()
    st.loop=false
    ctx.window._practiceMinimized=true
    expect(await pendingStop).toBe(false)
    expect(st.loopTake).toBeNull()
    expect(h.deleted).toContain('webrec://take_1')
  })
})
