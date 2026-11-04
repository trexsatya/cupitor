import { createSubtitleSearchRuntime, searchError } from './subtitle-search-runtime.js'
let runtime,session,activeQuery=0
self.onmessage=async({data})=>{
  const {id,type,payload,generation}=data
  try {
    if(type==='init') {
      runtime?.close();session=generation
      runtime=await createSubtitleSearchRuntime(payload.scope,{...payload.options,baseScope:payload.baseScope})
    } else if(generation!==session) return
    else if(type==='cancel'){activeQuery=0;return}
    else if(type==='update')await runtime.update(payload.documents)
    else if(['document','context','caches','clearCache','indexStatus','retain'].includes(type)){self.postMessage({id,generation,result:await runtime[type](payload)});return}
    else if(['files','attribute','statistics','regroup','vocabScan','automatic','playlist'].includes(type)) {
      activeQuery=id
      const check=()=>{if(activeQuery!==id||session!==generation)throw searchError('Search cancelled.','subtitle-search-cancelled')}
      const result=await runtime[type](payload,check,progress=>self.postMessage({id,generation,progress}))
      check();self.postMessage({id,generation,result});return
    }
    self.postMessage({id,generation,result:true})
  }catch(error){self.postMessage({id,generation,error:{message:error.message,code:error.code||'subtitle-search-incomplete'}})}
}
