import test from 'node:test'
import assert from 'node:assert/strict'
import { observeSubtitleCorpus, createSubtitleSearchClient } from './subtitle-search-client.js'

test('slow startup and context reads continue while the worker can answer liveness probes',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date']})
  let init,context,probes=0,terminated=0
  const modes=[]
  const worker={terminate(){terminated++},postMessage(message){
    if(message.type==='init')init=message
    else if(message.type==='context')context=message
    else if(message.type==='ping'){probes++;queueMicrotask(()=>this.onmessage({data:{...message,pong:true}}))}
  }}
  const client=createSubtitleSearchClient({scope:'busy-storage',timeoutMs:40,workerFactory:()=>worker,onMode:mode=>modes.push(mode)})
  const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}
  try{
    const ready=client.flush();ready.catch(()=>{})
    while(!init)await new Promise(resolve=>setImmediate(resolve))
    t.mock.timers.tick(2001);await settle()
    assert.equal(terminated,0,'a busy startup is probed before declaring worker support unavailable')
    worker.onmessage({data:{...init,result:true}});await ready
    let finished=false
    const reading=client.run('context',{id:'clip',from:1,to:3}).then(result=>{finished=true;return result})
    reading.catch(()=>{});await settle()
    for(let i=0;i<5;i++){t.mock.timers.tick(41);await settle();assert.equal(finished,false)}
    assert.equal(terminated,0,'slow storage is not an unresponsive worker')
    assert.ok(probes>=6)
    worker.onmessage({data:{...context,result:{lines:['vaken']}}})
    assert.deepEqual(await reading,{lines:['vaken']});assert.deepEqual(modes,['worker'])
  }finally{client.close()}
})

test('a delayed main-thread timer lets queued worker replies arrive before killing a query',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date']})
  let query,probe,terminated=0
  const worker={terminate(){terminated++},postMessage(message){
    if(message.type==='init')queueMicrotask(()=>this.onmessage({data:{...message,result:true}}))
    else if(message.type==='files')query=message
    else if(message.type==='ping')probe=message
  }}
  const client=createSubtitleSearchClient({scope:'busy-main-thread',timeoutMs:40,workerFactory:()=>worker})
  const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}
  try{
    await client.flush()
    const running=client.run('files',{ids:['clip'],query:'vaken'});running.catch(()=>{});await settle()
    t.mock.timers.tick(41);await settle();assert.ok(probe)
    // The main thread was unavailable for much longer than the probe budget.
    t.mock.timers.tick(2000);await settle()
    assert.equal(terminated,0,'a late timer is evidence of host load, not worker failure')
    worker.onmessage({data:{...query,result:['clip']}})
    assert.deepEqual(await running,['clip'])
  }finally{client.close()}
})

test('Cancel interrupts context reads and stale pongs cannot renew another probe',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date']})
  const probes=[]
  let context,query,terminated=0
  const worker={terminate(){terminated++},postMessage(message){
    if(message.type==='init')queueMicrotask(()=>this.onmessage({data:{...message,result:true}}))
    else if(message.type==='context')context=message
    else if(message.type==='files')query=message
    else if(message.type==='ping')probes.push(message)
  }}
  const client=createSubtitleSearchClient({scope:'probe-cancel',timeoutMs:40,workerFactory:()=>worker})
  const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}
  try{
    await client.flush()
    const reading=client.run('context',{id:'clip'}).catch(error=>error.code);await settle();assert.ok(context)
    client.cancel();assert.equal(await reading,'subtitle-search-cancelled');assert.equal(terminated,1)
    const waiting=client.run('files',{ids:['clip'],query:'vaken'}).catch(error=>error.code);await settle()
    t.mock.timers.tick(41);await settle()
    worker.onmessage({data:{...query,heartbeat:true}})
    t.mock.timers.tick(41);await settle()
    assert.equal(probes.length,2)
    worker.onmessage({data:{...probes[0],pong:true}})
    t.mock.timers.tick(40);await settle()
    assert.equal(await waiting,'subtitle-search-timeout','an obsolete pong cannot extend the current deadline')
  }finally{client.close()}
})

test('bounded legacy-cache cleanup keeps a healthy worker startup supervised',async t=>{
  t.mock.timers.enable({apis:['setTimeout','Date']})
  let init,finished=false
  const worker={terminate(){},postMessage(message){if(message.type==='init')init=message}}
  const client=createSubtitleSearchClient({scope:'startup-cleanup',workerFactory:()=>worker})
  const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}
  try{
    const ready=client.flush().then(()=>{finished=true})
    ready.catch(()=>{})
    while(!init)await new Promise(resolve=>setImmediate(resolve))
    for(let i=0;i<4;i++){
      t.mock.timers.tick(1500)
      worker.onmessage({data:{...init,heartbeat:true}})
      await settle();assert.equal(finished,false)
    }
    worker.onmessage({data:{...init,result:true}})
    await ready;assert.equal(finished,true)
  }finally{client.close()}
})

test('a productive search can outlast the watchdog, but a stalled search is terminated', async t => {
  t.mock.timers.enable({apis:['setTimeout','Date']})
  let query, terminated = 0
  const worker = {terminate(){terminated++},postMessage(message){
    if(message.type==='init'||message.type==='update')queueMicrotask(()=>this.onmessage({data:{...message,result:true}}))
    else if(message.type==='files')query=message
  }}
  const client=createSubtitleSearchClient({scope:'productive-search',timeoutMs:40,workerFactory:()=>worker})
  const settle=async()=>{for(let i=0;i<12;i++)await Promise.resolve()}
  try {
    await client.flush()
    let finished=false
    const running=client.run('files',{ids:['one'],query:'vaken'}).then(result=>{finished=true;return result},error=>{finished=true;return error})
    await settle()
    for(let i=1;i<=5;i++){
      t.mock.timers.tick(25)
      worker.onmessage({data:{id:query.id,generation:query.generation,...(i%2?{heartbeat:true}:{progress:{visited:i,total:6}})}})
      await settle()
      assert.equal(finished,false,'progress keeps a healthy long corpus scan alive')
    }
    worker.onmessage({data:{id:query.id,generation:query.generation,result:['found']}})
    assert.deepEqual(await running,['found'])
    const stalled=client.run('files',{ids:['one'],query:'(a+)+$'}).catch(error=>error.code)
    await settle();t.mock.timers.tick(41)
    await settle();t.mock.timers.tick(40)
    assert.equal(await stalled,'subtitle-search-timeout')
    assert.equal(terminated,1)
  } finally {client.close()}
})

test('raw transcripts are evicted only after acknowledgement; metadata and edits remain observable',async()=>{
  const target={},writes=[]
  const view=observeSubtitleCorpus(target,(id,doc)=>writes.push({id,...doc}),()=>{},{maxBytes:30})
  target.allSubtitles.one={sv:'a'.repeat(10),en:null,source:'YouTube',_remoteComplete:true}
  target.allSubtitles.two={sv:'b'.repeat(10),en:null,source:'YouTube',_remoteComplete:true}
  assert.equal(view.stats.evicted,0,'uncommitted documents cannot be discarded')
  view.committed(writes.slice())
  assert.equal(view.stats.evicted,1)
  assert.ok(view.stats.residentBytes<=view.stats.budgetBytes)
  assert.equal(target.allSubtitles.one._hasSv,true)
  assert.equal(target.allSubtitles.one._remoteComplete,true)
  assert.equal(writes.length,2,'eviction must not publish an empty raw document')
  const restored=view.hydrate('one',{sv:'a'.repeat(10),en:null,source:'YouTube'})
  assert.equal(restored.sv,'a'.repeat(10));assert.equal(writes.length,2)
  await new Promise(resolve=>setTimeout(resolve,0))
  assert.ok(view.stats.residentBytes<=view.stats.budgetBytes)
  restored.source='Updated channel'
  assert.equal(writes.at(-1).source,'Updated channel')
  assert.equal(writes.at(-1)._evicted,false)
})
test('an edit made while persistence is in flight stays pinned until its own acknowledgement',()=>{
  const target={},writes=[]
  const view=observeSubtitleCorpus(target,(id,doc)=>writes.push({id,...doc}),()=>{},{maxBytes:1})
  target.allSubtitles.one={sv:'Original',en:null}
  const sent=writes[0]
  target.allSubtitles.one.sv='New edit'
  view.committed([sent])
  assert.equal(target.allSubtitles.one.sv,'New edit')
  assert.equal(view.stats.evicted,0)
  view.committed([writes.at(-1)])
  assert.equal(view.stats.evicted,1)
  assert.equal(writes.length,2)
})

test('a terminated worker cannot reject a newer query with a late error or response',async()=>{
  const workers=[]
  const client=createSubtitleSearchClient({scope:'worker-generation',workerFactory:()=>{
    const worker={messages:[],terminate(){},postMessage(message){
      this.messages.push(message)
      if(message.type==='init'||message.type==='update')queueMicrotask(()=>this.onmessage({data:{id:message.id,generation:message.generation,result:true}}))
    }}
    workers.push(worker);return worker
  }})
  const waitFor=async predicate=>{while(!predicate())await new Promise(resolve=>setImmediate(resolve))}
  try{
    const first=client.run('files',{ids:[],query:'first'}).catch(error=>error.code)
    await waitFor(()=>workers[0]?.messages.some(message=>message.type==='files'))
    client.cancel();assert.equal(await first,'subtitle-search-cancelled')
    const second=client.run('files',{ids:[],query:'second'})
    await waitFor(()=>workers[1]?.messages.some(message=>message.type==='files'))
    workers[0].onerror(new Error('Late error after termination'))
    for(const worker of workers){const message=worker.messages.find(message=>message.type==='files');worker.onmessage({data:{id:message.id,generation:message.generation,result:[]}})}
    assert.deepEqual(await second,[])
  }finally{client.close()}
})

test('a failed restart after worker mode reports an incomplete search and can retry without using cooperative regex',async()=>{
  let failNext=false
  const modes=[]
  const client=createSubtitleSearchClient({scope:'failed-restart',onMode:mode=>modes.push(mode),workerFactory:()=>{
    if(failNext){failNext=false;throw new Error('Transient worker failure')}
    return {terminate(){},postMessage(message){queueMicrotask(()=>this.onmessage({data:{id:message.id,generation:message.generation,result:message.type==='files'?[]:true}}))}}
  }})
  try{
    await client.run('files',{ids:[],query:'first'})
    client.close();failNext=true
    client.update('pending',{sv:'pending edit'})
    await assert.rejects(client.run('files',{ids:['pending'],query:'next'}),/could not restart/)
    assert.equal(client.pendingSize,1)
    assert.deepEqual(await client.run('files',{ids:['pending'],query:'retry'}),[])
    assert.equal(client.pendingSize,0)
    assert.deepEqual(modes,['worker','worker'])
  }finally{client.close()}
})
