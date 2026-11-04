import { createSubtitleSearchRuntime, searchError } from './subtitle-search-runtime.js'
import { reserveSubtitleSession } from './subtitle-search-session.js'
const queryTypes=['files','attribute','statistics','regroup','vocabScan','automatic','playlist']

export function createSubtitleSearchClient({scope,assertCurrent=()=>{},workerFactory=()=>new Worker(new URL('./subtitle-search-worker.js',import.meta.url),{type:'module'}),timeoutMs=10000,onProgress=()=>{},onMode=()=>{},onCommitted=()=>{}}) {
  const baseScope=scope
  scope=JSON.stringify([scope,globalThis.crypto?.randomUUID?.() || Date.now()+'-'+Math.random()])
  let worker=null,fallback=null,ready=null,generation=0,nextId=0,revision=0,flushing=null,cancellation=0,hadWorker=false
  let reservation=null
  const requests=new Map(),pending=new Map(),documentRevisions=new Map()
  function discard(error) {
    generation++;worker?.terminate();worker=null;fallback?.close();fallback=null;ready=null
    for(const request of requests.values()){clearTimeout(request.timer);request.reject(error)}
    requests.clear()
  }
  async function start() {
    if(ready)return ready
    assertCurrent();const current=++generation
    ready=(async()=>{
      if(!reservation)reservation=reserveSubtitleSession(baseScope)
      scope=(await reservation).scope
      if(current!==generation)throw searchError('Search session changed.','subtitle-search-cancelled')
      assertCurrent()
      try {
        worker=workerFactory()
        worker.onmessage=({data})=>{
          if(data.generation!==generation)return
          const request=requests.get(data.id);if(!request)return
          if(data.progress){onProgress(data.progress);return}
          requests.delete(data.id);clearTimeout(request.timer)
          data.error?request.reject(searchError(data.error.message,data.error.code)):request.resolve(data.result)
        }
        worker.onerror=()=>{
          if(current!==generation)return
          const boot=[...requests.entries()].find(([,request])=>request.type==='init')
          if(boot){const [id,request]=boot;requests.delete(id);clearTimeout(request.timer);request.reject(searchError('The host could not start a search worker.'))}
          else discard(searchError('The search worker stopped. Run the search again.'))
        }
        await send('init',{scope,baseScope},2000)
        if(current!==generation)throw searchError('Search session changed.','subtitle-search-cancelled')
        hadWorker=true
        onMode('worker')
      }catch(error) {
        if(current!==generation)throw error
        worker?.terminate();worker=null
        if(hadWorker){ready=null;throw searchError('The search worker could not restart. Search is incomplete; try again.','subtitle-search-incomplete')}
        generation++ // Ignore any late events from the failed startup worker.
        fallback=await createSubtitleSearchRuntime(scope,{baseScope})
        onMode('cooperative')
      }
    })()
    const attempt=ready
    try{await attempt}catch(error){if(ready===attempt)ready=null;throw error}
    return attempt
  }
  function send(type,payload,budget=timeoutMs) {
    const id=++nextId,current=generation
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{
        if(type==='init'){requests.delete(id);worker?.terminate();reject(searchError('The host could not start a search worker.'));return}
        discard(searchError('Search timed out and is incomplete. Try a more specific pattern.','subtitle-search-timeout'))
      },budget)
      requests.set(id,{resolve,reject,timer,type})
      try{worker.postMessage({id,type,payload,generation:current})}catch(error){requests.delete(id);clearTimeout(timer);reject(error)}
    })
  }
  const client={
    update(id,document){
      assertCurrent()
      if([...requests.values()].some(request=>queryTypes.includes(request.type)))client.cancel()
      pending.set(id,document?{...document,id,revision:++revision}:{id,remove:true,revision:++revision})
      documentRevisions.set(id,revision)
    },
    async flush(){
      assertCurrent();await start()
      if(flushing)return flushing
      flushing=(async()=>{
        while(pending.size){
          assertCurrent()
          const documents=[];let bytes=0
          for(const doc of pending.values()){
            const size=2*((doc.sv?.length||0)+(doc.en?.length||0))
            if(documents.length&&(documents.length>=32||bytes+size>2*1024*1024))break
            documents.push(doc);bytes+=size
          }
          if(worker)await send('update',{documents},30000)
          else await fallback.update(documents)
          for(const doc of documents)if(pending.get(doc.id)===doc)pending.delete(doc.id)
          onCommitted(documents)
        }
      })()
      try{await flushing}finally{flushing=null}
    },
    async run(type,payload,{isCurrent=()=>true}={}){
      const epoch=cancellation,valid=()=>epoch===cancellation&&isCurrent()
      assertCurrent();await client.flush()
      if(!valid())throw searchError('Search cancelled.','subtitle-search-cancelled')
      const corpusRevision=revision,query=queryTypes.includes(type),documentRevision=documentRevisions.get(payload?.id)
      const documentChanged=()=>['document','context'].includes(type)&&documentRevisions.get(payload.id)!==documentRevision
      if(worker){const result=await send(type,payload);assertCurrent();if((query&&!valid())||(query&&revision!==corpusRevision)||documentChanged())throw searchError('Subtitle contents changed. Run the search again.','subtitle-search-cancelled');return result}
      const deadline=Date.now()+timeoutMs
      const check=()=>{
        assertCurrent()
        if(query&&(!valid()||revision!==corpusRevision))throw searchError('Search cancelled.','subtitle-search-cancelled')
        if(Date.now()>deadline)throw searchError('Search timed out and is incomplete. This host uses cooperative search and cannot interrupt a single regex evaluation.','subtitle-search-timeout')
      }
      const result=await fallback[type](payload,check,onProgress)
      if(documentChanged())throw searchError('Subtitle contents changed. Run the search again.','subtitle-search-cancelled')
      return result
    },
    cancel(){
      cancellation++
      if(worker && [...requests.values()].some(request=>queryTypes.includes(request.type))) {
        // A regex can prevent the worker from receiving a cancel message.
        // Termination is supervised here so the next query can start at once.
        discard(searchError('Search cancelled.','subtitle-search-cancelled'))
        return
      }
      for(const [id,request]of requests)if(queryTypes.includes(request.type)){
        requests.delete(id);clearTimeout(request.timer);request.reject(searchError('Search cancelled.','subtitle-search-cancelled'))
      }
      worker?.postMessage({type:'cancel',generation})
    },
    close(){const held=reservation;reservation=null;held?.then(lease=>lease.release()).catch(()=>{});discard(searchError('Search session closed.','subtitle-search-cancelled'))},
    get storageScope(){return scope},
    get revision(){return revision},
    get pendingSize(){return pending.size},
  }
  return client
}

// Observe raw corpus writes once. Derived parse caches do not invalidate search.
export function observeSubtitleCorpus(target,changed,reset=()=>{},{maxBytes=32*1024*1024}={}) {
  const fields=new Set(['sv','en','source','fileName','fetchedFrom','_partial','_remoteComplete'])
  let current,object,bytes=0
  const recent=new Map(),pending=new Set()
  const rawRecords=new Map(),rawOf=new WeakMap()
  const snapshot=value=>({...Object.fromEntries([...fields].map(key=>[key,value[key]])),_evicted:!!value._evicted})
  const touch=id=>{if(recent.has(id)){const size=recent.get(id);recent.delete(id);recent.set(id,size)}}
  const remember=id=>{
    bytes-=recent.get(id)||0;recent.delete(id)
    const value=rawRecords.get(id)
    if(!value||value._evicted)return
    const size=2*((value.sv?.length||0)+(value.en?.length||0))
    recent.set(id,size);bytes+=size
  }
  const trim=()=>{
    for(const [id,size]of recent){
      if(bytes<=maxBytes)break
      if(pending.has(id))continue
      const value=rawRecords.get(id)
      value._hasSv=!!value.sv;value._hasEn=!!value.en;value._evicted=true
      // These writes go directly to the underlying record, bypassing the
      // observable proxy: eviction is not a document edit or deletion.
      delete value.sv;delete value.en;delete value._parsedSv;delete value._parsedEn
      recent.delete(id);bytes-=size
    }
  }
  const publish=(id,value)=>{pending.add(id);changed(id,value?snapshot(value):null)}
  const wrap=(id,value)=>{
    if(!value||typeof value!=='object')return value
    value=rawOf.get(value)||value;rawRecords.set(id,value)
    const proxy=new Proxy(value,{get(object,key){if(key==='sv'||key==='en')touch(id);return object[key]},set(object,key,next){const old=object[key];object[key]=next;if(fields.has(key)&&old!==next)publish(id,object);return true},deleteProperty(object,key){delete object[key];if(fields.has(key))publish(id,object);return true}})
    rawOf.set(proxy,value);return proxy
  }
  const install=value=>{
    if(value===current)return
    reset()
    object=Object.create(null);recent.clear();pending.clear();rawRecords.clear();bytes=0
    for(const [id,record]of Object.entries(value||{})){object[id]=wrap(id,record);publish(id,record)}
    current=new Proxy(object,{set(object,id,value){object[id]=wrap(id,value);publish(id,value);return true},deleteProperty(object,id){delete object[id];rawRecords.delete(id);bytes-=recent.get(id)||0;recent.delete(id);publish(id,null);return true}})
  }
  Object.defineProperty(target,'allSubtitles',{configurable:true,get:()=>current,set:install})
  install({})
  return {
    committed(documents){
      for(const doc of documents){
        const value=object[doc.id]
        if(!value){pending.delete(doc.id);continue}
        if(value.sv===doc.sv&&value.en===doc.en){pending.delete(doc.id);remember(doc.id)}
      }
      trim()
    },
    hydrate(id,document){
      const value={...object[id],...document,_evicted:false}
      delete value.scope;delete value.revision
      object[id]=wrap(id,value);remember(id)
      // The awaiting consumer gets this complete search unit first; eviction
      // is deferred until its synchronous parse/context preparation finishes.
      setTimeout(trim,0)
      return object[id]
    },
    get stats(){
      const values=[...rawRecords.values()]
      return {residentBytes:values.reduce((sum,value)=>sum+2*((value.sv?.length||0)+(value.en?.length||0)),0),budgetBytes:maxBytes,
        residentDocuments:values.filter(value=>!value._evicted).length,documents:values.length,evicted:values.filter(value=>value._evicted).length,pendingDocuments:pending.size}
    },
  }
}
