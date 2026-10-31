import {folderPaths, folderPath, parentFolder, inFolder, playlistMatches} from './playlist-folders.js'
const states = new Map()
const node = (tag, cls, text) => { const el=document.createElement(tag);if(cls)el.className=cls;if(text!=null)el.textContent=text;return el }
export function playlistBrowserState(scope) {
  if (!states.has(scope)) states.set(scope,{folder:null,query:'',type:'all'})
  return states.get(scope)
}
export function mountPlaylistBrowser(host, opts) {
  const {playlists,catalog,currentName,count,onSelect,onNew,onCreate,onEdit,onDelete,scope} = opts
  const state=playlistBrowserState(scope), paths=folderPaths(playlists,catalog)
  if (state.folder && !paths.includes(state.folder)) state.folder=null
  host.className='playlist-browser';host.replaceChildren()
  const toolbar=node('div','pl-browser-toolbar')
  const heading=node('div','pl-browser-heading');heading.append(node('h2',null,'Your playlists'),node('p',null,'Organize your learning into folders.'))
  const create=node('button','lang-tool-btn','+ New folder');create.type='button';create.id='playlistNewFolder';create.onclick=()=>onCreate(state.folder || '')
  const actions=node('div','pl-browser-new')
  const newPlaylist=node('button','lang-tool-btn pl-primary','+ New playlist');newPlaylist.type='button';newPlaylist.id='playlistCreate';newPlaylist.onclick=onNew
  actions.append(newPlaylist,create);toolbar.append(heading,actions)
  const filters=node('div','pl-browser-filters')
  const label=node('label','pl-filter');label.append(node('span','sr-only','Filter playlists'))
  const search=node('input');search.type='search';search.id='playlistFilter';search.placeholder='Filter by name or folder…';search.value=state.query;label.append(search)
  const type=node('select');type.id='playlistTypeFilter';type.setAttribute('aria-label','Playlist type')
  for(const [value,text] of [['all','All types'],['own','My playlists'],['shared','Shared with me'],['app','From the app'],['virtual','Virtual playlists']])type.add(new Option(text,value))
  type.value=state.type
  const clear=node('button','pl-clear','Clear');clear.type='button';clear.onclick=()=>{state.query='';state.type='all';search.value='';type.value='all';draw()}
  filters.append(label,type,clear)
  const layout=node('div','pl-browser-layout'), folders=node('details','pl-folder-pane');folders.open=state.foldersOpen ?? window.innerWidth>=700
  folders.ontoggle=()=>{if(folders.isConnected)state.foldersOpen=folders.open}
  folders.append(node('summary',null,'Folders'))
  const tree=node('nav','pl-folder-list');tree.setAttribute('aria-label','Playlist folders');folders.append(tree)
  const main=node('div','pl-browser-main'), crumb=node('nav','pl-breadcrumb');crumb.setAttribute('aria-label','Folder location')
  const folderActions=node('div','pl-folder-actions'), status=node('div','pl-browser-status');status.setAttribute('role','status')
  const list=node('div','pl-playlist-list');list.setAttribute('aria-label','Playlists')
  main.append(crumb,folderActions,status,list);layout.append(folders,main);host.append(toolbar,filters,layout)
  function go(path){state.folder=path;draw()}
  function folderButton(path,text,number){
    const button=node('button','pl-folder-button');button.type='button';button.dataset.folder=path===null?'*':path
    button.setAttribute('aria-current',state.folder===path?'location':'false')
    if(path)button.title=path
    if(path)button.style.setProperty('--folder-depth',String(Math.min(8,path.split('/').length-1)))
    button.append(node('span','pl-folder-name',text),node('span','pl-count',String(number)))
    button.onclick=()=>go(path);return button
  }
  function draw(){
    tree.replaceChildren()
    const entries=Object.entries(playlists).sort(([a],[b])=>a.localeCompare(b))
    tree.append(folderButton(null,'All playlists',entries.length),folderButton('','Unfiled',entries.filter(([,p])=>!folderPath(p.folder)).length))
    for(const path of paths)tree.append(folderButton(path,'▱ '+path.split('/').at(-1),entries.filter(([,p])=>inFolder(folderPath(p.folder),path)).length))
    crumb.replaceChildren()
    const all=node('button',null,'All playlists');all.type='button';all.onclick=()=>go(null);crumb.append(all)
    if(state.folder==='')crumb.append(node('span',null,'/ Unfiled'))
    else if(state.folder){let path='';for(const part of state.folder.split('/')){path=path?path+'/'+part:part;const target=path;const b=node('button',null,part);b.type='button';b.onclick=()=>go(target);crumb.append(node('span',null,'/'),b)}}
    folderActions.replaceChildren()
    if(state.folder){
      for(const [text,action] of [['New subfolder',()=>onCreate(state.folder)],['Rename / move folder',()=>onEdit(state.folder)],['Delete folder',()=>onDelete(state.folder)]]){
        const b=node('button','pl-text-button',text);b.type='button';b.onclick=action;folderActions.append(b)
      }
    }
    list.replaceChildren()
    const visible=entries.filter(([name,p])=>playlistMatches(name,p,state))
    status.textContent=visible.length+' playlist'+(visible.length===1?'':'s')+(state.query?' matching “'+state.query+'”':'')
    clear.hidden=!state.query&&state.type==='all'
    // Immediate subfolders stay navigable even when their playlists are empty.
    if(state.folder!==null&&!state.query&&state.type==='all')for(const path of paths.filter(p=>parentFolder(p)===state.folder)){
      const b=node('button','pl-child-folder','▱ '+path.split('/').at(-1)+'  ›');b.type='button';b.onclick=()=>go(path);list.append(b)
    }
    for(const [name,p] of visible){
      const row=node('button','pl-playlist-row');row.type='button';row.dataset.playlist=name;row.setAttribute('aria-pressed',name===currentName?'true':'false')
      row.append(node('span','pl-playlist-icon',p.virtual?'🔗':p.readOnly?'▣':'▤'))
      const body=node('span','pl-playlist-body');body.append(node('strong',null,name))
      const kind=p.readOnly?'Shared · read only':p.external?'From the app':p.virtual?'Virtual playlist':'Playlist'
      body.append(node('small',null,(folderPath(p.folder)||'Unfiled')+' · '+kind))
      const total=count(name)
      row.append(body,node('span','pl-count',total+' '+(total===1?'card':'cards')),node('span','pl-row-arrow','›'));row.onclick=()=>onSelect(name);list.append(row)
    }
    if(!list.children.length){const empty=node('div','pl-browser-empty');empty.append(node('strong',null,state.query||state.type!=='all'?'No matching playlists':'This folder is empty'),node('p',null,state.query||state.type!=='all'?'Try another filter or choose All playlists.':'Create a playlist here, or move an existing playlist into this folder.'));list.append(empty)}
  }
  search.oninput=()=>{state.query=search.value;draw()};type.onchange=()=>{state.type=type.value;draw()}
  draw()
  return state
}
