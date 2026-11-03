import test from 'node:test'
import assert from 'node:assert/strict'
import { observeSubtitleCorpus, createSubtitleSearchClient } from './subtitle-search-client.js'

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
