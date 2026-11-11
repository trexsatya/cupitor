const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, 'language.js'), 'utf8')
const begin = source.indexOf('function _pracRecLoopClearAudio(st)')
const end = source.indexOf('// Watch the playhead for the whole time', begin)
const watchBegin = source.indexOf('function _pracRecWatch()', end)
const watchEnd = source.indexOf('// Rewind to the take before', watchBegin)
if (begin < 0 || end < begin || watchBegin < 0 || watchEnd < watchBegin) throw new Error('Loop controls missing')

const flush = async () => { await Promise.resolve(); await Promise.resolve(); await Promise.resolve() }
function fixture() {
  const state = {
    item: {}, phase:'idle', clipStart:10, clipStop:16,
    loop:false, loopTake:null, loopToken:0, loopPlayed:false,
    loopSeeking:false, loopSeekTimer:null, takes:[],
    timer:null, token:0, watchPos:null, awaiting:null,
  }
  const calls = [], deleted = [], audioPlays = [], audios = []
  let tick = () => {}, position = 11, next = 0
  class AudioMock {
    constructor(url) { this.url = url; this.listeners = {}; this.paused = false; audios.push(this) }
    addEventListener(key, listener) { this.listeners[key] = listener }
    pause() { this.paused = true }
    play() { audioPlays.push(this.url); return Promise.resolve() }
  }
  const context = {
    _pracRec:state,
    window: { _practiceActive:true, _practiceMinimized:false,
      ytPlayer: {seekTo:(t, play)=>{calls.push(['seek',t,play]); position=t}} },
    _pracRecTakeOverPlayhead:()=>calls.push(['takeover']),
    _pracRecPlayVideo:()=>calls.push(['play']),
    _pracRecPauseVideo:()=>calls.push(['pause']),
    _pracRecNow:()=>position,
    _pracRecRefreshClip:async()=>{},
    _practiceSpeakOverShown:()=>true,
    _takeDueForPass:()=>null,
    _pracRecClipEnd:t=>t,
    _TAKE_MAX_STEP:5,
    _TAKE_SAME_SPOT:0.12,
    _renderPracticeRecBar:note=>calls.push(['render',note]),
    _pracRecStartError:e=>String(e),
    _loadSpeakOverAudio:async url=>'data:audio/webm;base64,' + url.slice(-1),
    _deleteSpeakOverAudio:url=>deleted.push(url),
    _speakOverAudioRpc:async op=>{
      calls.push([op])
      if (op === 'recordStart') return 'webrec://started_' + (++next)
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
    Date, Math, Number, Promise, Audio:AudioMock, console,
  }
  vm.createContext(context)
  vm.runInContext(source.slice(begin,end) + '\n' + source.slice(watchBegin,watchEnd),context)
  return {
    context,state,calls,deleted,audios,audioPlays,
    tick:()=>tick(),setPosition:t=>{position=t},flush,
  }
}

describe('continuous Practice Speak Over loop', () => {
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
    h.setPosition(12.2); h.tick()  // crossed latest recording mark at 12
    await flush()
    expect(h.audioPlays).toHaveLength(1)
    expect(h.calls.some(c=>c[0]==='pause')).toBe(false)
    h.setPosition(15.98); h.tick()
    expect(h.audios[0].paused).toBe(true)
    h.setPosition(10.2); h.tick()
    h.setPosition(10.3); h.tick()
    h.setPosition(12.2); h.tick()
    await flush()
    expect(h.audioPlays).toHaveLength(2)
    expect(st.loopTake.url).toBe('webrec://take_2')
  })

  test('a late stop after minimizing cannot resurrect or leak a take', async () => {
    const h=fixture(), {context:ctx,state:st}=h
    ctx._pracRecLoopToggle(); await flush()
    expect(await ctx._pracRecLoopStart()).toBe(true)
    st.loop=false
    ctx.window._practiceMinimized=true
    expect(await ctx._pracRecLoopStop()).toBe(false)
    expect(st.loopTake).toBeNull()
    expect(h.deleted).toContain('webrec://take_1')
  })
})
