// Disposable raw search corpus, separate from authoritative user edits. Only
// the active scope and bounded document batches enter memory.
const request = req => new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})
const done = tx => new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('Search cache transaction interrupted'));tx.onerror=()=>{}})
export async function openSubtitleCorpus(scope, factory = globalThis.indexedDB, {baseScope=scope}={}) {
  if (!factory) throw new Error('Search storage is unavailable; full subtitle coverage could not be prepared.')
  const db = await new Promise((resolve,reject)=>{
    const req=factory.open('cupitor-search-corpus-v1',2)
    let blocked=false
    req.onupgradeneeded=()=>{
      const documents=req.result.objectStoreNames.contains('documents')?req.transaction.objectStore('documents'):req.result.createObjectStore('documents',{keyPath:['scope','id']})
      if(!documents.indexNames.contains('scope'))documents.createIndex('scope','scope')
      if(!req.result.objectStoreNames.contains('info'))req.result.createObjectStore('info',{keyPath:['scope','id']}).createIndex('scope','scope')
      if(!req.result.objectStoreNames.contains('scopes'))req.result.createObjectStore('scopes',{keyPath:'scope'})
    }
    req.onsuccess=()=>{if(blocked)req.result.close();else resolve(req.result)}
    req.onerror=()=>reject(req.error)
    req.onblocked=()=>{blocked=true;reject(new Error('Close other Cupitor tabs before preparing search storage.'))}
  })
  let heartbeat=null,pruning=null
  db.onversionchange=()=>{clearInterval(heartbeat);db.close()}
  const transact=(names,mode='readonly')=>db.transaction(names,mode)
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
      const tx=transact(['documents','info','scopes'],'readwrite'),complete=done(tx)
      complete.catch(()=>{})
      try {
        const [previous,meta]=await Promise.all([
          Promise.all(documents.map(doc=>request(tx.objectStore('info').get([scope,doc.id])))),
          request(tx.objectStore('scopes').get(scope)),
        ])
        let count=meta?.count||0,bytes=meta?.bytes||0
        for(let i=0;i<documents.length;i++) {
          const doc=documents[i],old=previous[i]
          if(old){count--;bytes-=old.bytes}
          if(doc.remove){tx.objectStore('documents').delete([scope,doc.id]);tx.objectStore('info').delete([scope,doc.id])}
          else {
            const size=2*((doc.sv?.length||0)+(doc.en?.length||0))
            tx.objectStore('documents').put({...doc,scope})
            tx.objectStore('info').put({scope,id:doc.id,bytes:size,revision:doc.revision})
            count++;bytes+=size
          }
        }
        tx.objectStore('scopes').put({...meta,scope,baseScope,createdAt:meta?.createdAt||Date.now(),touchedAt:Date.now(),leaseUntil:Date.now()+180000,count,bytes})
      }catch(error){tx.abort();await complete.catch(()=>{});throw error}
      await complete;touched=Date.now()
      if(!pruning)pruning=api.prune().catch(()=>{}).finally(()=>{pruning=null})
    },
    async get(ids) {
      await api.touch()
      const tx=transact(['documents']),complete=done(tx);complete.catch(()=>{})
      const records=await Promise.all(ids.map(id=>request(tx.objectStore('documents').get([scope,id]))))
      await complete;return records
    },
    async *iterate(ids) {
      // Plan batches from tiny metadata records, not full text. A transcript
      // larger than the budget is processed alone as an indivisible regex unit.
      for(let offset=0;offset<ids.length;offset+=128) {
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
    async removeScope(target) {
      if(target===scope)throw new Error('The active subtitle search cache is protected.')
      for(;;){
        const tx=transact(['documents','info','scopes'],'readwrite'),complete=done(tx);complete.catch(()=>{})
        const keys=await request(tx.objectStore('documents').index('scope').getAllKeys(target,256))
        for(const key of keys){tx.objectStore('documents').delete(key);tx.objectStore('info').delete(key)}
        if(keys.length<256)tx.objectStore('scopes').delete(target)
        await complete
        if(keys.length<256)return
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
      let bytes=entries.filter(meta=>!removing.has(meta.scope)).reduce((sum,meta)=>sum+(meta.bytes||0),0)
      for(const meta of [...entries].reverse())if(bytes>128*1024*1024&&meta.scope!==scope&&!(meta.leaseUntil>now)&&!removing.has(meta.scope)){
        remove.push(meta);removing.add(meta.scope);bytes-=meta.bytes||0
      }
      for(const meta of remove)await api.removeScope(meta.scope)
    },
    close(){clearInterval(heartbeat);db.close()},
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
