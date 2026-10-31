// Folder paths are metadata, independent of playlist names and card identity.
export function folderPath(value) {
  if (typeof value !== 'string' || !value) return ''
  const parts = value.normalize('NFC').split('/').map(s => s.trim())
  return parts.every(s => s && s !== '.' && s !== '..' && !/[\\\x00-\x1f]/.test(s)) ? parts.join('/') : ''
}
export function folderName(value) {
  const name = String(value || '').normalize('NFC').trim()
  if (!name || name.includes('/') || folderPath(name) !== name) throw new Error('Enter a folder name without slashes, or “.” and “..”.')
  return name
}
export const inFolder = (path, parent) => path === parent || path.startsWith(parent + '/')
export const parentFolder = path => path.split('/').slice(0, -1).join('/')
export function mergeFolderCatalog(...catalogs) {
  const out = Object.create(null)
  for (const catalog of catalogs) for (const [raw, entry] of Object.entries(catalog || {})) {
    const path = folderPath(raw)
    if (!path || !entry || !Number.isFinite(entry.updatedAt)) continue
    const next = {updatedAt:entry.updatedAt, deleted:!!entry.deleted}, old = out[path]
    if (!old || next.updatedAt > old.updatedAt || (next.updatedAt === old.updatedAt && next.deleted)) out[path] = next
  }
  return out
}
export function folderPaths(playlists, catalog = {}) {
  const paths = new Set()
  const add = raw => {
    const path = folderPath(raw)
    if (!path) return
    const pieces = path.split('/')
    for (let i=1;i<=pieces.length;i++) paths.add(pieces.slice(0,i).join('/'))
  }
  for (const [path, entry] of Object.entries(catalog)) if (!entry.deleted) add(path)
  for (const playlist of Object.values(playlists || {})) add(playlist?.folder)
  return [...paths].sort((a,b)=>a.localeCompare(b))
}
export function folderChange(playlists, catalog, {from = null, name, parent = '', remove = false}, now = Date.now()) {
  const paths = folderPaths(playlists, catalog)
  if (remove && !from) throw new Error('Choose a folder to delete.')
  if (parent && !paths.includes(parent)) throw new Error('Choose an existing parent folder.')
  if (from && !paths.includes(from)) throw new Error('This folder no longer exists.')
  if (from && (parent === from || inFolder(parent, from))) throw new Error('A folder cannot be moved into itself or one of its subfolders.')
  const target = remove ? '' : [parent, folderName(name)].filter(Boolean).join('/')
  if (!remove && target !== from && paths.includes(target)) throw new Error('A folder with that name already exists here.')
  const affected = from ? Object.entries(playlists).filter(([,p]) => inFolder(folderPath(p?.folder), from)) : []
  if (remove && (affected.length || paths.some(p => p !== from && inFolder(p, from)))) throw new Error('Move playlists and subfolders out before deleting this folder.')
  if (!remove && affected.some(([,p])=>p.readOnly || p.external)) throw new Error('This folder contains shared or app-owned playlists and cannot be changed here.')
  const timestamp = Math.max(now, ...Object.values(catalog).map(e=>(e.updatedAt || 0)+1))
  const next = mergeFolderCatalog(catalog), collection = {...playlists}
  const changed = from ? paths.filter(p=>inFolder(p,from)) : ['']
  for (const old of changed) {
    if (old && old !== target) next[old] = {updatedAt:timestamp,deleted:true}
    if (!remove) next[target + (from ? old.slice(from.length) : '')] = {updatedAt:timestamp,deleted:false}
  }
  if (!remove && from && target !== from) for (const [key,p] of affected) collection[key] = {...p,folder:target + folderPath(p.folder).slice(from.length),updatedAt:timestamp}
  return {playlists:collection,catalog:next,path:remove ? parentFolder(from) : target}
}
const folded = text => String(text || '').normalize('NFD').replace(/\p{M}/gu,'').toLocaleLowerCase()
export function playlistMatches(name, playlist, {folder = null, query = '', type = 'all'} = {}) {
  const path = folderPath(playlist.folder)
  const recursive = !!query.trim() || type !== 'all'
  if (folder !== null && path !== folder && !(recursive && folder && inFolder(path,folder))) return false
  if (type === 'own' && (playlist.readOnly || playlist.external)) return false
  if (type === 'shared' && !playlist.readOnly) return false
  if (type === 'app' && !playlist.external) return false
  if (type === 'virtual' && !playlist.virtual) return false
  const haystack = folded(name + ' ' + path)
  return folded(query).trim().split(/\s+/).every(word=>haystack.includes(word))
}
