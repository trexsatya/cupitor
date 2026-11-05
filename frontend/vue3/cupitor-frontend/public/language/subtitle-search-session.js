const randomId=()=>globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random()

// A tab keeps its derived corpus across reloads. Web Locks prevent an opener
// or duplicated tab's copied sessionStorage from sharing unsynced text. Hosts
// without both APIs keep the previous isolated, disposable session behavior.
export async function reserveSubtitleSession(baseScope,{storage,locks,random=randomId}={}){
  // The scope is repeated in every posting key and secondary index. Nested
  // repository JSON made small libraries occupy hundreds of megabytes.
  const scopeFor=async token=>{
    const full=JSON.stringify([baseScope,token])
    if(!globalThis.crypto?.subtle)return full
    try{
      const digest=await globalThis.crypto.subtle.digest('SHA-256',new TextEncoder().encode(full))
      return 's:'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('')
    }catch(_){return full}
  }
  const fresh=async()=>({scope:await scopeFor(random()),release(){}})
  try{storage??=globalThis.sessionStorage;locks??=globalThis.navigator?.locks}catch(_){return fresh()}
  if(!storage||!locks?.request)return fresh()
  const key='cupitor:subtitle-search-session:'+baseScope
  let token
  try{token=storage.getItem(key)||random()}catch(_){return fresh()}
  for(let attempt=0;attempt<2;attempt++){
    const held=await new Promise(resolve=>{
      try{
        const task=locks.request('cupitor:subtitle-search:'+JSON.stringify([baseScope,token]),{ifAvailable:true},lock=>{
          if(!lock){resolve(null);return}
          let release
          const lifetime=new Promise(finish=>{release=finish})
          resolve({scope:JSON.stringify([baseScope,token]),release})
          return lifetime
        })
        task.catch(()=>resolve(null))
      }catch(_){resolve(null)}
    })
    if(held){try{storage.setItem(key,token)}catch(_){}return {...held,scope:await scopeFor(token),legacyScope:held.scope}}
    token=random()
  }
  return fresh()
}
