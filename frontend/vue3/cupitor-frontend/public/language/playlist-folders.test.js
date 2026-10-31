import {folderPath,folderChange,folderPaths,mergeFolderCatalog,playlistMatches} from './playlist-folders.js'
import {mergePlaylist3} from './recordings-3way.js'

test('paths are normalized independently of playlist names and unsafe segments are rejected',()=>{
  expect(folderPath(' Svenska / Lyssna ')).toBe('Svenska/Lyssna')
  for(const value of ['a//b','../a','a/..','a\\b','a/\u0000'])expect(folderPath(value)).toBe('')
  const source={'name / with slashes':{items:{},folder:'Svenska/Lyssna'}}
  expect(folderPaths(source)).toEqual(['Svenska','Svenska/Lyssna'])
  expect(Object.keys(source)).toEqual(['name / with slashes'])
})
test('nested folders can be created empty, renamed and moved without changing cards or identities',()=>{
  let result=folderChange({}, {}, {name:'Svenska'},1)
  result=folderChange(result.playlists,result.catalog,{name:'Lyssna',parent:'Svenska'},2)
  const cards={Manual:{Card:[{id:'original',source:'Hej'}]}}
  result.playlists.A={items:cards,folder:'Svenska/Lyssna'}
  result=folderChange(result.playlists,result.catalog,{from:'Svenska',name:'Språk'},3)
  expect(result.playlists.A.folder).toBe('Språk/Lyssna')
  expect(result.playlists.A.items).toBe(cards)
  expect(folderPaths(result.playlists,result.catalog)).toEqual(['Språk','Språk/Lyssna'])
  expect(result.catalog['Svenska'].deleted).toBe(true)
})
test('folder operations reject collisions, cycles, invalid names, nonempty deletion and shared content',()=>{
  const catalog={A:{updatedAt:1},'A/B':{updatedAt:1},C:{updatedAt:1}}
  expect(()=>folderChange({},catalog,{from:'A',name:'A',parent:'A/B'})).toThrow(/itself/)
  expect(()=>folderChange({},catalog,{name:'C'})).toThrow(/already exists/)
  expect(()=>folderChange({},catalog,{name:'../new'})).toThrow(/folder name/)
  expect(()=>folderChange({},catalog,{from:'A',remove:true})).toThrow(/subfolders/)
  expect(()=>folderChange({P:{folder:'C',items:{}}},catalog,{from:'C',remove:true})).toThrow(/Move playlists/)
  expect(()=>folderChange({P:{folder:'C',readOnly:true}},catalog,{from:'C',name:'Changed'})).toThrow(/shared/)
  expect(folderChange({},catalog,{from:'C',remove:true},10).catalog.C).toEqual({updatedAt:10,deleted:true})
})
test('catalog merges retain concurrent additions and deletion tombstones across reloads and devices',()=>{
  const a={A:{updatedAt:1,deleted:false},Gone:{updatedAt:5,deleted:true}}
  const b={B:{updatedAt:2,deleted:false},Gone:{updatedAt:2,deleted:false}}
  expect(folderPaths({},mergeFolderCatalog(a,b))).toEqual(['A','B'])
  expect(mergeFolderCatalog(a,b)).toEqual(mergeFolderCatalog(b,a))
  expect(mergeFolderCatalog({A:{updatedAt:2,deleted:false}},{A:{updatedAt:2,deleted:true}}).A.deleted).toBe(true)
  expect(folderPaths({},mergeFolderCatalog(JSON.parse(JSON.stringify(mergeFolderCatalog(a,b)))))).toEqual(['A','B'])
})
test('folder metadata merges with card edits and filters match literal names, folder paths and types',()=>{
  const base={items:{Manual:{Card:[{id:'a',source:'old'}]}},folder:'Old'}
  const local={...base,folder:'New',updatedAt:5}
  const remote={...base,items:{Manual:{Card:[{id:'a',source:'changed'}]}},updatedAt:4}
  const result=mergePlaylist3(base,local,remote)
  expect(result.collisions).toEqual([])
  expect(result.playlist.folder).toBe('New')
  expect(result.playlist.items.Manual.Card[0].source).toBe('changed')
  const playlist={folder:'Svenska/Hörförståelse',readOnly:true}
  expect(playlistMatches('Sånger [1]',playlist,{query:'sanger horforstaelse',type:'shared'})).toBe(true)
  expect(playlistMatches('Sånger [1]',playlist,{query:'[1]'})).toBe(true)
  expect(playlistMatches('Sånger [1]',playlist,{folder:'Svenska'})).toBe(false)
  expect(playlistMatches('Sånger [1]',playlist,{folder:'Svenska',query:'sanger'})).toBe(true)
  expect(playlistMatches('Sånger [1]',playlist,{type:'own'})).toBe(false)
})
