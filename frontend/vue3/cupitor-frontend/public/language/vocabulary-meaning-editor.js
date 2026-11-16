import { isProperlyBracketed } from './vocab-merge.js'
import { normalizeHint, splitVocabularyHints, vocabularyLineParts } from './vocabulary-hints.js'

const control = (tag, text) => {
  const element = document.createElement(tag)
  if (text) element.textContent = text
  return element
}
function label(text, input) {
  const element = control('label', text)
  element.append(input)
  return element
}
function button(text, type = 'button') {
  const element = control('button', text)
  element.type = type
  element.className = 'lang-tool-btn'
  return element
}

export function openVocabularyMeaningEditor({
  row, group, catalog, language, lookup, meaningId, languages, categories, languageName, save, makeId,
}) {
  if (document.getElementById('vocabularyMeaningEditor')) return
  const dialog = control('dialog')
  dialog.id = 'vocabularyMeaningEditor'
  dialog.setAttribute('aria-labelledby', 'vocabularyMeaningEditorTitle')
  const title = control('h2', 'Edit vocabulary')
  title.id = 'vocabularyMeaningEditorTitle'
  const form = control('form')
  const parts = vocabularyLineParts(row.line)
  const groupId = group?.id || makeId()
  const unused = [...(group?.forms || [])]
  const forms = parts.forms.map(text => {
    const index = unused.findIndex(item => normalizeHint(item.text) === normalizeHint(text))
    const previous = index < 0 ? null : unused.splice(index, 1)[0]
    return previous ? { ...previous, text, meanings: [...previous.meanings] } : { id: makeId(), text, meanings: [] }
  })
  const meanings = new Map(Object.entries(catalog.meanings))
  const updates = new Map()
  const status = control('p')
  status.setAttribute('role', 'status')
  const fieldset = control('fieldset')
  const formList = control('div')
  const categorySelect = control('select')
  for (const category of categories) categorySelect.append(new Option(category, category))
  categorySelect.value = row.category
  const groupHints = control('input')
  groupHints.value = parts.hints.join(', ')
  const meaningSelect = control('select')
  const lookupSelect = control('select')
  const hintInput = control('textarea')
  hintInput.rows = 2
  hintInput.dir = 'auto'
  const addForm = button('Add form')
  const newLabel = control('input')
  newLabel.placeholder = 'New meaning'
  newLabel.setAttribute('aria-label', 'New meaning')
  const addMeaning = button('Add meaning')
  const sharedImpact = control('p')
  sharedImpact.className = 'vocab-hint-impact'
  const cancel = button('Cancel')
  const saveButton = button('Save changes', 'submit')
  const actions = control('div')
  actions.className = 'vocab-hint-editor-actions'
  actions.append(cancel, saveButton)
  fieldset.append(control('legend', languageName(language) + ' forms'), formList, addForm)

  for (const code of languages) lookupSelect.append(new Option(languageName(code), code))
  lookupSelect.value = lookup
  const renderMeaningOptions = (selected) => {
    const options = [...meanings].sort((a, b) => a[1].label.localeCompare(b[1].label))
    meaningSelect.replaceChildren(new Option('Choose a meaning', ''), ...options.map(([id, value]) => new Option(value.label, id)))
    meaningSelect.value = meanings.has(selected) ? selected : ''
  }
  function showImpact() {
    const active = meaningSelect.value
    if (!active) { sharedImpact.textContent = ''; return }
    const targets = new Set(Object.entries(catalog.groups).filter(([id, item]) =>
      id !== groupId && item.forms.some(entry => entry.meanings.includes(active))).map(([, item]) => item.language))
    if (forms.some(entry => entry.meanings.includes(active))) targets.add(language)
    sharedImpact.textContent = targets.size
      ? 'Hints apply to linked vocabulary in ' + [...targets].map(languageName).join(', ') + '.'
      : 'Select at least one form to make these hints searchable in this group.'
  }
  function renderForms() {
    const active = meaningSelect.value
    formList.replaceChildren(...forms.map((item, index) => {
      const line = control('div')
      line.className = 'vocab-hint-form'
      const linked = control('input')
      linked.type = 'checkbox'
      linked.checked = item.meanings.includes(active)
      linked.disabled = !active
      linked.setAttribute('aria-label', 'Link form ' + (index + 1) + ' to this meaning')
      linked.onchange = () => {
        item.meanings = linked.checked ? [...item.meanings, active] : item.meanings.filter(id => id !== active)
        showImpact()
      }
      const text = control('input')
      text.value = item.text
      text.dir = 'auto'
      text.required = true
      text.setAttribute('aria-label', 'Vocabulary form ' + (index + 1))
      text.oninput = () => { item.text = text.value }
      const remove = button('Remove')
      remove.setAttribute('aria-label', 'Remove form ' + (index + 1))
      remove.disabled = forms.length === 1
      remove.onclick = () => { forms.splice(index, 1); renderForms(); showImpact() }
      line.append(linked, text, remove)
      return line
    }))
  }
  function renderHints() {
    const selected = meanings.get(meaningSelect.value)
    hintInput.disabled = !selected
    hintInput.value = selected?.hints[lookupSelect.value]?.join(', ') || ''
    showImpact()
  }
  hintInput.oninput = () => {
    const id = meaningSelect.value
    const selected = meanings.get(id)
    const next = { ...selected, hints: { ...selected.hints, [lookupSelect.value]: splitVocabularyHints(hintInput.value) } }
    meanings.set(id, next)
    updates.set(id, next)
  }
  meaningSelect.onchange = () => { renderForms(); renderHints() }
  lookupSelect.onchange = renderHints
  addMeaning.onclick = () => {
    const value = newLabel.value.trim()
    if (!value) { newLabel.focus(); return }
    const id = makeId()
    const meaning = { label: value, hints: {} }
    meanings.set(id, meaning)
    updates.set(id, meaning)
    newLabel.value = ''
    renderMeaningOptions(id)
    renderForms()
    renderHints()
    hintInput.focus()
  }
  addForm.onclick = () => {
    forms.push({ id: makeId(), text: '', meanings: meaningSelect.value ? [meaningSelect.value] : [] })
    renderForms()
    formList.lastElementChild.querySelector('input[type="text"], input:not([type])')?.focus()
    showImpact()
  }
  let saving = false
  cancel.onclick = () => dialog.close()
  dialog.addEventListener('cancel', event => { if (saving) event.preventDefault() })
  dialog.addEventListener('close', () => dialog.remove())
  form.onsubmit = async event => {
    event.preventDefault()
    if (saving) return
    const hints = splitVocabularyHints(groupHints.value)
    const nextForms = forms.map(item => ({ ...item, text: item.text.trim() }))
    const line = [...(hints.length ? ['(' + hints.join(', ') + ')'] : []), ...nextForms.map(item => item.text)].join('|') + '|'
    if (nextForms.some(item => !item.text || /[|\r\n]/u.test(item.text)) ||
        line.startsWith('#') || /[|\r\n]/u.test(groupHints.value) || !isProperlyBracketed(line)) {
      status.textContent = 'Enter one form per row and balance parentheses and brackets.'
      return
    }
    saving = saveButton.disabled = cancel.disabled = true
    status.textContent = 'Saving vocabulary…'
    try {
      await save({ line, groupId, group: { language, category: categorySelect.value, line, forms: nextForms },
        meanings: Object.fromEntries(updates) })
      dialog.close()
    } catch (error) {
      status.textContent = error.message || 'Could not save vocabulary.'
    } finally {
      saving = saveButton.disabled = cancel.disabled = false
    }
  }

  renderMeaningOptions(meaningId || forms.flatMap(item => item.meanings)[0])
  renderForms()
  renderHints()
  form.append(label('Category', categorySelect), label('English group hints', groupHints), fieldset,
    label('Meaning', meaningSelect), newLabel, addMeaning, label('Hint language', lookupSelect),
    label('Search hints and spellings, separated by commas', hintInput), sharedImpact, status, actions)
  dialog.append(title, form)
  document.body.append(dialog)
  dialog.showModal()
}
