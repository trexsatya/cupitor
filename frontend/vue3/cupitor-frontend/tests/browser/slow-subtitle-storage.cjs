// Delay real IDB completion callbacks while leaving the event loop available.
// The same fixture runs in a native worker and in the cooperative fallback.
function installSlowSubtitleStorage({startupMs=0,readMs=0,queryTypes=['files'],armOnMessage=true}={}){
  let armed=!armOnMessage,used=false
  if(armOnMessage)globalThis.addEventListener('message',({data})=>{
    if(!used&&queryTypes.includes(data?.type))armed=true
  })
  const delayed=(request,ms)=>{
    const proxy=new Proxy(request,{
      get(target,key){const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value},
      set(target,key,value){
        if(key==='onsuccess'&&typeof value==='function')target[key]=event=>setTimeout(()=>value.call(proxy,event),ms)
        else Reflect.set(target,key,value,target)
        return true
      },
    })
    return proxy
  }
  if(startupMs){
    const open=IDBFactory.prototype.open
    IDBFactory.prototype.open=function(...args){return delayed(open.apply(this,args),startupMs)}
  }
  for(const name of ['get','getAll']){
    const read=IDBObjectStore.prototype[name]
    IDBObjectStore.prototype[name]=function(...args){
      const request=read.apply(this,args)
      if(readMs&&armed&&!used&&this.name==='documents'&&this.transaction.mode==='readonly'){
        used=true;armed=false;return delayed(request,readMs)
      }
      return request
    }
  }
}
module.exports={installSlowSubtitleStorage}
