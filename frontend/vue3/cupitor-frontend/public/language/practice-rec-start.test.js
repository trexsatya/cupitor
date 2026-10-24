const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const path = require('node:path')
const source = fs.readFileSync(path.join(__dirname, 'language.js'), 'utf8')
const endCode = source.slice(source.indexOf('function _pracRecEnd(discard)'), source.indexOf('// Stop the clip\'s own end-watcher'))
const startCode = source.slice(source.indexOf('function _pracRecToggle()'), source.indexOf('\nasync function _pracRecStop()'))
const minimizeCode = source.match(/function minimizePracticeMode\(\) \{[\s\S]*?\n\}/)[0]
const flush = () => new Promise(resolve => require('node:timers').setImmediate(resolve))
function deferred() {
  let resolve, reject
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail })
  return { promise, resolve, reject }
}
function fixture(options = {}) {
  const requests = [], notes = [], deleted = [], alerts = []
  const state = { phase:'idle', clipStart:1, takes:[], kept:new Set(), token:0, timer:null, audio:null, url:null }
  let time = 1000, permissionChecks = 0
  const recordings = (options.recordings || []).slice()
  const context = {
    _pracRec:state, Promise, Date:{now:()=>time}, Math, clearInterval(){},
    window:{_practiceActive:true}, $:()=>({addClass(){},removeClass(){},click(){}}),
    hideMediaRelatedContainer(){}, spotifyClips:()=>[], _newPracticeVideoRequest(){},
    _practiceVideoCues:{releaseMute(){}}, _updatePracticeRestoreCount(){},
    console:{warn(){}}, alert:message=>alerts.push(message),
    _practiceSpeakOverShown:()=>true, _pracRecNow:()=>10,
    _pracRecTakeOverPlayhead(){}, _pracRecPauseVideo(){},
    _renderPracticeRecBar:note=>notes.push({phase:context._pracRec?.phase,note}),
    ensureMicPermissionViaBridge:()=>{ permissionChecks++; return options.permission || Promise.resolve('granted') },
    _audioRpc:(op, payload)=>{
      requests.push({op,payload})
      return op === 'recordStart' ? (recordings.shift()?.promise || Promise.resolve('file:///take.ogg')) : Promise.resolve('ok')
    },
    deleteManualAudio:url=>deleted.push(url),
  }
  vm.createContext(context); vm.runInContext(endCode + '\n' + startCode + '\n' + minimizeCode, context)
  return {context,state,requests,notes,deleted,alerts,setTime:value=>{time=value},checks:()=>permissionChecks}
}

test('microphone startup is claimed before permissions and a second tap cancels it', async () => {
  const permission = deferred(), f = fixture({permission:permission.promise})
  const pending = f.context._pracRecStart()
  assert.equal(f.state.phase,'starting')
  assert.equal(f.requests.length,0)
  f.context._pracRecToggle()
  assert.equal(f.state.phase,'idle')
  assert.equal(f.requests[0].op,'recordCancel')
  permission.resolve('granted'); await pending
  assert.equal(f.requests.filter(r=>r.op==='recordStart').length,0)
})

test('duplicate start requests cannot create two recordings and time begins on actual success', async () => {
  const recording = deferred(), f = fixture({recordings:[recording]})
  const pending = f.context._pracRecStart()
  await f.context._pracRecStart(); await flush()
  assert.equal(f.checks(),1)
  assert.equal(f.requests.filter(r=>r.op==='recordStart').length,1)
  assert.equal(f.state.phase,'starting')
  f.setTime(6000); recording.resolve('file:///new.ogg'); await pending
  assert.equal(f.state.phase,'recording')
  assert.equal(f.state.startedMs,6000)
  assert.equal(f.state.url,'file:///new.ogg')
})

test('leaving during a pending bridge start cancels it and never stops another card later', async () => {
  const recording = deferred(), f = fixture({recordings:[recording]})
  const pending = f.context._pracRecStart(); await flush()
  f.context._pracRecEnd(true)
  const next = {phase:'recording',url:'file:///other.ogg'}
  f.context._pracRec = next
  recording.resolve('file:///late.ogg'); await pending
  assert.equal(f.requests.filter(r=>r.op==='recordCancel').length,1)
  assert.equal(f.requests.filter(r=>r.op==='recordStop').length,0)
  assert.equal(f.context._pracRec,next)
  assert.equal(next.url,'file:///other.ogg')
  assert.deepEqual(f.deleted,['file:///late.ogg'])
})

test('leaving before permission returns never asks the native recorder to start', async () => {
  const permission=deferred(), f=fixture({permission:permission.promise})
  const pending=f.context._pracRecStart()
  f.context._pracRecEnd(true)
  permission.resolve('granted'); await pending
  assert.equal(f.requests.filter(r=>r.op==='recordStart').length,0)
})

test('a stale failure cannot reset a newer recording start', async () => {
  const first=deferred(), second=deferred(), f=fixture({recordings:[first,second]})
  const old=f.context._pracRecStart(); await flush()
  f.context._pracRecToggle()
  const current=f.context._pracRecStart(); await flush()
  first.reject(new Error('BUSY')); await old
  assert.equal(f.state.phase,'starting')
  second.resolve('file:///current.ogg'); await current
  assert.equal(f.state.phase,'recording')
  assert.equal(f.state.url,'file:///current.ogg')
  assert(!f.notes.some(n=>/busy/i.test(n.note||'')))
})

test('permission and recorder failures restore a usable idle state with a specific message', async () => {
  const permission=fixture({permission:Promise.resolve('denied')})
  await permission.context._pracRecStart()
  assert.equal(permission.state.phase,'idle')
  assert.equal(permission.requests.length,0)
  assert.match(permission.alerts[0],/permission/)
  const recording=deferred(), f=fixture({recordings:[recording]})
  const pending=f.context._pracRecStart(); await flush()
  recording.reject(new Error('BUSY: another recording is active')); await pending
  assert.equal(f.state.phase,'idle')
  assert.match(f.notes.at(-1).note,/Microphone is busy/)
  await f.context._pracRecStart()
  assert.equal(f.state.phase,'recording')
})


test('minimizing Practice cancels microphone startup before a late bridge response', async () => {
  const recording=deferred(), f=fixture({recordings:[recording]})
  const pending=f.context._pracRecStart(); await flush()
  f.context.minimizePracticeMode()
  assert.equal(f.state.phase,'idle')
  assert.equal(f.requests.filter(r=>r.op==='recordCancel').length,1)
  recording.resolve('file:///abandoned.ogg'); await pending
  assert.equal(f.state.phase,'idle')
  assert.deepEqual(f.deleted,['file:///abandoned.ogg'])
  assert.equal(f.requests.filter(r=>r.op==='recordStop').length,0)
})
