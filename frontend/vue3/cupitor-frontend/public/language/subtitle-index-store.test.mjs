import test from 'node:test'
import assert from 'node:assert/strict'
import { IDBFactory, IDBDatabase, IDBObjectStore, IDBKeyRange } from 'fake-indexeddb'
import { openSubtitleCorpus } from './subtitle-corpus-store.js'
import { createSubtitleSearchRuntime } from './subtitle-search-runtime.js'
import { POSTING_SHARD_SIZE } from './subtitle-search-index.js'

const srt=text=>`1\n00:00:01,000 --> 00:00:03,000\n${text}\n`
const doc=(id,text)=>({id,sv:srt(text),en:srt('translated '+text),revision:1})
const openDb=indexedDB=>new Promise((resolve,reject)=>{const req=indexedDB.open('cupitor-search-corpus-v1');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})

test('cold library metadata uses bounded range reads and checks cancellation between them',async()=>{
  const indexedDB=new IDBFactory(),writer=await openSubtitleCorpus('bulk-metadata',indexedDB,{keyRange:IDBKeyRange})
  const documents=Array.from({length:1537},(_,i)=>doc('clip'+String(i).padStart(5,'0'),'ordinary caption'))
  for(let i=0;i<documents.length;i+=128)await writer.put(documents.slice(i,i+128))
  const reader=await openSubtitleCorpus('bulk-metadata',indexedDB,{keyRange:IDBKeyRange})
  const get=IDBObjectStore.prototype.get,getAll=IDBObjectStore.prototype.getAll
  let infoGets=0,ranges=0,checks=0
  try{
    IDBObjectStore.prototype.get=function(...args){if(this.name==='info')infoGets++;return get.apply(this,args)}
    IDBObjectStore.prototype.getAll=function(range,count){if(this.name==='info'){ranges++;assert.equal(count,512)}return getAll.call(this,range,count)}
    await assert.rejects(reader.candidates(documents.map(doc=>doc.id),'needle',{},()=>{if(++checks===3)throw new Error('cancel preparation')}),/cancel preparation/)
    assert.equal(ranges,1,'cancellation stops preparation before the remaining library is read')
    const result=await reader.candidates(documents.map(doc=>doc.id),'needle')
    assert.equal(infoGets,0,'large libraries do not issue a separate metadata get for every clip')
    assert.deepEqual(result.ids,documents.map(doc=>doc.id),'unindexed rows retain complete scan coverage')
  }finally{IDBObjectStore.prototype.get=get;IDBObjectStore.prototype.getAll=getAll;reader.close();writer.close()}
})

test('interrupted bounded posting writes remain scan-safe and recover after a worker restart',async()=>{
  const indexedDB=new IDBFactory()
  let store=await openSubtitleCorpus('partial-postings',indexedDB)
  const original=IDBObjectStore.prototype.get
  const transaction=IDBDatabase.prototype.transaction
  let writes=0,postingGets=0,maxGets=0
  try{
    await store.put([doc('clip','oldneedle')]);await store.indexDocument('clip')
    const text=Array.from({length:600},(_,i)=>'word'+i.toString(36)).join(' ')+' newneedle'
    await store.put([{...doc('clip',text),revision:2}])
    IDBDatabase.prototype.transaction=function(names,mode,...rest){
      if(mode==='readwrite'&&Array.from(names).includes('postings')){writes++;maxGets=Math.max(maxGets,postingGets);postingGets=0}
      return transaction.call(this,names,mode,...rest)
    }
    IDBObjectStore.prototype.get=function(...args){if(this.name==='postings')postingGets++;return original.apply(this,args)}
    await assert.rejects(store.indexDocument('clip',{check(){if(writes>=2)throw new Error('interrupt index')}}),/interrupt index/)
    assert.ok(Math.max(maxGets,postingGets)<=128,'no posting transaction monopolizes storage with thousands of requests')
    assert.equal((await store.indexStatus(['clip'])).pending,1)
    assert.deepEqual((await store.candidates(['clip'],'newneedle')).ids,['clip'])
    IDBDatabase.prototype.transaction=transaction;IDBObjectStore.prototype.get=original
    store.close();store=await openSubtitleCorpus('partial-postings',indexedDB)
    await store.indexDocument('clip')
    assert.equal((await store.indexStatus(['clip'])).ready,1)
    assert.deepEqual((await store.candidates(['clip'],'oldneedle')).ids,[])
    assert.deepEqual((await store.candidates(['clip'],'newneedle')).ids,['clip'])
  }finally{IDBDatabase.prototype.transaction=transaction;IDBObjectStore.prototype.get=original;store.close()}
})
test('postings actually prune reads, remain bounded and respect the requested scope and order',async()=>{
  const indexedDB=new IDBFactory(),store=await openSubtitleCorpus('alice/swedish',indexedDB),other=await openSubtitleCorpus('bob/spanish',indexedDB)
  try{
    const documents=Array.from({length:129},(_,i)=>doc('id'+i,i===128?'exceptionalneedle':'ordinary material '+i)),ids=documents.map(doc=>doc.id)
    for(let offset=0;offset<documents.length;offset+=32)await store.put(documents.slice(offset,offset+32))
    assert.deepEqual((await store.candidates(ids,'exceptionalneedle')).ids,ids,'unindexed documents are always scanned')
    for(const id of ids)await store.indexDocument(id)
    assert.deepEqual((await store.candidates(ids,'exceptionalneedle')).ids,['id128'])
    const get=IDBObjectStore.prototype.get;let infoReads=0
    try{
      IDBObjectStore.prototype.get=function(...args){if(this.name==='info')infoReads++;return get.apply(this,args)}
      await store.candidates(ids,'exceptionalneedle');await store.candidates(ids,'ordinary')
      assert.equal(infoReads,0,'warm index queries reuse revision-checked coverage metadata')
    }finally{IDBObjectStore.prototype.get=get}
    assert.deepEqual((await store.candidates(['id128','id2','id1'],'ordinary')).ids,['id2','id1'],'requested result order is preserved')
    assert.deepEqual((await store.candidates(ids,'missing')).ids,[])
    assert.deepEqual((await store.candidates(['missing document'],'ordinary')).ids,['missing document'],'missing storage cannot become an empty successful search')
    await other.put([doc('id128','anotherword')]);await other.indexDocument('id128')
    assert.deepEqual((await other.candidates(['id128'],'exceptionalneedle')).ids,[])
    const db=await openDb(indexedDB),tx=db.transaction('postings'),records=await new Promise((resolve,reject)=>{const req=tx.objectStore('postings').index('scope').getAll('alice/swedish');req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})
    assert.ok(records.length);assert.ok(records.every(record=>record.ordinals.length<=POSTING_SHARD_SIZE))
    db.close()
    assert.ok((await store.list()).find(meta=>meta.scope==='alice/swedish').indexBytes>0)
    await store.removeScope('bob/spanish')
    assert.deepEqual((await store.candidates(ids,'exceptionalneedle')).ids,['id128'])
  }finally{store.close();other.close()}
})

test('word postings narrow exact English attribution while substring matching and external edits retain coverage',async()=>{
  const indexedDB=new IDBFactory(),store=await openSubtitleCorpus('word-index',indexedDB),writer=await openSubtitleCorpus('word-index',indexedDB)
  try{
    await store.put([{...doc('word','other'),en:srt('thin')},{...doc('compound','other'),en:srt('thinking')},{...doc('both','thin'),en:srt('thin, thinner')}])
    const ids=['word','compound','both']
    for(const id of ids)await store.indexDocument(id)
    assert.deepEqual((await store.candidates(ids,'thin',{language:'en'})).ids,ids)
    assert.deepEqual((await store.candidates(ids,'thin',{language:'en',exactWordsOnly:true})).ids,['word','both'])
    await writer.put([{...doc('compound','freshneedle'),revision:2}])
    assert.deepEqual((await store.candidates(ids,'freshneedle')).ids,['compound'],'a corpus revision change invalidates cached index coverage from another connection')
  }finally{store.close();writer.close()}
})

test('raw edits invalidate atomically; failed index transactions retain complete scan coverage and can retry',async()=>{
  const indexedDB=new IDBFactory(),store=await openSubtitleCorpus('updates',indexedDB)
  const original=IDBDatabase.prototype.transaction
  try{
    await store.put([doc('same','oldneedle'),doc('other','unrelated')])
    await store.indexDocument('same');await store.indexDocument('other')
    await store.put([{...doc('same','oldneedle'),revision:99,source:'Updated metadata'}])
    assert.equal((await store.indexStatus(['same'])).ready,1,'unchanged text reuses its verified index across reloads')
    assert.equal(await store.indexDocument('same'),false)
    assert.deepEqual((await store.candidates(['same','other'],'oldneedle')).ids,['same'])
    await store.put([{...doc('same','newneedle'),revision:2}])
    assert.deepEqual((await store.candidates(['same','other'],'newneedle')).ids,['same'])
    let aborted=false
    IDBDatabase.prototype.transaction=function(names,mode,...rest){
      const tx=original.call(this,names,mode,...rest)
      if(!aborted&&mode==='readwrite'&&Array.from(names).includes('features')){aborted=true;queueMicrotask(()=>tx.abort())}
      return tx
    }
    await assert.rejects(store.indexDocument('same'))
    assert.deepEqual((await store.candidates(['same','other'],'newneedle')).ids,['same'])
    IDBDatabase.prototype.transaction=original
    await store.indexDocument('same')
    assert.deepEqual((await store.candidates(['same','other'],'oldneedle')).ids,[])
    assert.deepEqual((await store.candidates(['same','other'],'newneedle')).ids,['same'])
    await store.put([{id:'same',remove:true}]);await store.indexDocument('same')
    assert.deepEqual((await store.candidates(['other'],'newneedle')).ids,[])
    await store.put([doc('same','rebornneedle')]);await store.indexDocument('same')
    assert.deepEqual((await store.candidates(['same','other'],'rebornneedle')).ids,['same'])
  }finally{IDBDatabase.prototype.transaction=original;store.close()}
})

test('an edit during feature preparation cannot publish stale postings or a ready marker',async()=>{
  const indexedDB=new IDBFactory(),store=await openSubtitleCorpus('racing',indexedDB)
  try{
    await store.put([doc('same','oldmaterial '.repeat(5000))])
    let release,started
    const gate=new Promise(resolve=>{release=resolve}),ready=new Promise(resolve=>{started=resolve})
    let held=false
    const pending=store.indexDocument('same',{yieldToUI:async()=>{if(!held){held=true;started();await gate}}})
    await ready;await store.put([{...doc('same','freshneedle'),revision:2}]);release()
    assert.equal(await pending,false)
    assert.equal((await store.indexStatus(['same'])).pending,1)
    assert.deepEqual((await store.candidates(['same'],'freshneedle')).ids,['same'])
    await store.indexDocument('same');assert.equal((await store.indexStatus(['same'])).ready,1)
  }finally{store.close()}
})

test('schema upgrade retains version-2 downloads and indexes them lazily',async()=>{
  const indexedDB=new IDBFactory()
  const db=await new Promise((resolve,reject)=>{
    const req=indexedDB.open('cupitor-search-corpus-v1',2)
    req.onupgradeneeded=()=>{
      req.result.createObjectStore('documents',{keyPath:['scope','id']}).createIndex('scope','scope')
      req.result.createObjectStore('info',{keyPath:['scope','id']}).createIndex('scope','scope')
      req.result.createObjectStore('scopes',{keyPath:'scope'})
    }
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)
  })
  await new Promise((resolve,reject)=>{
    const tx=db.transaction(['documents','info','scopes'],'readwrite')
    tx.objectStore('documents').put({...doc('legacy','legacyneedle'),scope:'legacy'})
    tx.objectStore('info').put({scope:'legacy',id:'legacy',revision:1,bytes:100})
    tx.objectStore('scopes').put({scope:'legacy',baseScope:'legacy',count:1,bytes:100})
    tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error)
  });db.close()
  const store=await openSubtitleCorpus('legacy',indexedDB)
  try{
    assert.deepEqual((await store.candidates(['legacy'],'absent')).ids,['legacy'])
    await store.indexDocument('legacy')
    assert.deepEqual((await store.candidates(['legacy'],'absent')).ids,[])
    assert.equal((await store.get(['legacy']))[0].sv,srt('legacyneedle'))
  }finally{store.close()}
})

test('worker runtime resumes interrupted indexing and verifies candidates with the full matcher',async()=>{
  const indexedDB=new IDBFactory(),ids=['first','second','third']
  let runtime=await createSubtitleSearchRuntime('restart',{indexedDB,indexing:false})
  await runtime.update([doc(ids[0],'needle'),doc(ids[1],'unrelated'),doc(ids[2],'another subject')]);runtime.close()
  runtime=await createSubtitleSearchRuntime('restart',{indexedDB})
  try{
    assert.equal((await runtime.indexStatus({ids,wait:true})).ready,3)
    const indexed=await runtime.files({ids,query:'needle'})
    assert.deepEqual(indexed.map(file=>file.url),['first'])
    assert.equal((await runtime.indexStatus({ids})).lastQuery.inspected,1)
    assert.deepEqual(indexed,await runtime.files({ids,query:'needle',useIndex:false}))
    assert.equal(await runtime.retain({ids:['first']}),2)
    await runtime.indexStatus({ids:['first'],wait:true})
    await assert.rejects(runtime.document({id:'second'}),/not downloaded/)
    assert.deepEqual((await runtime.files({ids:['first'],query:'needle'})).map(file=>file.url),['first'])
  }finally{runtime.close()}
})
