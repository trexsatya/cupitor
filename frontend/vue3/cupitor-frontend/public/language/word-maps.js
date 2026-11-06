import { createWordMapIndex } from './word-map-library.js'
import { folderPath, folderPaths, inFolder } from './playlist-folders.js'
import { findWordMaps } from './word-map-search.js'
import { parseWordMaps } from './word-maps-sync.js'
import {
  emptyMap,
  readMap,
  newId,
  RELATIONS,
  removeNode,
  edgeEnds,
  parseImageLinks,
  MAX_IMAGES,
  normalizeNodeColor,
  NODE_SHAPES,
  nodeWidth,
  nodePolygon,
} from './word-map-model.js'
const el = (tag, text, cls) => {
  const e = document.createElement(tag)
  if (text != null) e.textContent = text
  if (cls) e.className = cls
  return e
}
const svgEl = (tag, attrs = {}, text) => {
  const e = document.createElementNS('http://www.w3.org/2000/svg', tag)
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, v)
  if (text != null) e.textContent = text
  return e
}
const LINE_STYLES = [
  ['solid', 'Solid', null],
  ['dashed', 'Dashed', '9 7'],
  ['dotted', 'Dotted', '0.1 7'],
  ['dash-dot', 'Dash-dot', '14 6 0.1 6'],
]
// Older maps only have `dashed` / `uncertain`; derive a style from them.
const edgeStyle = (edge) =>
  edge.lineStyle && LINE_STYLES.some(([v]) => v === edge.lineStyle)
    ? edge.lineStyle
    : edge.dashed || edge.uncertain
      ? 'dashed'
      : 'solid'
const EDIT_HINT =
  'Press N to add a word, or double-click empty canvas to add one at that spot. Select a word, then press C to connect it, or F2 / double-click to rename it. Delete/Backspace removes the selection; Ctrl/⌘+C and Ctrl/⌘+V copy/paste words. Drag words to move them; drag empty space or Shift-click to select a group.'
const READ_HINT =
  'Read mode: select a word or connection to see its details. Double-click a word to search subtitles. Switch to edit mode to change the map.'
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
// For webviews that cannot download or pick files (for example Flutter on macOS).
// postMessage(text) must deliver the text to the host app. The host receives
//   {"id":1,"type":"export","name":"map.json","text":"…"}  or  {"id":2,"type":"import"}
// and answers by running  wordMapsHostReply(id, textOrNull)  in the page.
export function hostBridge(postMessage) {
  const pending = new Map()
  let seq = 0
  window.wordMapsHostReply = (id, value) => {
    pending.get(id)?.(value)
    pending.delete(id)
  }
  const ask = (message) =>
    new Promise((resolve) => {
      const id = ++seq
      pending.set(id, resolve)
      postMessage(JSON.stringify({ ...message, id }))
    })
  return {
    onExport: (name, text) => ask({ type: 'export', name, text }),
    onImport: () => ask({ type: 'import' }),
  }
}
export function openWordMaps({ storage = localStorage, storageKey, onLookup, vocabulary = [], onExport, onImport, sync, focus }) {
  const existing = document.querySelector('#wordMapsDialog')
  if (existing) {
    if (existing.dataset.scope === storageKey) {
      existing.dispatchEvent(focus
        ? new window.CustomEvent('wordmapsfocus', { detail: focus })
        : new window.Event('wordmapsrestore'))
      return
    }
    existing.close()
    existing.remove()
    document.querySelector('#wordMapsRestore')?.remove()
  }
  const dialog = el('dialog', null, 'word-maps')
  dialog.id = 'wordMapsDialog'
  dialog.dataset.scope = storageKey
  dialog.setAttribute('aria-label', 'Word maps')
  let maps = [],
    map = null,
    selection = null,
    connecting = null,
    history = [],
    redoHistory = [],
    zoom = 1,
    drag = null,
    group = new Set(),
    marquee = null,
    mode = 'edit',
    inline = null,
    lastTap = null,
    transientId = null,
    syncing = false,
    minimized = false
  let searchFocus = null, searchNodes = new Set()
  let lastDetailsKey = ''
  const editing = () => mode === 'edit'
  const editOnly = []
  const status = el('span', '', 'wm-status')
  status.setAttribute('role', 'status')
  let storageBroken = false
  try {
    const raw = storage.getItem(storageKey)
    if (raw) {
      maps = storage.readMaps ? storage.readMaps(storageKey).map(readMap) : parseWordMaps(raw)
    }
  } catch (_) {
    storageBroken = true
    status.textContent =
      'Saved maps could not be read. Export or recover the stored data before saving new maps.'
  }
  let mapIndex = createWordMapIndex(maps)
  let indexedIds = new Set(maps.map(item => item.id))
  function updateMapIndex(all = false) {
    const nextIds = new Set(maps.map(item => item.id))
    for (const id of indexedIds) if (!nextIds.has(id)) mapIndex.remove(id)
    for (const item of maps) if (all || item.id === map.id || !indexedIds.has(item.id)) mapIndex.update(item)
    indexedIds = nextIds
  }
  const header = el('header'),
    title = el('h2', 'Word maps'),
    close = button('Close', () => dialog.close())
  const fullscreenButton = button('', toggleFullscreen)
  const fullscreenIcon = svgEl('path', { d: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5' })
  const fullscreenSvg = svgEl('svg', { width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 2, 'aria-hidden': 'true' })
  fullscreenSvg.append(fullscreenIcon)
  fullscreenButton.append(fullscreenSvg)
  fullscreenButton.className = 'wm-fullscreen-toggle'
  fullscreenButton.setAttribute('aria-label', 'Enter fullscreen')
  fullscreenButton.setAttribute('aria-pressed', 'false')
  fullscreenButton.title = 'Enter fullscreen'
  iconButton(close, 'M6 6l12 12M6 18L18 6')
  header.append(title, close)
  const syncButton = button('Sync', () => runSync(false))
  syncButton.className = 'wm-sync'
  const toolbar = el('div', null, 'wm-toolbar wm-main-toolbar'),
    picker = el('select'),
    modeGroup = el('label', null, 'wm-mode-toggle'),
    modeToggle = el('input')
  modeToggle.type = 'checkbox'
  modeToggle.setAttribute('role', 'switch')
  modeToggle.setAttribute('aria-label', 'Edit mode')
  modeToggle.onchange = () => setMode(modeToggle.checked ? 'edit' : 'read')
  modeGroup.append(el('span', 'Read'), modeToggle, el('span', 'Edit'))
  const restoreButton = button('Restore Word map', restoreMap)
  restoreButton.id = 'wordMapsRestore'
  restoreButton.className = 'wm-restore'
  restoreButton.setAttribute('aria-label', 'Restore Word map')
  picker.setAttribute('aria-label', 'Saved word map')
  const name = el('input')
  name.setAttribute('aria-label', 'Map name')
  name.maxLength = 200
  name.className = 'wm-map-name'
  let folderScope = null
  const library = el('section', null, 'wm-library')
  library.id = 'wordMapLibrary'
  library.tabIndex = -1
  library.hidden = true
  library.setAttribute('aria-label', 'Map library')
  const browseButton = iconButton(button('Browse maps', () => setLibrary(library.hidden)), 'M3 7h7l2-3h9v16H3z')
  browseButton.classList.add('wm-browse')
  browseButton.setAttribute('aria-controls', library.id)
  browseButton.setAttribute('aria-expanded', 'false')
  const libraryHeading = el('div', null, 'wm-library-heading')
  const libraryClose = iconButton(button('Close browser', () => setLibrary(false)), 'M6 6l12 12M6 18L18 6')
  libraryHeading.append(el('h3', 'Your maps'), libraryClose)
  const librarySearch = el('input')
  librarySearch.type = 'search'
  librarySearch.placeholder = 'Filter maps…'
  librarySearch.setAttribute('aria-label', 'Filter maps')
  const folderTree = el('nav', null, 'wm-folder-tree')
  folderTree.setAttribute('aria-label', 'Map folders')
  const mapList = el('div', null, 'wm-map-list')
  const folderForm = el('form', null, 'wm-folder-form')
  const folderLabel = el('label', 'Folder for this map'), folderInput = el('input')
  folderInput.setAttribute('aria-label', 'Map folder path')
  folderInput.placeholder = 'e.g. Swedish/People'
  folderInput.maxLength = 200
  folderInput.setAttribute('list', 'wordMapFolderPaths')
  const folderOptions = el('datalist'); folderOptions.id = 'wordMapFolderPaths'
  folderLabel.append(folderInput)
  const moveMap = button('Move map', () => {})
  moveMap.type = 'submit'
  folderForm.append(folderLabel, moveMap, el('small', 'Use / for subfolders. Leave blank for Unfiled. Folders appear when they contain maps.'), folderOptions)
  folderForm.onsubmit = event => {
    event.preventDefault()
    const raw = folderInput.value.trim(), path = folderPath(raw)
    if (raw && (!path || path.length > 200)) { status.textContent = 'Enter a valid folder path, such as Swedish/People.'; return }
    commit(() => { if (path) map.folder = path; else delete map.folder })
    folderScope = path
    renderLibrary()
  }
  librarySearch.oninput = () => { libraryPage = 0; renderLibrary() }
  library.append(libraryHeading, librarySearch, folderTree, mapList, folderForm)
  const layout = el('div', null, 'wm-layout'),
    work = el('div', null, 'wm-work'),
    viewport = el('div', null, 'wm-viewport'),
    inspector = el('aside', null, 'wm-inspector')
  inspector.setAttribute('aria-label', 'Word or connection details')
  inspector.id = 'wordMapDetails'
  const detailsButton = button('Details', () => setInspector(!inspector.classList.contains('wm-inspector-open')))
  detailsButton.className = 'wm-details-toggle'
  detailsButton.setAttribute('aria-controls', inspector.id)
  detailsButton.setAttribute('aria-expanded', 'false')
  const canvas = svgEl('svg', {
    viewBox: '0 0 2400 1600',
    role: 'group',
    'aria-label': 'Word map canvas',
    tabindex: '0',
  })
  viewport.append(canvas)
  const hint = el(
    'p',
    EDIT_HINT,
    'wm-hint'
  )
  const script = el('textarea')
  script.hidden = true
  script.className = 'wm-script'
  script.setAttribute('aria-label', 'Word map JSON')
  script.spellcheck = false
  const scriptTools = el('div', null, 'wm-toolbar')
  scriptTools.hidden = true
  scriptTools.append(
    button('Apply JSON', () => {
      try {
        const imported = readMap(script.value)
        commit(() => {
          Object.assign(map, imported, { id: map.id })
        })
        script.hidden = true
        scriptTools.hidden = true
        viewport.hidden = false
      } catch (e) {
        status.textContent = e.message
      }
    }),
    button('Import as new map', () => {
      try {
        importText(script.value)
        script.hidden = true
        scriptTools.hidden = true
        viewport.hidden = false
      } catch (e) {
        status.textContent = e.message
      }
    }),
    button('Cancel', () => {
      script.hidden = true
      scriptTools.hidden = true
      viewport.hidden = false
    })
  )
  work.append(hint, viewport, script, scriptTools)
  layout.append(library, work, detailsButton, inspector)
  const file = el('input')
  file.type = 'file'
  file.accept = '.json,application/json'
  file.hidden = true
  file.onchange = async () => {
    try {
      if (!file.files[0]) return
      if (file.files[0].size > 2000000) throw Error('Please select a JSON file smaller than 2 MB.')
      importText(await file.files[0].text())
    } catch (e) {
      status.textContent = e.message
    } finally {
      file.value = ''
    }
  }
  const addWordButton = iconButton(editBtn('+ Word', addWord, 'New word (N)'), 'M12 5v14M5 12h14')
  const undo = editBtn('Undo', undoLast)
  const redo = editBtn('Redo', redoLast)
  const zoomControls = el('div', null, 'wm-zoom-controls')
  zoomControls.setAttribute('role', 'group')
  zoomControls.setAttribute('aria-label', 'Canvas controls')
  const zoomLevel = el('output', '', 'wm-zoom-level')
  zoomLevel.setAttribute('aria-label', 'Zoom level')
  const fitButton = iconButton(button('Fit map', fitMap), 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5M8 8h8v8H8z')
  const zoomOut = button('−', () => scale(-0.2)), zoomIn = button('+', () => scale(0.2))
  zoomOut.setAttribute('aria-label', 'Zoom out'); zoomOut.title = 'Zoom out'
  zoomIn.setAttribute('aria-label', 'Zoom in'); zoomIn.title = 'Zoom in'
  zoomControls.append(fitButton, zoomOut, zoomLevel, zoomIn, fullscreenButton)
  work.append(zoomControls)
  toolbar.append(
    picker,
    name,
    modeGroup,
    syncButton,
    editBtn('New map', () => {
      const m = emptyMap()
      const folder = folderScope ?? map.folder
      if (folder) m.folder = folder
      maps = savedMaps()
      transientId = null
      maps.push(m)
      activate(m)
      save()
    }),
    addWordButton,
    undo,
    redo,
    editBtn('Arrange', () =>
      commit(() =>
        map.nodes.forEach((n, i) => {
          n.x = 180 + (i % 5) * 420
          n.y = 120 + Math.floor(i / 5) * 140
        })
      )
    ),
    editBtn('JSON', () => {
      script.value = JSON.stringify(map, null, 2)
      script.hidden = false
      scriptTools.hidden = false
      viewport.hidden = true
    }),
    editBtn('Import', async () => {
      if (!onImport) return file.click()
      try {
        const text = await onImport()
        if (typeof text === 'string') importText(text)
      } catch (e) {
        status.textContent = 'Import failed: ' + e.message
      }
    }),
    button('Export', async () => {
      const text = JSON.stringify(map, null, 2),
        filename = (map.name.replace(/[\\/:*?"<>|]+/g, '-').trim() || 'word-map') + '.json'
      try {
        if (onExport) await onExport(filename, text)
        else download(text, filename, 'application/json')
      } catch (e) {
        status.textContent = 'Export failed: ' + e.message + ' Try Copy JSON instead.'
      }
    }),
    button('Copy JSON', async () => {
      status.textContent = (await copyText(JSON.stringify(map, null, 2)))
        ? 'Map JSON copied. Paste it into a file, or into JSON → Import as new map.'
        : 'Could not copy. Use JSON, then select all and copy.'
    }),
    editBtn('Delete map', () => {
      if (confirm('Delete “' + map.name + '”?')) {
        mapIndex.remove(map.id)
        indexedIds.delete(map.id)
        maps = maps.filter((m) => m !== map)
        activate(maps[0] || null)
        save(false)
      }
    })
  )
  const moreActions = el('div', null, 'wm-more-actions')
  moreActions.id = 'wordMapMoreActions'
  moreActions.setAttribute('role', 'group')
  moreActions.setAttribute('aria-label', 'Map actions')
  const moreButton = iconButton(button('More', () => setMore(!moreActions.classList.contains('is-open'))), 'M5 12h.01M12 12h.01M19 12h.01')
  moreButton.classList.add('wm-more-toggle')
  moreButton.setAttribute('aria-label', 'More map actions')
  moreButton.setAttribute('aria-expanded', 'false')
  moreButton.setAttribute('aria-controls', moreActions.id)
  const primary = new Set([picker, modeGroup, syncButton, addWordButton, zoomControls])
  for (const control of [...toolbar.children]) if (!primary.has(control)) moreActions.append(control)
  toolbar.prepend(browseButton)
  toolbar.append(moreButton, moreActions)
  const footer = el('footer')
  footer.append(el('small', sync
    ? 'Saved locally · Sync to GitHub to use your maps on other devices.'
    : 'Saved locally · Sign in and set up your repository to sync with GitHub.'), status)
  dialog.append(header, toolbar, layout, footer, file)
  document.body.append(dialog)
  dialog.addEventListener('click', e => {
    if (moreButton.contains(e.target)) return
    if (!moreActions.contains(e.target) || e.target.closest('button')) setMore(false)
  })
  function setLibrary(open) {
    library.hidden = !open
    browseButton.setAttribute('aria-expanded', String(open))
    if (open) { renderLibrary(); (window.innerWidth <= 700 ? library : librarySearch).focus() }
  }
  const LIBRARY_PAGE_SIZE = 100
  let libraryPage = 0, folderPage = 0
  function renderLibrary() {
    if (!map) return
    const paths = folderPaths(maps)
    const counts = new Map([['',0]])
    for (const item of maps) {
      const path = item.folder || ''
      if (!path) counts.set('',counts.get('')+1)
      else {
        const parts=path.split('/')
        for(let i=1;i<=parts.length;i++) {
          const parent=parts.slice(0,i).join('/')
          counts.set(parent,(counts.get(parent)||0)+1)
        }
      }
    }
    if (folderScope && !paths.includes(folderScope)) folderScope = null
    folderTree.replaceChildren()
    const folderButton = (label, path, depth = 0) => {
      const count = path === null ? maps.length : counts.get(path) || 0
      const b = button(label + ' · ' + count, () => {
        folderScope = path
        libraryPage = 0
        renderLibrary()
        folderTree.querySelector('[aria-pressed="true"]')?.focus()
      })
      if (path) iconButton(b, 'M3 7h7l2-3h9v16H3z')
      b.dataset.folder = path ?? '*'
      b.style.paddingLeft = 10 + depth * 14 + 'px'
      b.setAttribute('aria-pressed', String(folderScope === path))
      folderTree.append(b)
    }
    folderButton('All maps', null)
    folderButton('Unfiled', '')
    folderPage=Math.min(folderPage,Math.max(0,Math.ceil(paths.length/LIBRARY_PAGE_SIZE)-1))
    for (const path of paths.slice(folderPage*LIBRARY_PAGE_SIZE,(folderPage+1)*LIBRARY_PAGE_SIZE))
      folderButton(path.split('/').at(-1), path, path.split('/').length - 1)
    appendPages(folderTree,paths.length,folderPage,'folders',next=>{folderPage=next;renderLibrary()})
    folderTree.querySelector('[aria-pressed="true"]')?.scrollIntoView?.({block: 'nearest'})
    const query = librarySearch.value.trim().toLocaleLowerCase()
    const shown = maps.filter(m => (folderScope === null || (folderScope ? inFolder(m.folder || '', folderScope) : !m.folder)) &&
      (m.name + ' ' + (m.folder || '')).toLocaleLowerCase().includes(query))
    mapList.replaceChildren(el('p', shown.length + ' map' + (shown.length === 1 ? '' : 's'), 'wm-list-count'))
    libraryPage=Math.min(libraryPage,Math.max(0,Math.ceil(shown.length/LIBRARY_PAGE_SIZE)-1))
    for (const item of shown.slice(libraryPage*LIBRARY_PAGE_SIZE,(libraryPage+1)*LIBRARY_PAGE_SIZE)) {
      const b = button('', () => {
        if (inline) finishInline(true)
        activate(item); fitMap()
        if (window.innerWidth <= 700) setLibrary(false)
      })
      b.className = 'wm-library-map'
      b.dataset.mapId = item.id
      b.setAttribute('aria-current', item.id === map.id ? 'true' : 'false')
      b.append(el('strong', item.name), el('small', item.folder || 'Unfiled'))
      mapList.append(b)
    }
    appendPages(mapList,shown.length,libraryPage,'maps',next=>{libraryPage=next;renderLibrary()})
    if (!shown.length) mapList.append(el('p', 'No maps in this view.', 'wm-list-empty'))
    folderOptions.replaceChildren(...paths.slice(0,200).map(path => new Option(path)))
    if (document.activeElement !== folderInput) folderInput.value = map.folder || ''
    folderForm.hidden = !editing()
  }
  function appendPages(parent,count,page,label,change) {
    if(count<=LIBRARY_PAGE_SIZE)return
    const previous=button('Previous '+label,()=>change(page-1)),next=button('Next '+label,()=>change(page+1))
    previous.disabled=page===0;next.disabled=(page+1)*LIBRARY_PAGE_SIZE>=count
    parent.append(previous,el('span',`${page+1} / ${Math.ceil(count/LIBRARY_PAGE_SIZE)}`),next)
  }
  function setMore(open) {
    moreActions.classList.toggle('is-open', open)
    moreButton.setAttribute('aria-expanded', String(open))
  }
  function setInspector(open) {
    inspector.classList.toggle('wm-inspector-open', open)
    detailsButton.textContent = open ? 'Hide details' : 'Details'
    detailsButton.setAttribute('aria-expanded', String(open))
  }
  picker.onchange = () => activate(maps.find((m) => m.id === picker.value))
  name.onchange = () => {
    if (!name.value.trim()) {
      name.value = map.name
      return
    }
    commit(() => (map.name = name.value.trim()))
  }
  dialog.addEventListener('keydown', (e) => {
    e.stopPropagation()
    if (e.defaultPrevented) return
    if (e.key === 'Escape' && !library.hidden) {
      e.preventDefault(); setLibrary(false); browseButton.focus(); return
    }
    if (e.key === 'Escape' && moreActions.classList.contains('is-open')) {
      e.preventDefault()
      setMore(false)
      moreButton.focus()
      return
    }
    if (e.key === 'Escape' && dialog.classList.contains('wm-fullscreen') && document.fullscreenElement !== dialog) {
      e.preventDefault()
      leaveFullscreen()
      return
    }
    if (e.key === 'Escape' && connecting) {
      e.preventDefault()
      cancelConnecting()
      return
    }
    if (e.target.closest?.('input,textarea,select,[contenteditable="true"]')) return
    const mod = e.ctrlKey || e.metaKey
    if (editing() && !e.repeat && mod && !e.altKey && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redoLast() : undoLast(); return }
    if (editing() && !e.repeat && mod && !e.altKey && e.key.toLowerCase() === 'y') { e.preventDefault(); redoLast(); return }
    if (editing() && !e.repeat && mod && !e.altKey && e.key.toLowerCase() === 'c') { if (copySelection()) e.preventDefault(); return }
    if (editing() && !e.repeat && mod && !e.altKey && e.key.toLowerCase() === 'v') { if (pasteSelection()) e.preventDefault(); return }
    if (editing() && !e.repeat && !mod && !e.altKey && ['Delete', 'Backspace'].includes(e.key)) { if (deleteSelection()) e.preventDefault(); return }
    if (!editing() || e.repeat || mod || e.altKey) return
    const key = e.key.toLowerCase(),
      single = selection?.kind === 'node' ? selection.id : null
    if (key === 'n') {
      e.preventDefault()
      addWord()
    } else if (key === 'c') {
      e.preventDefault()
      if (connecting) cancelConnecting()
      else if (single) startConnecting(single)
      else hint.textContent = 'Select a word first, then press C to connect it.'
    } else if ((key === 'e' || key === 'f2') && single) {
      e.preventDefault()
      startInline(single)
    }
  })
  dialog.addEventListener('cancel', (e) => {
    if (inline || connecting) e.preventDefault()
    // After restore the browser can deliver Escape as a dialog cancel
    // without a keydown inside it (focus was on the removed restore pill).
    if (dialog.classList.contains('wm-fullscreen') && document.fullscreenElement !== dialog) {
      e.preventDefault()
      leaveFullscreen()
    }
  })
  dialog.addEventListener('wordmapsrestore', restoreMap)
  dialog.addEventListener('wordmapsfocus', event => {
    // This is a new search target, not a request to return to the old viewport.
    restoreMap({ preserveViewport: false })
    revealSearchResult(event.detail)
  })
  dialog.addEventListener('close', () => {
    // Native close events are queued; a quick restore may already be open.
    if (dialog.open || minimized) return
    if (inline) finishInline(true)
    leaveFullscreen()
    restoreButton.remove()
    dialog.remove()
  })
  let parkedViewport = null, restoringViewport = false
  function minimizeMap() {
    parkedViewport = { zoom, left: viewport.scrollLeft, top: viewport.scrollTop }
    restoringViewport = true
    restoreFullscreen = dialog.classList.contains('wm-fullscreen')
    leaveFullscreen()
    if (inline) finishInline(true)
    minimized = true
    restoreButton.textContent = '↗ Word map: ' + map.name
    restoreButton.title = 'Restore ' + map.name
    document.body.append(restoreButton)
    dialog.close()
  }
  function restoreMap({ preserveViewport = true } = {}) {
    const wasMinimized = minimized
    const expand = wasMinimized && restoreFullscreen
    minimized = false
    restoreButton.remove()
    if (!dialog.open) dialog.showModal()
    if (!wasMinimized) return
    if (expand) enterFullscreen()

    if (!preserveViewport) {
      // A lookup may open a different map. Never reapply the parked map's
      // scroll/zoom over revealSearchResult's new selection and centering.
      parkedViewport = null
      setTimeout(() => { restoringViewport = false }, 150)
      return
    }

    // Fullscreen changes layout asynchronously; wait until the modal's final
    // dimensions are available before restoring scale and scroll position.
    // jsdom and older hosts need a timeout fallback for requestAnimationFrame.
    const frame = typeof window.requestAnimationFrame === 'function'
      ? callback => window.requestAnimationFrame(callback)
      : callback => setTimeout(callback, 0)
    const savedViewport = parkedViewport
    frame(() => frame(() => {
      if (savedViewport && dialog.open && !minimized) {
        zoom = savedViewport.zoom
        scale(0)
        viewport.scrollTo(savedViewport.left, savedViewport.top)
      }
      setTimeout(() => { restoringViewport = false }, 150)
    }))
  }
  let nativeFullscreen = false, restoreFullscreen = false
  function setExpanded(on) {
    if (on) { setLibrary(false); setMore(false) }
    dialog.classList.toggle('wm-fullscreen', on)
    fullscreenIcon.setAttribute('d', on ? 'M3 8h5V3m8 0v5h5M8 21v-5H3m18 0h-5v5' : 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5')
    fullscreenButton.setAttribute('aria-pressed', String(on))
    fullscreenButton.setAttribute('aria-label', on ? 'Exit fullscreen' : 'Enter fullscreen')
    fullscreenButton.title = on ? 'Exit fullscreen' : 'Enter fullscreen'
    setTimeout(() => {
      if (!dialog.open) return
      if (restoringViewport || minimized) return
      if (searchFocus) centerSearchMatch()
      else fitMap()
    }, 0)
  }
  function leaveFullscreen() {
    setExpanded(false)
    if (document.fullscreenElement === dialog) document.exitFullscreen?.()?.catch?.(() => {})
  }
  function toggleFullscreen() {
    if (dialog.classList.contains('wm-fullscreen')) return leaveFullscreen()
    return enterFullscreen()
  }
  async function enterFullscreen() {
    // Fill the WebView even where the Fullscreen API is unavailable or
    // refused. On supported browsers/the Mac host, also enter native fullscreen.
    setExpanded(true)
    try {
      await dialog.requestFullscreen?.()
      if (!dialog.open) leaveFullscreen()
    } catch (_) { /* expanded WebView remains usable */ }
  }
  dialog.addEventListener('fullscreenchange', () => {
    const on = document.fullscreenElement === dialog
    if (on || nativeFullscreen) setExpanded(on)
    nativeFullscreen = on
  })
  function centerSearchMatch() {
    const node = map.nodes.find(node => node.id === selection?.id)
    if (!node) return fitMap()
    if (!viewport.clientWidth || !viewport.clientHeight) return
    zoom = Math.min(1, (viewport.clientWidth - 32) / (nodeWidth(node) + 32))
    scale(0)
    viewport.scrollTo(Math.max(0, node.x * zoom - viewport.clientWidth / 2),
      Math.max(0, node.y * zoom - viewport.clientHeight / 2))
  }
  function revealSearchResult(target) {
    const found = maps.find(map => map.id === target?.mapId)
    if (!found) {
      status.textContent = 'This map is no longer available.'
      return
    }
    if (inline) finishInline(true)
    activate(found)
    // Recompute against live data: a sync may have changed the map while a
    // result was open. A saved hit must never recolor or modify the map.
    const hit = findWordMaps([found], target.query)[0]
    searchNodes = new Set((hit?.nodes || []).map(node => node.id))
    searchFocus = target
    const id = searchNodes.has(target.nodeId) ? target.nodeId : [...searchNodes][0]
    selection = id ? { kind: 'node', id } : null
    name.classList.toggle('wm-search-title', !!hit?.nameMatched)
    picker.classList.toggle('wm-search-title', !!hit?.nameMatched)
    setMode('read')
    const count = searchNodes.size
    hint.textContent = count ? `${count} matching word${count === 1 ? '' : 's'} highlighted for “${target.query}”.` : READ_HINT
    centerSearchMatch()
    nodeEl(id)?.focus?.({ preventScroll: true })
  }
  function iconButton(b, path) {
    const label = b.textContent
    b.replaceChildren()
    const icon = svgEl('svg', { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })
    icon.append(svgEl('path', { d: path }))
    b.append(icon, el('span', label, 'wm-button-label'))
    b.classList.add('wm-icon-button')
    b.setAttribute('aria-label', label)
    b.title = label
    return b
  }
  function button(text, fn) {
    const b = el('button', text)
    b.type = 'button'
    b.onclick = fn
    return b
  }
  function editBtn(text, fn, title) {
    const b = button(text, fn)
    if (title) b.title = title
    editOnly.push(b)
    return b
  }
  function setMode(next) {
    if (inline) finishInline(true)
    mode = next
    connecting = null
    drag = null
    marquee = null
    if (!editing()) group.clear()
    script.hidden = true
    scriptTools.hidden = true
    viewport.hidden = false
    for (const b of editOnly) b.hidden = !editing()
    name.readOnly = !editing()
    modeToggle.checked = editing()
    folderForm.hidden = !editing()
    hint.textContent = editing() ? EDIT_HINT : READ_HINT
    draw()
    details()
  }
  const nodeEl = (id) => [...canvas.querySelectorAll('[data-node]')].find((g) => g.getAttribute('data-node') === id)
  const edgeEl = (id) => [...canvas.querySelectorAll('[data-edge]')].find((g) => g.getAttribute('data-edge') === id)
  function undoLast() {
    if (!history.length) return
    redoHistory.push(JSON.stringify(map))
    Object.assign(map, JSON.parse(history.pop()))
    selection = null
    group.clear()
    save()
    draw()
    details()
  }
  function redoLast() {
    if (!redoHistory.length) return
    history.push(JSON.stringify(map))
    Object.assign(map, JSON.parse(redoHistory.pop()))
    selection = null
    group.clear()
    save()
    draw()
    details()
  }
  function selectedNodeIds() {
    return group.size ? [...group] : selection?.kind === 'node' ? [selection.id] : []
  }
  function deleteSelection() {
    if (group.size) { const ids = [...group]; commit(() => { ids.forEach(id => removeNode(map, id)); group.clear(); selection = null }); return true }
    if (selection?.kind === 'node') { const id = selection.id; commit(() => { removeNode(map, id); selection = null }); return true }
    if (selection?.kind === 'edge') { const id = selection.id; commit(() => { map.edges = map.edges.filter(edge => edge.id !== id); selection = null }); return true }
    return false
  }
  let copiedSelection = null
  function copySelection() {
    const ids = selectedNodeIds()
    if (!ids.length) return false
    const nodes = map.nodes.filter(node => ids.includes(node.id)).map(node => ({ ...node, images: [...(node.images || [])] }))
    const edges = map.edges.filter(edge => ids.includes(edge.from) && ids.includes(edge.to)).map(edge => ({ ...edge }))
    copiedSelection = { nodes, edges }
    status.textContent = nodes.length + ' word(s) copied. Press Ctrl/⌘+V to paste.'
    return true
  }
  function pasteSelection() {
    if (!copiedSelection?.nodes?.length || copiedSelection.nodes.length + map.nodes.length > 500) return false
    const oldIds = new Set(copiedSelection.nodes.map(node => node.id))
    const idMap = new Map(copiedSelection.nodes.map(node => [node.id, newId()]))
    const minX = Math.min(...copiedSelection.nodes.map(node => node.x)), minY = Math.min(...copiedSelection.nodes.map(node => node.y))
    const dx = minX + 70 > 2210 ? -minX + 120 : 70, dy = minY + 50 > 1560 ? -minY + 80 : 50
    const nodes = copiedSelection.nodes.map(node => ({ ...node, id: idMap.get(node.id), x: clamp(node.x + dx, 190, 2210), y: clamp(node.y + dy, 40, 1560), images: [...(node.images || [])] }))
    const edges = copiedSelection.edges.filter(edge => oldIds.has(edge.from) && oldIds.has(edge.to)).map(edge => ({ ...edge, id: newId(), from: idMap.get(edge.from), to: idMap.get(edge.to) }))
    commit(() => {
      map.nodes.push(...nodes)
      map.edges.push(...edges)
      if (nodes.length === 1) { selection = { kind: 'node', id: nodes[0].id }; group.clear() }
      else { group = new Set(nodes.map(node => node.id)); selection = null }
    })
    status.textContent = nodes.length + ' word(s) pasted.'
    return true
  }
  function addWord(position) {
    if (!editing()) return
    let created
    commit(() => {
      created = {
        id: newId(),
        word: 'New word',
        x: position ? clamp(position.x, 190, 2210) : 220 + (map.nodes.length % 6) * 260,
        y: position ? clamp(position.y, 40, 1560) : 160 + Math.floor(map.nodes.length / 6) * 110,
        color: '#dc3636',
        textColor: '#ffffff',
        shape: 'rectangle',
        lookup: '',
        note: '',
        images: [],
      }
      map.nodes.push(created)
      group.clear()
      selection = { kind: 'node', id: created.id }
    })
    setInspector(false)
    startInline(created.id, true)
  }
  // Type a word straight into its box on the canvas.
  function startInline(id, isNew = false) {
    if (!editing() || !map.nodes.some((n) => n.id === id)) return
    if (inline) finishInline(true)
    if (connecting) {
      connecting = null
      hint.textContent = EDIT_HINT
    }
    group.clear()
    selection = { kind: 'node', id }
    inline = { id, isNew }
    draw()
    details()
    const input = canvas.querySelector('foreignObject input')
    input?.focus()
    input?.select()
  }
  function finishInline(keep) {
    if (!inline) return
    const { id, isNew } = inline,
      value = (canvas.querySelector('foreignObject input')?.value || '').trim(),
      n = map.nodes.find((x) => x.id === id)
    inline = null
    if (isNew && (!keep || !value)) undoLast() // drop the word that was just created
    else if (keep && n && value && value !== n.word) {
      // Not commit(): rebuilding the details panel here would swallow the click
      // that moved focus out of the box, so only its Word field is updated.
      history.push(JSON.stringify(map))
      if (history.length > 50) history.shift()
      redoHistory = []
      n.word = value
      save()
      draw()
      const field = inspector.querySelector('form input')
      if (field && selection?.id === id) field.value = value
    } else draw()
    if (document.activeElement === document.body || canvas.contains(document.activeElement))
      nodeEl(id)?.focus({ preventScroll: true })
  }
  function startConnecting(id) {
    const n = map.nodes.find((x) => x.id === id)
    if (!n || !editing()) return
    if (inline) finishInline(true)
    connecting = id
    details()
    inspector.append(button('Cancel connection', cancelConnecting))
    hint.textContent =
      'Select the destination word to connect from “' +
      n.word +
      '”, or Tab to it and press Enter. Esc cancels.'
    nodeEl(id)?.focus({ preventScroll: true })
  }
  function cancelConnecting() {
    connecting = null
    hint.textContent = 'Connection cancelled.'
    details()
  }
  function imageGallery(urls, small, label) {
    const wrap = el('div', null, 'wm-images')
    wrap.style.cssText = 'display:flex;flex-wrap:wrap;gap:8px;margin:8px 0'
    urls.forEach((url, i) => {
      const a = el('a'),
        img = el('img')
      a.href = url
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      a.style.cssText = 'display:block;max-width:100%;word-break:break-all'
      img.src = url
      img.alt = label + ' — image ' + (i + 1)
      img.loading = 'lazy'
      img.decoding = 'async'
      img.referrerPolicy = 'no-referrer'
      img.style.cssText = small
        ? 'display:block;max-height:80px;max-width:100%;border-radius:6px'
        : 'display:block;max-width:100%;height:auto;border-radius:8px'
      img.onerror = () => a.replaceChildren('Image could not be loaded: ' + url)
      a.append(img)
      wrap.append(a)
    })
    return wrap
  }
  function scale(delta) {
    const previous = zoom
    const center = { x: (viewport.scrollLeft + viewport.clientWidth / 2) / previous, y: (viewport.scrollTop + viewport.clientHeight / 2) / previous }
    zoom = Math.max(0.1, Math.min(1.8, zoom + delta))
    canvas.style.width = 2400 * zoom + 'px'
    canvas.style.height = 1600 * zoom + 'px'
    zoomLevel.textContent = Math.round(zoom * 100) + '%'
    if (delta) viewport.scrollTo(Math.max(0, center.x * zoom - viewport.clientWidth / 2), Math.max(0, center.y * zoom - viewport.clientHeight / 2))
  }
  function importText(text) {
    if (text.length > 2000000) throw Error('Please select a JSON file smaller than 2 MB.')
    const imported = readMap(text)
    imported.id = newId()
    maps = savedMaps()
    transientId = null
    maps.push(imported)
    activate(imported)
    save()
  }
  async function copyText(text) {
    try {
      await globalThis.navigator.clipboard.writeText(text)
      return true
    } catch (_) {
      // Webviews often lack the async clipboard API; fall back to selecting a temporary field.
      const t = document.createElement('textarea')
      t.value = text
      t.style.cssText = 'position:fixed;top:0;left:0;opacity:0'
      dialog.append(t)
      t.select()
      let ok = false
      try {
        ok = document.execCommand('copy')
      } catch (_) {}
      t.remove()
      return ok
    }
  }
  function fitMap() {
    if (!viewport.clientWidth || !viewport.clientHeight) return
    if (!map.nodes.length) {
      zoom = 1
      scale(0)
      viewport.scrollTo(0, 0)
      return
    }
    const left = Math.min(...map.nodes.map(n => n.x - nodeWidth(n) / 2))
    const right = Math.max(...map.nodes.map(n => n.x + nodeWidth(n) / 2))
    const top = Math.min(...map.nodes.map(n => n.y - 27))
    const bottom = Math.max(...map.nodes.map(n => n.y + 27))
    zoom = Math.max(0.1, Math.min(1.1,
      (viewport.clientWidth - 32) / (right - left),
      (viewport.clientHeight - 32) / (bottom - top)))
    scale(0)
    viewport.scrollTo(
      Math.max(0, (left + right) / 2 * zoom - viewport.clientWidth / 2),
      Math.max(0, (top + bottom) / 2 * zoom - viewport.clientHeight / 2)
    )
  }
  function download(text, filename, type) {
    const url = URL.createObjectURL(new Blob([text], { type })),
      a = el('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  const savedMaps = () => maps.filter(m => m.id !== transientId)
  function refreshSync() {
    syncButton.disabled = !sync || syncing || storageBroken || !!storage.status?.error
    syncButton.textContent = syncing ? 'Syncing…' : (sync?.dirty(savedMaps()) || storage.status?.error) ? 'Sync*' : 'Sync'
    iconButton(syncButton, 'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-2l2 2M4 17l2 2a7 7 0 0 0 12-2')
    syncButton.setAttribute('aria-label', 'Sync maps')
    syncButton.title = !sync
      ? 'Sign in and set up your repository to sync'
      : 'Load and save word maps in your GitHub repository'
  }
  async function runSync(pull) {
    if (!sync || syncing || storageBroken) return
    if (inline) finishInline(true)
    syncing = true
    refreshSync()
    status.textContent = pull ? 'Loading maps from GitHub…' : 'Syncing maps to GitHub…'
    try {
      if (storage.flush) await storage.flush()
      const getMaps = () => {
        if (!dialog.isConnected) return JSON.parse(storage.getItem(storageKey) || '[]')
        // Inline text may have changed while the network request was pending.
        if (inline) finishInline(true)
        return savedMaps()
      }
      const adopt = next => {
        storage.setItem(storageKey, JSON.stringify(next))
        if (!dialog.isConnected) return
        const currentId = map.id
        const focused = searchFocus
        maps = next
        mapIndex = createWordMapIndex(maps)
        indexedIds = new Set(maps.map(item => item.id))
        transientId = null
        activate(maps.find(m => m.id === currentId) || maps[0] || null)
        if (focused && map.id === focused.mapId) revealSearchResult(focused)
        window.dispatchEvent(new window.CustomEvent('wordmapschanged', { detail: { storageKey } }))
      }
      const result = await sync[pull ? 'pull' : 'push'](getMaps, adopt)
      if (storage.flush) await storage.flush()
      status.textContent = result.conflicts
        ? 'Loaded from GitHub. Conflicting maps kept locally; resolve them with Sync.'
        : sync.dirty(getMaps())
          ? 'Saved locally · unsynced changes'
          : 'Maps are in sync with GitHub'
    } catch (e) {
      status.textContent = e.code === 'word-maps-sync-cancelled'
        ? e.message
        : 'GitHub sync failed: ' + e.message + '. Your local changes are kept.'
    } finally {
      syncing = false
      refreshSync()
    }
  }
  function save(persistDraft = true) {
    if (storageBroken) {
      status.textContent =
        'Saving blocked: existing stored maps could not be read. Export your work to keep it.'
      return
    }
    try {
      if (persistDraft && map.id === transientId) transientId = null
      updateMapIndex()
      if (storage.saveMaps) storage.saveMaps(storageKey, savedMaps(), map.id)
      else storage.setItem(storageKey, JSON.stringify(savedMaps()))
      window.dispatchEvent(new window.CustomEvent('wordmapschanged', { detail: { storageKey } }))
      status.textContent = storage.flush ? 'Saving…' : sync ? 'Saved locally · unsynced changes' : 'Saved on this device'
      if (storage.flush) storage.flush().then(() => {
        status.textContent = sync ? 'Saved locally · unsynced changes' : 'Saved on this device'
        refreshSync()
      }, () => {
        status.textContent = 'Could not save. Export your map to keep your changes.'
        refreshSync()
      })
      refreshSync()
    } catch (_) {
      status.textContent = 'Could not save. Export your map to keep your changes.'
    }
  }
  function commit(fn) {
    if (!editing()) return
    if (inline) finishInline(true)
    history.push(JSON.stringify(map))
    if (history.length > 50) history.shift()
    redoHistory = []
    fn()
    save()
    draw()
    details()
  }
  function activate(value) {
    searchFocus = null
    searchNodes.clear()
    name.classList.remove('wm-search-title')
    picker.classList.remove('wm-search-title')
    map = value
    selection = null
    group.clear()
    marquee = null
    inline = null
    connecting = null
    history = []
    redoHistory = []
    if (!map) {
      map = emptyMap()
      maps.push(map)
      transientId = map.id
    }
    draw()
    details()
    viewport.scrollTo(0, 0)
    if (dialog.open && window.innerWidth < 700) fitMap()
  }
  function draw(diagramOnly = false) {
    if (!diagramOnly) {
    picker.replaceChildren()
    const pickerMaps = maps.length <= 200 ? maps : [map, ...maps.filter(item=>item.id!==map.id).slice(0,100)]
    for (const folder of ['', ...folderPaths(pickerMaps)]) {
      const items = pickerMaps.filter(m => (m.folder || '') === folder)
      if (!items.length) continue
      const optgroup = el('optgroup'); optgroup.label = folder || 'Unfiled'
      optgroup.append(...items.map(m => new Option(m.name, m.id)))
      picker.append(optgroup)
    }
    renderLibrary()
    picker.value = map.id
    name.value = map.name
    }
    undo.disabled = !history.length
    redo.disabled = !redoHistory.length
    const active = !inline && canvas.contains(document.activeElement) ? document.activeElement : null,
      focusNode = active?.closest?.('[data-node]')?.getAttribute('data-node'),
      focusEdge = active?.closest?.('[data-edge]')?.getAttribute('data-edge')
    const oldInput = canvas.querySelector('foreignObject input')
    if (oldInput) oldInput.onblur = null // removing a focused input fires blur during the redraw
    canvas.replaceChildren()
    const defs = svgEl('defs')
    const marker = svgEl('marker', {
      id: 'wm-arrow',
      viewBox: '0 0 10 10',
      refX: 9,
      refY: 5,
      markerWidth: 12,
      markerHeight: 12,
      markerUnits: 'userSpaceOnUse',
      orient: 'auto-start-reverse',
    })
    marker.append(svgEl('path', { d: 'M 0 0 L 10 5 L 0 10 z', fill: '#68727e' }))
    defs.append(marker)
    canvas.append(defs)
    for (const edge of map.edges) {
      const a = map.nodes.find((n) => n.id === edge.from),
        b = map.nodes.find((n) => n.id === edge.to)
      if (!a || !b) continue
      const [p, q] = edgeEnds(a, b),
        g = svgEl('g', {
          'data-edge': edge.id,
          role: 'button',
          tabindex: 0,
          'aria-label': a.word + ' — ' + edge.relation + ' — ' + b.word,
        })
      const selected = selection?.id === edge.id
      const attrs = {
        x1: p.x,
        y1: p.y,
        x2: q.x,
        y2: q.y,
        stroke: selected ? '#1769c2' : '#68727e',
        'stroke-width': selected ? 4 : 2,
      }
      const style = LINE_STYLES.find(([v]) => v === edgeStyle(edge))
      if (style[2]) {
        attrs['stroke-dasharray'] = style[2]
        if (style[0] !== 'dashed') attrs['stroke-linecap'] = 'round'
      }
      if (['start', 'both'].includes(edge.arrows)) attrs['marker-start'] = 'url(#wm-arrow)'
      if (['end', 'both'].includes(edge.arrows)) attrs['marker-end'] = 'url(#wm-arrow)'
      g.append(
        svgEl('line', {
          x1: p.x,
          y1: p.y,
          x2: q.x,
          y2: q.y,
          stroke: 'transparent',
          'stroke-width': 20,
        }),
        svgEl('line', attrs)
      )
      const x = (p.x + q.x) / 2,
        y = (p.y + q.y) / 2
      if (edge.marker)
        g.append(
          svgEl(
            'text',
            {
              x,
              y: y + 10,
              fill: '#d62626',
              'font-size': 36,
              'text-anchor': 'middle',
              'paint-order': 'stroke',
              stroke: 'white',
              'stroke-width': 7,
            },
            edge.marker
          )
        )
      if (edge.label || edge.uncertain)
        g.append(
          svgEl(
            'text',
            {
              x,
              y: y - 14,
              'text-anchor': 'middle',
              'font-size': 17,
              fill: '#404955',
              'paint-order': 'stroke',
              stroke: 'white',
              'stroke-width': 5,
            },
            (edge.label || '') + (edge.uncertain ? ' ?' : '')
          )
        )
      g.onclick = () => select('edge', edge.id)
      g.onkeydown = (e) => {
        if (e.key === 'Enter') g.onclick()
      }
      canvas.append(g)
    }
    for (const n of map.nodes) {
      const w = nodeWidth(n),
        inGroup = group.has(n.id),
        g = svgEl('g', {
          'data-node': n.id,
          role: 'button',
          tabindex: 0,
          'aria-label': n.word,
          transform: `translate(${n.x},${n.y})`,
        })
      g.classList.add('wm-node')
      const relatedCount = mapIndex.count(n.word, map.id)
      if (relatedCount) {
        const otherMaps = mapIndex.related(n.word, map.id, 5)
        const badge = svgEl('g', { class: 'wm-cross-map-indicator', 'aria-label': 'Also in ' + relatedCount + ' maps: ' + otherMaps.map(other => other.name).join(', ') })
        badge.append(svgEl('circle', { cx: w / 2 - 2, cy: -25, r: 12, fill: '#1769c2', stroke: 'white', 'stroke-width': 2 }))
        badge.append(svgEl('text', { x: w / 2 - 2, y: -20, 'text-anchor': 'middle', fill: 'white', 'font-size': 14, 'font-weight': 700 }, String(relatedCount)))
        badge.style.pointerEvents = 'none'
        g.append(badge)
      }
      if (searchNodes.has(n.id)) {
        g.classList.add('wm-search-match')
        g.append(svgEl('rect', { x: -w / 2 - 7, y: -34, width: w + 14, height: 68, rx: 16,
          fill: 'none', stroke: '#d97706', 'stroke-width': 6, 'stroke-dasharray': '10 4',
          'pointer-events': 'none', 'aria-hidden': 'true' }))
      }
      if (!editing()) g.style.cursor = 'pointer'
      const attrs = {
        fill: n.color || '#dc3636',
        stroke: selection?.id === n.id || inGroup ? '#174b8c' : 'white',
        'stroke-width': selection?.id === n.id || inGroup ? 4 : 2,
      }
      if (inGroup) attrs['stroke-dasharray'] = '8 4'
      const points = nodePolygon(n)
      g.append(
        n.shape === 'ellipse'
          ? svgEl('ellipse', { ...attrs, rx: w / 2, ry: 27 })
          : points
            ? svgEl('polygon', { ...attrs, points: points.map(p => p.join(',')).join(' ') })
            : svgEl('rect', { ...attrs, x: -w / 2, y: -27, width: w, height: 54, rx: 13 })
      )
      if (inline?.id === n.id) {
        const iw = Math.max(w, 240),
          fo = svgEl('foreignObject', { x: -iw / 2, y: -27, width: iw, height: 54 }),
          input = document.createElement('input')
        input.value = n.word
        input.maxLength = 100
        input.setAttribute('aria-label', 'Word text. Enter to save, Escape to cancel.')
        input.style.cssText =
          'width:100%;height:100%;box-sizing:border-box;padding:0 10px;text-align:center;' +
          'font:inherit;font-size:22px;border:3px solid #fff;border-radius:13px;outline:none;' +
          'color:' + (n.textColor || '#ffffff') + ';' +
          'background:' +
          (n.color || '#dc3636')
        input.onpointerdown = (ev) => ev.stopPropagation()
        input.onkeydown = (ev) => {
          ev.stopPropagation()
          if (ev.isComposing) return
          if (ev.key === 'Enter') {
            ev.preventDefault()
            finishInline(true)
          } else if (ev.key === 'Escape') {
            ev.preventDefault()
            finishInline(false)
          }
        }
        input.onblur = () => finishInline(true)
        fo.append(input)
        g.append(fo)
      } else
        g.append(
          svgEl(
            'text',
            {
              'text-anchor': 'middle',
              'dominant-baseline': 'central',
              fill: n.textColor || '#ffffff',
              'font-size': 22,
            },
            n.word
          )
        )
      g.onpointerdown = (e) => {
        if (e.button !== 0) return
        e.preventDefault()
        if (!editing()) {
          if (lastTap?.id === n.id && e.timeStamp - lastTap.t < 400) {
            lastTap = null
            if (onLookup) { minimizeMap(); onLookup(n.lookup || n.word) }
          } else {
            lastTap = { id: n.id, t: e.timeStamp }
            select('node', n.id)
          }
          return
        }
        if (e.shiftKey || e.ctrlKey || e.metaKey) {
          toggleInGroup(n.id)
          return
        }
        const ids = group.has(n.id) ? [...group] : [n.id]
        drag = {
          id: n.id,
          ids,
          starts: new Map(
            ids.map((id) => {
              const m = map.nodes.find((x) => x.id === id)
              return [id, { x: m.x, y: m.y }]
            })
          ),
          startX: e.clientX,
          startY: e.clientY,
          before: JSON.stringify(map),
          moved: false,
        }
        canvas.setPointerCapture(e.pointerId)
      }
      g.onkeydown = (e) => {
        if (e.target !== g) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          if (e.key === 'Enter' && editing() && !connecting && selection?.kind === 'node' && selection.id === n.id)
            startInline(n.id)
          else select('node', n.id)
        }
      }
      canvas.append(g)
    }
    if (marquee)
      canvas.append(
        svgEl('rect', {
          x: Math.min(marquee.x0, marquee.x1),
          y: Math.min(marquee.y0, marquee.y1),
          width: Math.abs(marquee.x1 - marquee.x0),
          height: Math.abs(marquee.y1 - marquee.y0),
          fill: 'rgba(23,105,194,0.12)',
          stroke: '#1769c2',
          'stroke-width': 2,
          'stroke-dasharray': '6 4',
          'pointer-events': 'none',
        })
      )
    if (focusNode) nodeEl(focusNode)?.focus({ preventScroll: true })
    else if (focusEdge) edgeEl(focusEdge)?.focus({ preventScroll: true })
  }
  function toggleInGroup(id) {
    if (!group.size && selection?.kind === 'node' && selection.id !== id) group.add(selection.id)
    group.has(id) ? group.delete(id) : group.add(id)
    selection = null
    if (group.size === 1) {
      selection = { kind: 'node', id: [...group][0] }
      group.clear()
    }
    draw()
    details()
  }
  function select(kind, id) {
    if (connecting && kind === 'node') {
      if (connecting === id) {
        connecting = null
        hint.textContent = 'Connection cancelled.'
        return
      }
      const from = connecting
      connecting = null
      commit(() => {
        const edge = {
          id: newId(),
          from,
          to: id,
          relation: 'association',
          label: '',
          arrows: 'none',
        }
        map.edges.push(edge)
        selection = { kind: 'edge', id: edge.id }
      })
      hint.textContent = 'Connection added. Choose its relationship in the details panel.'
      return
    }
    group.clear()
    selection = { kind, id }
    setInspector(true)
    draw()
    details()
  }
  function toCanvas(e) {
    // Use the SVG's actual viewBox transform so clicks stay aligned even when
    // preserveAspectRatio introduces letterboxing in a differently sized view.
    if (canvas.createSVGPoint && canvas.getScreenCTM) {
      const matrix = canvas.getScreenCTM()
      if (matrix) {
        const point = canvas.createSVGPoint()
        point.x = e.clientX
        point.y = e.clientY
        const local = point.matrixTransform(matrix.inverse())
        return { x: local.x, y: local.y }
      }
    }
    const rect = canvas.getBoundingClientRect()
    return { x: ((e.clientX - rect.left) * 2400) / rect.width,
      y: ((e.clientY - rect.top) * 1600) / rect.height }
  }
  canvas.addEventListener('dblclick', (e) => {
    if (!editing() || e.target.closest?.('[data-node],[data-edge]')) return
    e.preventDefault()
    addWord(toCanvas(e))
  })
  canvas.onpointerdown = (e) => {
    // Node and edge handlers deal with their own presses; this is empty canvas only.
    if (e.button !== 0 || e.target.closest?.('[data-node],[data-edge]')) return
    if (!editing()) {
      if (selection || group.size) {
        selection = null
        group.clear()
        draw()
        details()
      }
      return
    }
    const additive = e.shiftKey || e.ctrlKey || e.metaKey
    if (additive && selection?.kind === 'node') group.add(selection.id)
    if (additive) selection = null
    const p = toCanvas(e)
    marquee = { x0: p.x, y0: p.y, x1: p.x, y1: p.y, additive, base: additive ? new Set(group) : new Set() }
    canvas.setPointerCapture(e.pointerId)
  }
  function updateDraggedNodes(ids) {
    const nodes = new Map(map.nodes.map(node => [node.id, node]))
    const edges = new Map(map.edges.map(edge => [edge.id, edge]))
    for (const group of canvas.querySelectorAll('[data-node]')) {
      const id = group.getAttribute('data-node')
      if (ids.has(id)) {
        const node = nodes.get(id)
        group.setAttribute('transform', `translate(${node.x},${node.y})`)
      }
    }
    for (const group of canvas.querySelectorAll('[data-edge]')) {
      const edge = edges.get(group.getAttribute('data-edge'))
      if (!edge || (!ids.has(edge.from) && !ids.has(edge.to))) continue
      const [p, q] = edgeEnds(nodes.get(edge.from), nodes.get(edge.to))
      for (const line of group.querySelectorAll('line')) {
        for (const [name,value] of Object.entries({x1:p.x,y1:p.y,x2:q.x,y2:q.y})) line.setAttribute(name,value)
      }
      const x=(p.x+q.x)/2, y=(p.y+q.y)/2
      for (const text of group.querySelectorAll('text')) {
        const marker = text.getAttribute('font-size') === '36'
        text.setAttribute('x',x);text.setAttribute('y',y+(marker?10:-14))
      }
    }
  }
  canvas.onpointermove = (e) => {
    if (marquee) {
      const p = toCanvas(e)
      marquee.x1 = p.x
      marquee.y1 = p.y
      const l = Math.min(marquee.x0, marquee.x1),
        r = Math.max(marquee.x0, marquee.x1),
        t = Math.min(marquee.y0, marquee.y1),
        b = Math.max(marquee.y0, marquee.y1)
      group = new Set(marquee.base)
      for (const n of map.nodes) {
        const hw = nodeWidth(n) / 2
        if (n.x + hw >= l && n.x - hw <= r && n.y + 27 >= t && n.y - 27 <= b) group.add(n.id)
      }
      selection = null
      draw(true)
      return
    }
    if (!drag) return
    const rect = canvas.getBoundingClientRect()
    let dx = ((e.clientX - drag.startX) * 2400) / rect.width,
      dy = ((e.clientY - drag.startY) * 1600) / rect.height
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true
    if (drag.moved) {
      // Clamp the whole group together so its shape is preserved at the edges.
      const s = [...drag.starts.values()]
      dx = clamp(dx, 190 - Math.min(...s.map((v) => v.x)), 2210 - Math.max(...s.map((v) => v.x)))
      dy = clamp(dy, 40 - Math.min(...s.map((v) => v.y)), 1560 - Math.max(...s.map((v) => v.y)))
      for (const [id, start] of drag.starts) {
        const n = map.nodes.find((n) => n.id === id)
        n.x = start.x + dx
        n.y = start.y + dy
      }
      updateDraggedNodes(new Set(drag.starts.keys()))
    }
  }
  canvas.onpointerup = (e) => {
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    if (marquee) {
      const m = marquee
      marquee = null
      const moved = Math.abs(m.x1 - m.x0) + Math.abs(m.y1 - m.y0) > 6
      if (!moved && !m.additive) {
        group.clear()
        selection = null
      } else if (group.size === 1) {
        selection = { kind: 'node', id: [...group][0] }
        group.clear()
      }
      draw()
      details()
      return
    }
    if (!drag) return
    const d = drag
    drag = null
    if (d.moved) {
      history.push(d.before)
      if (history.length > 50) history.shift()
      redoHistory = []
      save()
      draw()
    } else if (editing() && lastTap?.id === d.id && e.timeStamp - lastTap.t < 400) {
      lastTap = null
      startInline(d.id)
    } else {
      lastTap = { id: d.id, t: e.timeStamp }
      select('node', d.id)
    }
  }
  // Finish any inline edit before a press elsewhere on the canvas is handled.
  canvas.addEventListener(
    'pointerdown',
    (e) => {
      if (inline && !e.target.closest?.('foreignObject')) finishInline(true)
    },
    true
  )
  canvas.onpointercancel = () => {
    if (marquee) {
      marquee = null
      draw()
    }
    if (drag) {
      Object.assign(map, JSON.parse(drag.before))
      drag = null
      draw()
    }
  }
  // Arrow keys nudge the selected word or group (Shift = larger steps).
  canvas.onkeydown = (e) => {
    if (!editing()) return
    const dir = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1],
    }[e.key]
    const ids = group.size > 1 ? [...group] : selection?.kind === 'node' ? [selection.id] : []
    if (!dir || !ids.length) return
    e.preventDefault()
    const step = e.shiftKey ? 50 : 10,
      nodes = ids.map((id) => map.nodes.find((n) => n.id === id)).filter(Boolean),
      dx = clamp(dir[0] * step, 190 - Math.min(...nodes.map((n) => n.x)), 2210 - Math.max(...nodes.map((n) => n.x))),
      dy = clamp(dir[1] * step, 40 - Math.min(...nodes.map((n) => n.y)), 1560 - Math.max(...nodes.map((n) => n.y)))
    const focusId = e.target.closest?.('[data-node]')?.getAttribute('data-node')
    commit(() =>
      nodes.forEach((n) => {
        n.x += dx
        n.y += dy
      })
    )
    ;(nodeEl(focusId) || canvas).focus()
  }
  function field(form, label, value, type = 'text', options) {
    const wrap = el('label', label),
      input = el(options ? 'select' : type === 'textarea' ? 'textarea' : 'input')
    if (options) for (const [v, t] of options) input.add(new Option(t, v))
    else if (type !== 'textarea') input.type = type
    if (type === 'checkbox') input.checked = !!value
    else input.value = value || ''
    wrap.append(input)
    form.append(wrap)
    return input
  }
  function colorFields(form, label, initial) {
    const group = el('fieldset', null, 'wm-color-fields')
    group.append(el('legend', label))
    const row = el('div', null, 'wm-color-row')
    group.append(row)
    const picker = field(row, 'Picker', initial, 'color')
    const code = field(row, 'Hex code', initial)
    picker.setAttribute('aria-label', label + ' picker')
    code.setAttribute('aria-label', label + ' hex code')
    code.placeholder = '#ffffff'
    code.spellcheck = false
    code.autocomplete = 'off'
    code.maxLength = 7
    picker.oninput = picker.onchange = () => {
      code.value = picker.value
      code.setCustomValidity('')
    }
    code.oninput = code.onchange = () => {
      const color = normalizeNodeColor(code.value)
      code.setCustomValidity(color ? '' : 'Enter a hex colour such as #1e293b or #abc.')
      if (color) picker.value = color
    }
    code.onblur = () => {
      const color = normalizeNodeColor(code.value)
      if (color) code.value = color
    }
    form.append(group)
    return {
      get value() { return normalizeNodeColor(code.value) },
      valid() { if (normalizeNodeColor(code.value)) return true; code.reportValidity(); return false },
    }
  }
  function row(label, value) {
    if (!value) return null
    const p = el('p')
    p.style.whiteSpace = 'pre-wrap'
    p.append(el('strong', label + ': '), document.createTextNode(value))
    return p
  }
  function renderRelatedMaps(node, readMode) {
    const total=mapIndex.count(node.word,map.id)
    if(!total)return
    const container=el('div',null,'wm-related-maps')
    inspector.append(el('h4','Also appears in'),container)
    const renderPage=page=>{
      container.replaceChildren()
      for(const other of mapIndex.related(node.word,map.id,100,page*100))container.append(button(other.name,()=>{
        activate(other)
        const id=mapIndex.nodes(node.word,other.id)[0]
        if(id)select('node',id)
        if(readMode)setMode('read')
      }))
      appendPages(container,total,page,'related maps',renderPage)
    }
    renderPage(0)
  }
  function readDetails(n, e) {
    if (n) {
      inspector.append(el('h3', n.word))
      inspector.append(...[row('Looks up as', n.lookup)].filter(Boolean))
      renderRelatedMaps(n,true)
      if (n.note) {
        const p = el('p', n.note)
        p.style.whiteSpace = 'pre-wrap'
        inspector.append(el('h4', 'Notes'), p)
      }
      if (n.images?.length) inspector.append(el('h4', 'Images'), imageGallery(n.images, false, n.word))
      inspector.append(
        button('Find vocabulary & clips', () => {
          minimizeMap()
          onLookup(n.lookup || n.word)
        })
      )
    } else {
      const a = map.nodes.find((m) => m.id === e.from),
        b = map.nodes.find((m) => m.id === e.to)
      inspector.append(
        el('h3', 'Connection'),
        ...[
          row('Between', a.word + ' and ' + b.word),
          row('Relationship', e.relation),
          row('Label', e.label),
          row('Uncertain', e.uncertain ? 'Yes' : ''),
          row('Explanation', e.note),
          row('Source', e.source),
        ].filter(Boolean)
      )
    }
  }
  function details() {
    const key = selection?.id || [...group].sort().join('|')
    if (key && key !== lastDetailsKey) setInspector(true)
    lastDetailsKey = key
    inspector.replaceChildren()
    if (group.size > 1) {
      const members = map.nodes.filter((n) => group.has(n.id))
      inspector.append(
        el('h3', members.length + ' words selected'),
        el(
          'p',
          'Drag any selected word to move the group, or use the arrow keys. Shift-click a word to add or remove it.'
        )
      )
      const form = el('form'),
        color = colorFields(form, 'Background color for all', members[0]?.color || '#dc3636'),
        textColor = colorFields(form, 'Text color for all', members[0]?.textColor || '#ffffff'),
        shape = field(form, 'Shape for all', '', 'text', [
          ['', 'Keep each shape'],
          ...NODE_SHAPES,
        ]),
        apply = button('Apply to group', () => {})
      apply.type = 'submit'
      form.append(apply)
      form.onsubmit = (ev) => {
        ev.preventDefault()
        if (!color.valid() || !textColor.valid()) return
        commit(() =>
          members.forEach((n) => {
            n.color = color.value
            n.textColor = textColor.value
            if (shape.value) n.shape = shape.value
          })
        )
      }
      inspector.append(
        form,
        button('Delete selected words', () =>
          commit(() => {
            for (const id of [...group]) removeNode(map, id)
            group.clear()
            selection = null
          })
        ),
        button('Clear selection', () => {
          group.clear()
          draw()
          details()
        })
      )
      return
    }
    const n = selection?.kind === 'node' ? map.nodes.find((n) => n.id === selection.id) : null,
      e = selection?.kind === 'edge' ? map.edges.find((e) => e.id === selection.id) : null
    if (!n && !e) {
      if (!editing()) {
        inspector.append(
          el('h3', map.nodes.length ? 'Read mode' : 'Empty map'),
          el(
            'p',
            map.nodes.length
              ? 'Select a word or connection to read its details.'
              : 'This map has no words yet. Switch to edit mode to add some.'
          )
        )
        return
      }
      inspector.append(
        el('h3', 'Build a word map'),
        el('p', 'Add words and connect them to show meanings, word parts, origins or contrasts.'),
        el('p', 'Maps start empty. Relationships and notes are yours to define.'),
        el(
          'p',
          'Shortcuts: N new word · C connect the selected word · F2 or E rename in place (or double-click) · Esc cancel.'
        )
      )
      return
    }
    if (!editing()) {
      readDetails(n, e)
      return
    }
    inspector.append(el('h3', n ? 'Word' : 'Connection'))
    if (n) {
      renderRelatedMaps(n,false)
    }
    const form = el('form')
    inspector.append(form)
    if (n) {
      const word = field(form, 'Word / phrase', n.word)
      word.required = true
      word.maxLength = 100
      const lookup = field(form, 'Vocabulary lookup', n.lookup)
      lookup.placeholder = 'Defaults to the word'
      const list = el('datalist')
      list.id = 'wm-vocabulary'
      for (const term of vocabulary.slice(0, 5000)) {
        const o = el('option')
        o.value = term
        list.append(o)
      }
      lookup.setAttribute('list', list.id)
      form.append(list)
      const color = colorFields(form, 'Background color', n.color || '#dc3636'),
        textColor = colorFields(form, 'Text color', n.textColor || '#ffffff'),
        shape = field(form, 'Shape', n.shape || 'rectangle', 'text', [
          ...NODE_SHAPES,
        ]),
        note = field(form, 'Notes', n.note, 'textarea'),
        images = field(
          form,
          'Image or GIF links (one per line)',
          (n.images || []).join('\n'),
          'textarea'
        )
      images.placeholder = 'https://example.com/picture.gif'
      images.rows = 3
      images.spellcheck = false
      if (n.images?.length) form.append(imageGallery(n.images, true, n.word))
      const apply = button('Apply word', () => {})
      apply.type = 'submit'
      form.append(apply)
      form.onsubmit = (ev) => {
        ev.preventDefault()
        if (!word.value.trim() || !color.valid() || !textColor.valid()) return
        const parsed = parseImageLinks(images.value)
        commit(() =>
          Object.assign(n, {
            word: word.value.trim(),
            lookup: lookup.value.trim(),
            color: color.value,
            textColor: textColor.value,
            shape: shape.value,
            note: note.value,
            images: parsed.links,
          })
        )
        const warn =
          (parsed.rejected ? parsed.rejected + ' link(s) ignored: only http and https links work. ' : '') +
          (parsed.truncated ? parsed.truncated + ' link(s) over the limit of ' + MAX_IMAGES + ' dropped.' : '')
        if (warn) status.textContent = warn
      }
      inspector.append(
        button('Find vocabulary & clips', () => {
          minimizeMap()
          onLookup(n.lookup || n.word)
        }),
        button('Connect to another word (C)', () => startConnecting(n.id)),
        button('Delete word', () =>
          commit(() => {
            removeNode(map, n.id)
            selection = null
          })
        )
      )
    } else {
      const relation = field(
          form,
          'Relationship',
          e.relation,
          'text',
          [...new Set([...RELATIONS, e.relation])].map((v) => [v, v])
        ),
        label = field(form, 'Visible label', e.label),
        arrows = field(form, 'Arrows', e.arrows, 'text', [
          ['none', 'No arrows'],
          ['end', 'Arrow at end'],
          ['start', 'Arrow at start'],
          ['both', 'Arrows at both ends'],
        ]),
        lineStyle = field(
          form,
          'Line style',
          edgeStyle(e),
          'text',
          LINE_STYLES.map(([v, t]) => [v, t])
        ),
        marker = field(form, 'Middle marker', e.marker, 'text', [
          ['', 'None'],
          ['×', '×'],
        ]),
        uncertain = field(form, 'Uncertain', e.uncertain, 'checkbox'),
        note = field(form, 'Explanation', e.note, 'textarea'),
        source = field(form, 'Source / reference', e.source)
      relation.onchange = () => {
        if (relation.value === 'not related') {
          lineStyle.value = 'dashed'
          marker.value = '×'
        }
      }
      const apply = button('Apply connection', () => {})
      apply.type = 'submit'
      form.append(apply)
      form.onsubmit = (ev) => {
        ev.preventDefault()
        commit(() =>
          Object.assign(e, {
            relation: relation.value,
            label: label.value,
            arrows: arrows.value,
            lineStyle: lineStyle.value,
            dashed: lineStyle.value !== 'solid', // kept for older readers of the map data
            marker: marker.value,
            uncertain: uncertain.checked,
            note: note.value,
            source: source.value,
          })
        )
      }
      inspector.append(
        button('Delete connection', () =>
          commit(() => {
            map.edges = map.edges.filter((x) => x !== e)
            selection = null
          })
        )
      )
    }
  }
  activate(maps[0] || null)
  setMode(map.nodes.length ? 'read' : 'edit')
  dialog.showModal()
  scale(window.innerWidth < 700 ? -0.65 : -0.45)
  if (window.innerWidth < 700) fitMap()
  if (focus) revealSearchResult(focus)
  refreshSync()
  if (sync && !storageBroken) runSync(true)
}

