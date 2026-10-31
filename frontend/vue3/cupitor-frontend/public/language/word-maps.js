import {
  emptyMap,
  readMap,
  newId,
  RELATIONS,
  removeNode,
  edgeEnds,
  parseImageLinks,
  MAX_IMAGES,
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
const nodeWidth = (n) => Math.max(110, Math.min(380, n.word.length * 12 + 30))
const EDIT_HINT =
  'Press N to add a word and type straight into it. Select a word, then press C to connect it, or F2 / double-click to rename it in place. Drag it into position; drag on empty space (or Shift-click words) to select a group and move them together.'
const READ_HINT =
  'Read mode: select a word or connection to see its details. Switch to edit mode to change the map.'
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
export function openWordMaps({ storageKey, onLookup, vocabulary = [] }) {
  const existing = document.querySelector('#wordMapsDialog')
  if (existing) {
    existing.showModal()
    return
  }
  const dialog = el('dialog', null, 'word-maps')
  dialog.id = 'wordMapsDialog'
  dialog.setAttribute('aria-label', 'Word maps')
  let maps = [],
    map = null,
    selection = null,
    connecting = null,
    history = [],
    zoom = 1,
    drag = null,
    group = new Set(),
    marquee = null,
    mode = 'edit',
    inline = null,
    lastTap = null
  const editing = () => mode === 'edit'
  const editOnly = []
  const status = el('span', '', 'wm-status')
  status.setAttribute('role', 'status')
  let storageBroken = false
  try {
    const raw = localStorage.getItem(storageKey)
    if (raw) {
      const data = JSON.parse(raw)
      if (!Array.isArray(data)) throw Error()
      maps = data.map(readMap)
    }
  } catch (_) {
    storageBroken = true
    status.textContent =
      'Saved maps could not be read. Export or recover the stored data before saving new maps.'
  }
  const header = el('header'),
    title = el('h2', 'Word maps'),
    close = button('Close', () => dialog.close())
  header.append(title, close)
  const toolbar = el('div', null, 'wm-toolbar'),
    picker = el('select'),
    modeGroup = el('div', null, 'wm-modes'),
    modeEdit = button('Edit', () => setMode('edit')),
    modeRead = button('Read', () => setMode('read'))
  modeGroup.setAttribute('role', 'group')
  modeGroup.setAttribute('aria-label', 'Mode')
  modeGroup.append(modeEdit, modeRead)
  picker.setAttribute('aria-label', 'Saved word map')
  const name = el('input')
  name.setAttribute('aria-label', 'Map name')
  name.maxLength = 200
  const layout = el('div', null, 'wm-layout'),
    work = el('div', null, 'wm-work'),
    viewport = el('div', null, 'wm-viewport'),
    inspector = el('aside', null, 'wm-inspector')
  inspector.setAttribute('aria-label', 'Word or connection details')
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
    button('Cancel', () => {
      script.hidden = true
      scriptTools.hidden = true
      viewport.hidden = false
    })
  )
  work.append(hint, viewport, script, scriptTools)
  layout.append(work, inspector)
  const file = el('input')
  file.type = 'file'
  file.accept = '.json,application/json'
  file.hidden = true
  file.onchange = async () => {
    try {
      if (!file.files[0]) return
      if (file.files[0].size > 2000000) throw Error('Please select a JSON file smaller than 2 MB.')
      const imported = readMap(await file.files[0].text())
      imported.id = newId()
      maps.push(imported)
      activate(imported)
      save()
    } catch (e) {
      status.textContent = e.message
    } finally {
      file.value = ''
    }
  }
  const undo = editBtn('Undo', undoLast)
  toolbar.append(
    picker,
    name,
    modeGroup,
    editBtn('New map', () => {
      const m = emptyMap()
      maps.push(m)
      activate(m)
      save()
    }),
    editBtn('+ Word', addWord, 'New word (N)'),
    undo,
    editBtn('Arrange', () =>
      commit(() =>
        map.nodes.forEach((n, i) => {
          n.x = 180 + (i % 5) * 420
          n.y = 120 + Math.floor(i / 5) * 140
        })
      )
    ),
    button('−', () => scale(-0.2)),
    button('+', () => scale(0.2)),
    editBtn('JSON', () => {
      script.value = JSON.stringify(map, null, 2)
      script.hidden = false
      scriptTools.hidden = false
      viewport.hidden = true
    }),
    editBtn('Import', () => file.click()),
    button('Export', () =>
      download(JSON.stringify(map, null, 2), map.name + '.json', 'application/json')
    ),
    editBtn('Delete map', () => {
      if (confirm('Delete “' + map.name + '”?')) {
        maps = maps.filter((m) => m !== map)
        activate(maps[0] || null)
        save()
      }
    })
  )
  const footer = el('footer')
  footer.append(el('small', 'Saved on this device · Export to back up or transfer maps.'), status)
  dialog.append(header, toolbar, layout, footer, file)
  document.body.append(dialog)
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
    if (e.key === 'Escape' && connecting) {
      e.preventDefault()
      cancelConnecting()
      return
    }
    if (!editing() || e.repeat || e.ctrlKey || e.metaKey || e.altKey) return
    if (e.target.closest?.('input,textarea,select,[contenteditable="true"]')) return
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
  })
  dialog.addEventListener('close', () => {
    dialog.remove()
  })
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
    modeEdit.setAttribute('aria-pressed', String(editing()))
    modeRead.setAttribute('aria-pressed', String(!editing()))
    hint.textContent = editing() ? EDIT_HINT : READ_HINT
    draw()
    details()
  }
  const nodeEl = (id) => [...canvas.querySelectorAll('[data-node]')].find((g) => g.dataset.node === id)
  const edgeEl = (id) => [...canvas.querySelectorAll('[data-edge]')].find((g) => g.dataset.edge === id)
  function undoLast() {
    if (!history.length) return
    Object.assign(map, JSON.parse(history.pop()))
    selection = null
    group.clear()
    save()
    draw()
    details()
  }
  function addWord() {
    if (!editing()) return
    let created
    commit(() => {
      created = {
        id: newId(),
        word: 'New word',
        x: 220 + (map.nodes.length % 6) * 260,
        y: 160 + Math.floor(map.nodes.length / 6) * 110,
        color: '#dc3636',
        shape: 'rectangle',
        lookup: '',
        note: '',
        images: [],
      }
      map.nodes.push(created)
      group.clear()
      selection = { kind: 'node', id: created.id }
    })
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
    zoom = Math.max(0.3, Math.min(1.8, zoom + delta))
    canvas.style.width = 2400 * zoom + 'px'
    canvas.style.height = 1600 * zoom + 'px'
  }
  function download(text, filename, type) {
    const url = URL.createObjectURL(new Blob([text], { type })),
      a = el('a')
    a.href = url
    a.download = filename
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  function save() {
    if (storageBroken) {
      status.textContent =
        'Saving blocked: existing stored maps could not be read. Export your work to keep it.'
      return
    }
    try {
      localStorage.setItem(storageKey, JSON.stringify(maps))
      status.textContent = 'Saved on this device'
    } catch (_) {
      status.textContent = 'Could not save. Export your map to keep your changes.'
    }
  }
  function commit(fn) {
    if (!editing()) return
    history.push(JSON.stringify(map))
    if (history.length > 50) history.shift()
    fn()
    save()
    draw()
    details()
  }
  function activate(value) {
    map = value
    selection = null
    group.clear()
    marquee = null
    inline = null
    connecting = null
    history = []
    if (!map) {
      map = emptyMap()
      maps.push(map)
    }
    draw()
    details()
    viewport.scrollTo(0, 0)
  }
  function draw() {
    picker.replaceChildren(...maps.map((m) => new Option(m.name, m.id)))
    picker.value = map.id
    name.value = map.name
    undo.disabled = !history.length
    const active = !inline && canvas.contains(document.activeElement) ? document.activeElement : null,
      focusNode = active?.closest?.('[data-node]')?.dataset.node,
      focusEdge = active?.closest?.('[data-edge]')?.dataset.edge
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
      if (!editing()) g.style.cursor = 'pointer'
      const attrs = {
        fill: n.color || '#dc3636',
        stroke: selection?.id === n.id || inGroup ? '#174b8c' : 'white',
        'stroke-width': selection?.id === n.id || inGroup ? 4 : 2,
      }
      if (inGroup) attrs['stroke-dasharray'] = '8 4'
      g.append(
        n.shape === 'ellipse'
          ? svgEl('ellipse', { ...attrs, rx: w / 2, ry: 27 })
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
          'font:inherit;font-size:22px;color:#fff;border:3px solid #fff;border-radius:13px;outline:none;' +
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
              fill: 'white',
              'font-size': 22,
            },
            n.word
          )
        )
      g.onpointerdown = (e) => {
        if (e.button !== 0) return
        e.preventDefault()
        if (!editing()) {
          select('node', n.id)
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
    draw()
    details()
  }
  function toCanvas(e) {
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((e.clientX - rect.left) * 2400) / rect.width,
      y: ((e.clientY - rect.top) * 1600) / rect.height,
    }
  }
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
      draw()
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
      draw()
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
    const focusId = e.target.closest?.('[data-node]')?.dataset.node
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
  function row(label, value) {
    if (!value) return null
    const p = el('p')
    p.style.whiteSpace = 'pre-wrap'
    p.append(el('strong', label + ': '), document.createTextNode(value))
    return p
  }
  function readDetails(n, e) {
    if (n) {
      inspector.append(el('h3', n.word))
      inspector.append(...[row('Looks up as', n.lookup)].filter(Boolean))
      if (n.note) {
        const p = el('p', n.note)
        p.style.whiteSpace = 'pre-wrap'
        inspector.append(el('h4', 'Notes'), p)
      }
      if (n.images?.length) inspector.append(el('h4', 'Images'), imageGallery(n.images, false, n.word))
      const links = map.edges.filter((x) => x.from === n.id || x.to === n.id)
      if (links.length) {
        inspector.append(el('h4', 'Connections'))
        const list = el('ul')
        for (const x of links) {
          const a = map.nodes.find((m) => m.id === x.from),
            b = map.nodes.find((m) => m.id === x.to),
            li = el('li')
          li.append(button(a.word + ' — ' + x.relation + ' — ' + b.word, () => select('edge', x.id)))
          list.append(li)
        }
        inspector.append(list)
      }
      inspector.append(
        button('Find vocabulary & clips', () => {
          dialog.close()
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
        color = field(form, 'Colour for all', members[0]?.color || '#dc3636', 'color'),
        shape = field(form, 'Shape for all', '', 'text', [
          ['', 'Keep each shape'],
          ['rectangle', 'Rounded rectangle'],
          ['ellipse', 'Ellipse'],
        ]),
        apply = button('Apply to group', () => {})
      apply.type = 'submit'
      form.append(apply)
      form.onsubmit = (ev) => {
        ev.preventDefault()
        commit(() =>
          members.forEach((n) => {
            n.color = color.value
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
      const color = field(form, 'Colour', n.color || '#dc3636', 'color'),
        shape = field(form, 'Shape', n.shape || 'rectangle', 'text', [
          ['rectangle', 'Rounded rectangle'],
          ['ellipse', 'Ellipse'],
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
        if (!word.value.trim()) return
        const parsed = parseImageLinks(images.value)
        commit(() =>
          Object.assign(n, {
            word: word.value.trim(),
            lookup: lookup.value.trim(),
            color: color.value,
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
          dialog.close()
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
}
