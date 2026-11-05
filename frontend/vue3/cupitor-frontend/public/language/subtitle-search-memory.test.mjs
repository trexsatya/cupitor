import test from 'node:test'
import assert from 'node:assert/strict'
import {createSubtitleSearchRuntime} from './subtitle-search-runtime.js'
import {createSubtitleSearchClient} from './subtitle-search-client.js'
const raw=text=>'1\n00:00:01,000 --> 00:00:03,000\n'+text+'\n'
const unavailable={open(){throw new Error('Search must not open IndexedDB')}}

test('memory search uses no search database and retains query, edit and context behavior',async()=>{
  const runtime=await createSubtitleSearchRuntime('ram',{storage:'memory',indexedDB:unavailable})
  try{
    const docs=Array.from({length:500},(_,i)=>({id:String(i),sv:raw(i%50?'ordinary':'vaken'),en:raw('awake'),revision:1}))
    await runtime.update(docs)
    const ids=docs.map(doc=>doc.id).reverse()
    assert.deepEqual((await runtime.files({ids,query:'vaken',compact:true})).map(hit=>hit.url),ids.filter(id=>Number(id)%50===0))
    await runtime.update([{id:'0',sv:raw('försova'),_evicted:true,revision:2}])
    assert.match((await runtime.document({id:'0'})).en,/awake/)
    assert.match((await runtime.context({id:'0',from:1,to:1})).sv_subs.data[0].text,/försova/)
    assert.equal((await runtime.indexStatus({ids})).storage,'memory')
    assert.equal((await runtime.indexStatus({ids})).lastQuery.strategy,'memory')
  }finally{runtime.close()}
})

test('memory client restores edits and metadata after cancelling a worker without resurrecting deletions',async()=>{
  const workers=[]
  const client=createSubtitleSearchClient({scope:'ram-restart',storage:'memory',workerFactory:()=>{
    let runtime,closed=false
    const worker={terminate(){closed=true;runtime?.close()},async postMessage(message){
      const {id,generation,type,payload}=message
      try{
        let result=true
        if(type==='init')runtime=await createSubtitleSearchRuntime(payload.scope,{...payload.options,indexedDB:unavailable})
        else if(type==='update')await runtime.update(payload.documents)
        else if(type==='cancel'||type==='ping')return
        else if(type==='files'&&payload.query==='fixture-hold')return
        else result=await runtime[type](payload)
        if(!closed)this.onmessage({data:{id,generation,result}})
      }catch(error){if(!closed)this.onmessage({data:{id,generation,error:{message:error.message,code:error.code}}})}
    }}
    workers.push(worker);return worker
  }})
  try{
    client.update('deleted',{sv:raw('needle'),en:null})
    client.update('kept',{sv:raw('needle'),en:raw('translation')});await client.flush()
    client.update('deleted',null)
    client.update('kept',{source:'metadata edit',_evicted:true});await client.flush()
    const waiting=client.run('files',{ids:['kept'],query:'fixture-hold'}).catch(error=>error.code)
    for(let i=0;i<20;i++)await Promise.resolve()
    client.cancel();assert.equal(await waiting,'subtitle-search-cancelled')
    const hits=await client.run('files',{ids:['kept'],query:'needle',compact:true})
    assert.deepEqual(hits.map(hit=>hit.url),['kept']);assert.equal(workers.length,2)
    const kept=await client.run('document',{id:'kept'})
    assert.match(kept.sv,/needle/);assert.match(kept.en,/translation/);assert.equal(kept.source,'metadata edit')
    await assert.rejects(client.run('document',{id:'deleted'}),/not downloaded/)
  }finally{client.close()}
})
