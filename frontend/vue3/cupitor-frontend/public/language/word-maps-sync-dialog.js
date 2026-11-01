// Resolve simultaneous edits explicitly, using text-only DOM for map content.
export function resolveWordMapConflicts(conflicts) {
  return new Promise((resolve) => {
    const dialog = document.createElement('dialog')
    dialog.className = 'word-maps-conflicts'
    dialog.setAttribute('aria-label', 'Resolve word map conflicts')
    const make = (tag, text) => {
      const node = document.createElement(tag)
      node.textContent = text
      return node
    }
    const form = document.createElement('form'),
      fields = new Map()
    form.append(
      make('h2', 'Word maps changed on both devices'),
      make(
        'p',
        'Choose which version to keep for each map. Cancel keeps your local changes without pushing.'
      )
    )
    for (const c of conflicts) {
      const section = document.createElement('section'),
        label = make('label', c.local?.name || c.remote?.name || c.base?.name)
      const select = document.createElement('select')
      select.required = true
      for (const [value, text] of [
        ['', 'Choose a version…'],
        ['local', 'Keep this device'],
        ['remote', 'Use GitHub'],
        ...(c.local && c.remote ? [['both', 'Keep both copies']] : []),
      ])
        select.add(new Option(text, value))
      label.append(select)
      section.append(label)
      fields.set(c.id, select)
      for (const [title, map] of [
        ['This device', c.local],
        ['GitHub', c.remote],
      ]) {
        const details = document.createElement('details')
        details.append(
          make(
            'summary',
            title +
              ': ' +
              (map
                ? map.name +
                  ' · ' +
                  map.nodes.length +
                  ' words, ' +
                  map.edges.length +
                  ' connections'
                : 'deleted')
          )
        )
        if (map) details.append(make('pre', JSON.stringify(map, null, 2)))
        section.append(details)
      }
      form.append(section)
    }
    const done = make('button', 'Continue sync')
    done.type = 'submit'
    const cancel = make('button', 'Cancel')
    cancel.type = 'button'
    const finish = (answers) => {
      dialog.remove()
      resolve(answers)
    }
    cancel.onclick = () => finish(null)
    dialog.oncancel = (e) => {
      e.preventDefault()
      finish(null)
    }
    form.onsubmit = (e) => {
      e.preventDefault()
      if (form.reportValidity())
        finish(Object.fromEntries([...fields].map(([id, field]) => [id, field.value])))
    }
    form.append(done, cancel)
    dialog.append(form)
    document.body.append(dialog)
    dialog.showModal()
  })
}
