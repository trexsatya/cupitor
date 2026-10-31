import { emptyMap, readMap, newId, RELATIONS, removeNode, edgeEnds } from './word-map-model.js'
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
    drag = null
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
    picker = el('select')
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
    'Add a word, then drag it into position. Select a word to edit it or start a connection.',
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
  const undo = button('Undo', () => {
    if (history.length) {
      Object.assign(map, JSON.parse(history.pop()))
      selection = null
      save()
      draw()
      details()
    }
  })
  toolbar.append(
    picker,
    name,
    button('New map', () => {
      const m = emptyMap()
      maps.push(m)
      activate(m)
      save()
    }),
    button('+ Word', () => {
      commit(() => {
        const n = {
          id: newId(),
          word: 'New word',
          x: 220 + (map.nodes.length % 6) * 260,
          y: 160 + Math.floor(map.nodes.length / 6) * 110,
          color: '#dc3636',
          shape: 'rectangle',
          lookup: '',
          note: '',
        }
        map.nodes.push(n)
        selection = { kind: 'node', id: n.id }
      })
      inspector.querySelector('input')?.focus()
    }),
    undo,
    button('Arrange', () =>
      commit(() =>
        map.nodes.forEach((n, i) => {
          n.x = 180 + (i % 5) * 420
          n.y = 120 + Math.floor(i / 5) * 140
        })
      )
    ),
    button('−', () => scale(-0.2)),
    button('+', () => scale(0.2)),
    button('JSON', () => {
      script.value = JSON.stringify(map, null, 2)
      script.hidden = false
      scriptTools.hidden = false
      viewport.hidden = true
    }),
    button('Import', () => file.click()),
    button('Export', () =>
      download(JSON.stringify(map, null, 2), map.name + '.json', 'application/json')
    ),
    button('Delete map', () => {
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
  dialog.addEventListener('keydown', (e) => e.stopPropagation())
  dialog.addEventListener('close', () => {
    dialog.remove()
  })
  function button(text, fn) {
    const b = el('button', text)
    b.type = 'button'
    b.onclick = fn
    return b
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
      if (edge.dashed || edge.uncertain) attrs['stroke-dasharray'] = '9 7'
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
      const w = Math.max(110, Math.min(380, n.word.length * 12 + 30)),
        g = svgEl('g', {
          'data-node': n.id,
          role: 'button',
          tabindex: 0,
          'aria-label': n.word,
          transform: `translate(${n.x},${n.y})`,
        })
      g.classList.add('wm-node')
      const attrs = {
        fill: n.color || '#dc3636',
        stroke: selection?.id === n.id ? '#174b8c' : 'white',
        'stroke-width': selection?.id === n.id ? 4 : 2,
      }
      g.append(
        n.shape === 'ellipse'
          ? svgEl('ellipse', { ...attrs, rx: w / 2, ry: 27 })
          : svgEl('rect', { ...attrs, x: -w / 2, y: -27, width: w, height: 54, rx: 13 })
      )
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
        drag = {
          id: n.id,
          startX: e.clientX,
          startY: e.clientY,
          x: n.x,
          y: n.y,
          before: JSON.stringify(map),
          moved: false,
        }
        canvas.setPointerCapture(e.pointerId)
      }
      g.onkeydown = (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          select('node', n.id)
        }
      }
      canvas.append(g)
    }
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
    selection = { kind, id }
    draw()
    details()
  }
  canvas.onpointermove = (e) => {
    if (!drag) return
    const n = map.nodes.find((n) => n.id === drag.id)
    const rect = canvas.getBoundingClientRect()
    const dx = ((e.clientX - drag.startX) * 2400) / rect.width,
      dy = ((e.clientY - drag.startY) * 1600) / rect.height
    if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true
    if (drag.moved) {
      n.x = Math.max(190, Math.min(2210, drag.x + dx))
      n.y = Math.max(40, Math.min(1560, drag.y + dy))
      draw()
    }
  }
  canvas.onpointerup = (e) => {
    if (!drag) return
    const d = drag
    drag = null
    if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId)
    if (d.moved) {
      history.push(d.before)
      save()
      draw()
    } else select('node', d.id)
  }
  canvas.onpointercancel = () => {
    if (drag) {
      Object.assign(map, JSON.parse(drag.before))
      drag = null
      draw()
    }
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
  function details() {
    inspector.replaceChildren()
    const n = selection?.kind === 'node' ? map.nodes.find((n) => n.id === selection.id) : null,
      e = selection?.kind === 'edge' ? map.edges.find((e) => e.id === selection.id) : null
    if (!n && !e) {
      inspector.append(
        el('h3', 'Build a word map'),
        el('p', 'Add words and connect them to show meanings, word parts, origins or contrasts.'),
        el('p', 'Maps start empty. Relationships and notes are yours to define.')
      )
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
        note = field(form, 'Notes', n.note, 'textarea')
      const apply = button('Apply word', () => {})
      apply.type = 'submit'
      form.append(apply)
      form.onsubmit = (ev) => {
        ev.preventDefault()
        if (!word.value.trim()) return
        commit(() =>
          Object.assign(n, {
            word: word.value.trim(),
            lookup: lookup.value.trim(),
            color: color.value,
            shape: shape.value,
            note: note.value,
          })
        )
      }
      inspector.append(
        button('Find vocabulary & clips', () => {
          dialog.close()
          onLookup(n.lookup || n.word)
        }),
        button('Connect to another word', () => {
          connecting = n.id
          hint.textContent = 'Select the destination word to connect from “' + n.word + '”.'
          inspector.append(
            button('Cancel connection', () => {
              connecting = null
              hint.textContent = 'Connection cancelled.'
              details()
            })
          )
        }),
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
        dashed = field(form, 'Dashed line', e.dashed, 'checkbox'),
        marker = field(form, 'Middle marker', e.marker, 'text', [
          ['', 'None'],
          ['×', '×'],
        ]),
        uncertain = field(form, 'Uncertain', e.uncertain, 'checkbox'),
        note = field(form, 'Explanation', e.note, 'textarea'),
        source = field(form, 'Source / reference', e.source)
      relation.onchange = () => {
        if (relation.value === 'not related') {
          dashed.checked = true
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
            dashed: dashed.checked,
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
  dialog.showModal()
  scale(window.innerWidth < 700 ? -0.65 : -0.45)
}
