import { createSubtitleSearchRuntime, searchError } from './subtitle-search-runtime.js'
let runtime,session,activeQuery=0
self.onmessage=async({data})=>{
  const {id,type,payload,generation}=data
  try {
    if(type==='init') {
      runtime?.close();session=generation
      runtime=await createSubtitleSearchRuntime(payload.scope,{...payload.options,baseScope:payload.baseScope,legacyScope:payload.legacyScope,
        onStorageProgress:()=>self.postMessage({id,generation,heartbeat:true})})
    } else if(generation!==session) return
    else if(type==='cancel'){activeQuery=0;return}
    else if(type==='update')await runtime.update(payload.documents)
    else if(['document','context','caches','clearCache','indexStatus','retain','setIndexingPaused'].includes(type)){self.postMessage({id,generation,result:await runtime[type](payload)});return}
    else if(['files','attribute','statistics','regroup','vocabScan','automatic','playlist'].includes(type)) {
      activeQuery=id
      let lastHeartbeat=0
      const check=()=>{
        if(activeQuery!==id||session!==generation)throw searchError('Search cancelled.','subtitle-search-cancelled')
        // Renew the supervisor only at real, cancellable work checkpoints.
        // A synchronous runaway regex cannot send these heartbeats.
        if(Date.now()-lastHeartbeat>=100){lastHeartbeat=Date.now();self.postMessage({id,generation,heartbeat:true})}
      }
      const result=await runtime[type](payload,check,progress=>self.postMessage({id,generation,progress}))
      check();self.postMessage({id,generation,result});return
    }
    self.postMessage({id,generation,result:true})
  }catch(error){self.postMessage({id,generation,error:{message:error.message,code:error.code||'subtitle-search-incomplete'}})}
}
