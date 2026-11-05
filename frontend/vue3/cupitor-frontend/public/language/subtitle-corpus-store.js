// Disposable raw search corpus, separate from authoritative user edits. Only
// the active scope and bounded document batches enter memory.
import { createSubtitleIndex } from './subtitle-index-store.js'
const request = req => new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})
const done = tx => new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('Search cache transaction interrupted'));tx.onerror=()=>{}})
export async function openSubtitleCorpus(scope, factory = globalThis.indexedDB, {baseScope=scope,keyRange=globalThis.IDBKeyRange,legacyScope,onStorageProgress=()=>{}}={}) {
  if (!factory) throw new Error('Search storage is unavailable; full subtitle coverage could not be prepared.')
  const db = await new Promise((resolve,reject)=>{
    const req=factory.open('cupitor-search-corpus-v1',3)
    let blocked=false
    req.onupgradeneeded=()=>{
      const documents=req.result.objectStoreNames.contains('documents')?req.transaction.objectStore('documents'):req.result.createObjectStore('documents',{keyPath:['scope','id']})
      if(!documents.indexNames.contains('scope'))documents.createIndex('scope','scope')
      if(!req.result.objectStoreNames.contains('info'))req.result.createObjectStore('info',{keyPath:['scope','id']}).createIndex('scope','scope')
      if(!req.result.objectStoreNames.contains('scopes'))req.result.createObjectStore('scopes',{keyPath:'scope'})
      if(!req.result.objectStoreNames.contains('features'))req.result.createObjectStore('features',{keyPath:['scope','id']}).createIndex('scope','scope')
      if(!req.result.objectStoreNames.contains('postings')){
        const postings=req.result.createObjectStore('postings',{keyPath:['scope','term','shard']})
        postings.createIndex('scope','scope');postings.createIndex('term',['scope','term'])
      }
    }
    req.onsuccess=()=>{if(blocked)req.result.close();else resolve(req.result)}
    req.onerror=()=>reject(req.error)
    req.onblocked=()=>{blocked=true;reject(new Error('Close other Cupitor tabs before preparing search storage.'))}
  })
  let heartbeat=null,pruning=null
  db.onversionchange=()=>{clearInterval(heartbeat);db.close()}
  const transact=(names,mode='readonly')=>db.transaction(names,mode)
  const searchIndex=createSubtitleIndex(db,scope,{keyRange})
  let touched=0
  const api={
    async touch(){
      if(Date.now()-touched<60000)return
      const tx=transact(['scopes'],'readwrite'),complete=done(tx);complete.catch(()=>{})
      const old=await request(tx.objectStore('scopes').get(scope))
      tx.objectStore('scopes').put({...old,scope,baseScope,createdAt:old?.createdAt||Date.now(),touchedAt:Date.now(),leaseUntil:Date.now()+180000,count:old?.count||0,bytes:old?.bytes||0})
      await complete;touched=Date.now()
    },
    async put(documents) {
      documents=[...new Map(documents.map(doc=>[doc.id,doc])).values()]
      const tx=transact(['documents','info','scopes'],'readwrite'),complete=done(tx)
      complete.catch(()=>{})
      const changed=[];let nextRevision
      try {
        const [previous,oldDocuments,meta]=await Promise.all([
          Promise.all(documents.map(doc=>request(tx.objectStore('info').get([scope,doc.id])))),
          Promise.all(documents.map(doc=>request(tx.objectStore('documents').get([scope,doc.id])))),
          request(tx.objectStore('scopes').get(scope)),
        ])
        let count=meta?.count||0,bytes=meta?.bytes||0,nextOrdinal=meta?.nextOrdinal||0
        for(let i=0;i<documents.length;i++) {
          const doc=documents[i],old=previous[i]
          if(old){count--;bytes-=old.bytes}
          if(doc.remove){tx.objectStore('documents').delete([scope,doc.id]);tx.objectStore('info').delete([scope,doc.id]);changed.push({id:doc.id})}
          else {
            const size=2*((doc.sv?.length||0)+(doc.en?.length||0))
            tx.objectStore('documents').put({...doc,scope})
            const before=oldDocuments[i],same=!!before&&(before.sv||null)===(doc.sv||null)&&(before.en||null)===(doc.en||null)
            const info={...old,scope,id:doc.id,bytes:size,revision:doc.revision,
              generation:same?(old?.generation||0):(old?.generation||0)+1,ordinal:old?.ordinal??nextOrdinal++,
              indexComplete:same&&!!old?.indexComplete,wordComplete:same&&!!old?.wordComplete}
            tx.objectStore('info').put(info);changed.push(info)
            count++;bytes+=size
          }
        }
        nextRevision=(meta?.corpusRevision||0)+1
        tx.objectStore('scopes').put({...meta,scope,baseScope,createdAt:meta?.createdAt||Date.now(),touchedAt:Date.now(),leaseUntil:Date.now()+180000,count,bytes,nextOrdinal,corpusRevision:nextRevision})
      }catch(error){tx.abort();await complete.catch(()=>{});throw error}
      await complete;touched=Date.now();searchIndex.changed(changed,nextRevision)
      if(!pruning)pruning=api.prune().catch(()=>{}).finally(()=>{pruning=null})
    },
    async get(ids) {
      await api.touch()
      const tx=transact(['documents']),complete=done(tx);complete.catch(()=>{})
      const records=await Promise.all(ids.map(id=>request(tx.objectStore('documents').get([scope,id]))))
      await complete;return records
    },
    async *iterate(ids,{unordered=false,check=()=>{}}={}) {
      if(unordered&&keyRange){
        // File inclusion can read in storage order and restore the caller's
        // order afterward. Consecutive records need one bounded getAll, not
        // thousands of separate get callbacks for an unindexed library.
        ids=[...ids].sort()
        const info=await searchIndex.metadata(ids,undefined,check)
        let batch=[],bytes=0
        const read=async()=>{
          check()
          const tx=transact(['documents']),complete=done(tx);complete.catch(()=>{})
          const store=tx.objectStore('documents'),range=keyRange.bound([scope,batch[0]],[scope,batch.at(-1)])
          // A sparse candidate set may have large unselected transcripts in
          // its gaps. Count before reading so those never enter the batch.
          const count=await request(store.count(range))
          let rows=count===batch.length?await request(store.getAll(range)):null
          if(!rows||rows.some((row,i)=>row.id!==batch[i]))rows=await Promise.all(batch.map(id=>request(store.get([scope,id]))))
          await complete;check();return rows
        }
        for(let i=0;i<ids.length;i++){
          const size=info[i]?.bytes??Infinity
          if(batch.length&&(bytes+size>2*1024*1024||batch.length>=64)){yield await read();batch=[];bytes=0}
          batch.push(ids[i]);bytes+=size
        }
        if(batch.length)yield await read()
        return
      }
      // Plan batches from tiny metadata records, not full text. A transcript
      // larger than the budget is processed alone as an indivisible regex unit.
      for(let offset=0;offset<ids.length;offset+=128) {
        check()
        const part=ids.slice(offset,offset+128),tx=transact(['info']),complete=done(tx);complete.catch(()=>{})
        const info=await Promise.all(part.map(id=>request(tx.objectStore('info').get([scope,id]))))
        await complete
        let batch=[],bytes=0
        for(let i=0;i<part.length;i++) {
          const size=info[i]?.bytes??Infinity
          if(batch.length&&(bytes+size>2*1024*1024||batch.length>=64)){yield await api.get(batch);batch=[];bytes=0}
          batch.push(part[i]);bytes+=size
        }
        if(batch.length)yield await api.get(batch)
      }
    },
    async list(){const tx=transact(['scopes']),complete=done(tx);complete.catch(()=>{});const result=await request(tx.objectStore('scopes').getAll());await complete;return result},
    indexDocument:searchIndex.document,
    candidates:searchIndex.candidates,
    indexStatus:searchIndex.status,
    pendingIndexIds:searchIndex.pending,
    documentIds:()=>searchIndex.pending({all:true}),
    async removeScope(target,progress=()=>{}) {
      if(target===scope)throw new Error('The active subtitle search cache is protected.')
      for(;;){
        const stores=['documents','info','features','postings']
        const tx=transact([...stores,'scopes'],'readwrite'),complete=done(tx);complete.catch(()=>{})
        const keys=await Promise.all(stores.map(name=>request(tx.objectStore(name).index('scope').getAllKeys(target,256))))
        stores.forEach((name,i)=>keys[i].forEach(key=>tx.objectStore(name).delete(key)))
        const finished=keys.every(batch=>batch.length<256)
        if(finished)tx.objectStore('scopes').delete(target)
        await complete
        progress()
        if(finished)return
      }
    },
    async prune(){
      const entries=(await api.list()).sort((a,b)=>b.touchedAt-a.touchedAt)
      const kept=new Set(),remove=[],now=Date.now()
      for(const meta of entries){
        if(meta.scope===scope||meta.leaseUntil>now)continue
        if(meta.touchedAt<now-7*86400000||kept.has(meta.baseScope))remove.push(meta)
        else kept.add(meta.baseScope)
      }
      const removing=new Set(remove.map(meta=>meta.scope))
      let bytes=entries.filter(meta=>!removing.has(meta.scope)).reduce((sum,meta)=>sum+(meta.bytes||0)+(meta.indexBytes||0),0)
      for(const meta of [...entries].reverse())if(bytes>128*1024*1024&&meta.scope!==scope&&!(meta.leaseUntil>now)&&!removing.has(meta.scope)){
        remove.push(meta);removing.add(meta.scope);bytes-=(meta.bytes||0)+(meta.indexBytes||0)
      }
      for(const meta of remove)await api.removeScope(meta.scope)
    },
    close(){clearInterval(heartbeat);db.close()},
  }
  // Only the tab holding the matching Web Lock supplies legacyScope. Reclaim
  // its old, oversized derived index before writing another corpus copy.
  // Authoritative downloads, captures and user edits live in other databases.
  if(legacyScope&&legacyScope!==scope){
    const tx=transact(['scopes']),complete=done(tx),meta=await request(tx.objectStore('scopes').get(legacyScope))
    await complete
    if(meta?.baseScope===baseScope)await api.removeScope(legacyScope,onStorageProgress)
  }
  await api.touch()
  heartbeat=setInterval(()=>api.touch().catch(()=>{}),30000)
  api.prune().catch(()=>{})
  return api
}

export function createDocumentCache(maxBytes = 16 * 1024 * 1024) {
  const entries=new Map();let bytes=0
  return {
    get(id,revision){const value=entries.get(id);if(!value||value.revision!==revision)return null;entries.delete(id);entries.set(id,value);return value.document},
    put(id,revision,document){
      this.remove(id)
      const size=2*((document.sv?.length||0)+(document.en?.length||0)+(document.svClean?.length||0)+(document.enClean?.length||0))
      if(size>maxBytes)return
      entries.set(id,{revision,document,size});bytes+=size
      while(bytes>maxBytes)this.remove(entries.keys().next().value)
    },
    remove(id){const old=entries.get(id);if(old){bytes-=old.size;entries.delete(id)}},
    get bytes(){return bytes},
  }
}
