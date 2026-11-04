import { buildSubtitleFeatures, planSubtitleCandidates, indexCovers, POSTING_SHARD_SIZE, SUBTITLE_INDEX_VERSION, SUBTITLE_INDEX_ENVIRONMENT } from './subtitle-search-index.js'

const request = req => new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})
const done = tx => {
  const promise=new Promise((resolve,reject)=>{tx.oncomplete=resolve;tx.onabort=()=>reject(tx.error||new Error('Search index transaction interrupted'));tx.onerror=()=>{}})
  promise.catch(()=>{});return promise
}
const postingBytes = record => record ? 2*record.term.length + 4*record.ordinals.length : 0
const featureBytes = record => record ? record.terms.reduce((bytes,term)=>bytes+2*term.length,0) : 0
export const currentIndex = info => info?.indexVersion===SUBTITLE_INDEX_VERSION && info.indexEnvironment===SUBTITLE_INDEX_ENVIRONMENT && info.indexGeneration===(info.generation||0)

// Sharded postings keep a frequent word from becoming one unbounded IDB value.
// Raw content/version invalidation commits first; an optional index commit
// atomically replaces this document's old postings, features and ready marker.
export function createSubtitleIndex(db, scope) {
  const transaction=(names,mode='readonly')=>db.transaction(names,mode)
  const coverage=new Map();let coverageRevision=null
  async function revision(){const tx=transaction(['scopes']),complete=done(tx),meta=await request(tx.objectStore('scopes').get(scope));await complete;return meta?.corpusRevision||0}
  async function metadata(ids,currentRevision=undefined) {
    currentRevision??=await revision()
    if(coverageRevision!==currentRevision){coverage.clear();coverageRevision=currentRevision}
    const missing=ids.filter(id=>!coverage.has(id)),loaded=new Map()
    for(let offset=0;offset<missing.length;offset+=128){
      const tx=transaction(['info']),complete=done(tx)
      const part=missing.slice(offset,offset+128),rows=await Promise.all(part.map(id=>request(tx.objectStore('info').get([scope,id]))))
      await complete
      part.forEach((id,i)=>{loaded.set(id,rows[i]);if(coverageRevision===currentRevision)coverage.set(id,rows[i])})
    }
    return ids.map(id=>loaded.has(id)?loaded.get(id):coverage.get(id))
  }
  const api={
    changed(rows,currentRevision){
      if(coverageRevision!==currentRevision-1)coverage.clear()
      coverageRevision=currentRevision
      for(const row of rows)if(row.scope)coverage.set(row.id,row);else coverage.delete(row.id)
    },
    async pending({all=false}={}){
      const tx=transaction(['info']),complete=done(tx),ids=[]
      await new Promise((resolve,reject)=>{
        const cursor=tx.objectStore('info').index('scope').openCursor(scope)
        cursor.onerror=()=>reject(cursor.error)
        cursor.onsuccess=()=>{const row=cursor.result;if(!row){resolve();return}if(all||!currentIndex(row.value))ids.push(row.value.id);row.continue()}
      })
      await complete;return ids
    },
    async document(id,{check=()=>{},maxTerms,yieldToUI}={}){
      check()
      if(currentIndex(coverage.get(id)))return false
      const read=transaction(['info','documents']),readDone=done(read)
      const [before,raw]=await Promise.all([request(read.objectStore('info').get([scope,id])),request(read.objectStore('documents').get([scope,id]))])
      await readDone
      if(before&&currentIndex(before))return false
      if(raw&&!before)return false // Missing metadata is never a trusted index.
      const features=raw?await buildSubtitleFeatures(raw,{check,maxTerms,yieldToUI}):null
      check()
      const tx=transaction(['info','features','postings','scopes'],'readwrite'),complete=done(tx)
      let updatedInfo,updatedRevision
      try{
        const [now,old,meta]=await Promise.all([
          request(tx.objectStore('info').get([scope,id])),request(tx.objectStore('features').get([scope,id])),request(tx.objectStore('scopes').get(scope)),
        ])
        if((now?.generation||0)!==(before?.generation||0)||now?.ordinal!==before?.ordinal||!!now!==!!before){await complete;return false}
        if(!meta){await complete;return false}
        if(!now&&!old){await complete;return false}
        const ordinal=now?.ordinal??old?.ordinal??(meta.nextOrdinal||0)
        if(ordinal>=0xffffffff){await complete;return false}
        const shard=Math.floor(ordinal/POSTING_SHARD_SIZE),keys=new Map()
        for(const term of old?.terms||[])keys.set(JSON.stringify([term,old.shard]),[term,old.shard])
        for(const term of features?.terms||[])keys.set(JSON.stringify([term,shard]),[term,shard])
        const pairs=[...keys.values()],postings=tx.objectStore('postings')
        const rows=await Promise.all(pairs.map(([term,block])=>request(postings.get([scope,term,block]))))
        const newTerms=new Set(features?.terms||[]),oldTerms=new Set(old?.terms||[])
        let delta=0
        for(let i=0;i<pairs.length;i++){
          const [term,block]=pairs[i],values=new Set(rows[i]?.ordinals||[])
          if(old&&block===old.shard&&oldTerms.has(term))values.delete(old.ordinal)
          if(features&&block===shard&&newTerms.has(term))values.add(ordinal)
          const next=values.size?{scope,term,shard:block,ordinals:Uint32Array.from([...values].sort((a,b)=>a-b))}:null
          delta+=postingBytes(next)-postingBytes(rows[i])
          if(next)postings.put(next);else postings.delete([scope,term,block])
        }
        const next=features?{scope,id,ordinal,shard,terms:features.terms}:null
        delta+=featureBytes(next)-featureBytes(old)
        if(next)tx.objectStore('features').put(next);else tx.objectStore('features').delete([scope,id])
        if(now){updatedInfo={...now,ordinal,indexVersion:SUBTITLE_INDEX_VERSION,indexEnvironment:SUBTITLE_INDEX_ENVIRONMENT,indexGeneration:now.generation||0,indexComplete:features.complete,wordComplete:features.wordComplete};tx.objectStore('info').put(updatedInfo)}
        updatedRevision=meta.corpusRevision||0
        tx.objectStore('scopes').put({...meta,indexBytes:Math.max(0,(meta.indexBytes||0)+delta),nextOrdinal:now?Math.max(meta.nextOrdinal||0,ordinal+1):(meta.nextOrdinal||0)})
        check()
      }catch(error){try{tx.abort()}catch(_){}await complete.catch(()=>{});throw error}
      await complete
      if(updatedInfo&&coverageRevision===updatedRevision)coverage.set(id,updatedInfo)
      return true
    },
    async candidates(ids,query,options={},check=()=>{}){
      const plan=planSubtitleCandidates(query,options)
      if(!plan)return {ids,strategy:'scan',indexed:0,pending:0}
      const beforeRevision=await revision()
      const info=await metadata(ids,beforeRevision),accepted=new Set(),shards=new Map()
      let indexed=0,pending=0
      for(let i=0;i<ids.length;i++){
        check();const entry=info[i]
        if(!indexCovers(entry,plan)||!Number.isSafeInteger(entry.ordinal)){accepted.add(ids[i]);pending++;continue}
        const shard=Math.floor(entry.ordinal/POSTING_SHARD_SIZE)
        if(!shards.has(shard))shards.set(shard,[])
        shards.get(shard).push({id:ids[i],ordinal:entry.ordinal});indexed++
      }
      const terms=[...new Set(plan.clauses.flat())]
      let blocks=[...shards.keys()]
      if(blocks.length){
        // Choose a rare posting term per OR branch before loading posting
        // values. Common anchors keep the bounded shard path instead.
        const tx=transaction(['postings']),complete=done(tx),index=tx.objectStore('postings').index('term')
        const counts=await Promise.all(terms.map(term=>request(index.count([scope,term]))))
        const byTerm=new Map(terms.map((term,i)=>[term,counts[i]]))
        const anchors=[...new Set(plan.clauses.map(clause=>clause.reduce((best,term)=>byTerm.get(term)<byTerm.get(best)?term:best)))]
        if(anchors.some(term=>byTerm.get(term)>2048))await complete
        else{
          const keys=await Promise.all(anchors.map(term=>request(index.getAllKeys([scope,term],2048))))
          await complete
          const possible=new Set(keys.flat().map(key=>key[2]))
          blocks=blocks.filter(shard=>possible.has(shard))
        }
      }
      for(let offset=0;offset<blocks.length;offset+=16){
        check()
        const batch=blocks.slice(offset,offset+16),tx=transaction(['postings']),complete=done(tx),postings=tx.objectStore('postings')
        const rows=await Promise.all(batch.flatMap(shard=>terms.map(term=>request(postings.get([scope,term,shard])))))
        await complete
        for(let i=0;i<batch.length;i++){
          const byTerm=new Map(terms.map((term,j)=>[term,new Set(rows[i*terms.length+j]?.ordinals||[])]))
          for(const entry of shards.get(batch[i]))if(plan.clauses.some(clause=>clause.every(term=>byTerm.get(term).has(entry.ordinal))))accepted.add(entry.id)
        }
      }
      check()
      if(await revision()!==beforeRevision)return {ids,strategy:'scan',indexed:0,pending:ids.length}
      return {ids:ids.filter(id=>accepted.has(id)),strategy:plan.kind,indexed,pending}
    },
    async status(ids){
      const rows=await metadata(ids)
      return {total:ids.length,ready:rows.filter(row=>currentIndex(row)&&row.indexComplete).length,
        pending:rows.filter(row=>!currentIndex(row)).length,scanOnly:rows.filter(row=>currentIndex(row)&&!row.indexComplete).length}
    },
  }
  return api
}
