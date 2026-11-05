// The active language stays in RAM. Disk-backed search remains an opt-in
// alternative; the downloaded-file cache is independent of this store.
export function openSubtitleMemoryCorpus(scope){
  const documents=new Map()
  return {
    async put(rows){for(const doc of rows)if(doc.remove)documents.delete(doc.id);else documents.set(doc.id,{...doc,scope})},
    async get(ids){return ids.map(id=>documents.get(id))},
    async *iterate(ids,{check=()=>{}}={}){
      let batch=[],bytes=0
      for(const id of ids){
        check()
        const doc=documents.get(id),size=2*((doc?.sv?.length||0)+(doc?.en?.length||0))
        if(batch.length&&(batch.length>=64||bytes+size>2*1024*1024)){yield batch;batch=[];bytes=0}
        batch.push(doc);bytes+=size
      }
      if(batch.length)yield batch
    },
    async list(){return []},
    async documentIds(){return [...documents.keys()]},
    async pendingIndexIds(){return []},
    async indexStatus(ids){return {total:ids.length,ready:0,pending:0,scanOnly:ids.length,storage:'memory'}},
    async prune(){},
    async removeScope(){throw new Error('In-memory search has no saved search cache.')},
    close(){documents.clear()},
  }
}
