import { splitVocabularyHints, vocabularyLineParts } from './vocabulary-hints.js'

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

function hintInput(hints, language) {
  const input = control('input')
  input.value = hints.join(language === 'en' ? ', ' : ' | ')
  input.lang = language
  input.dir = 'auto'
  input.setAttribute('aria-describedby', 'vocabularyHintEditorHelp')
  return input
}

const splitLocalizedHints = value => [...new Set(value.split('|').map(hint => hint.trim()).filter(Boolean))]
const equalHints = (left, right) => left.length === right.length && left.every((hint, index) => hint === right[index])

export function openVocabularyEditor({
  row, language, lookup, hints, hasOverride = false, sharedHints = [], needsReview = false, languageName, save,
}) {
  if (document.getElementById('vocabularyMeaningEditor')) return
  const dialog = control('dialog')
  dialog.id = 'vocabularyMeaningEditor'
  dialog.setAttribute('aria-labelledby', 'vocabularyMeaningEditorTitle')
  const title = control('h2', 'Edit vocabulary hints')
  title.id = 'vocabularyMeaningEditorTitle'
  const form = control('form')
  const parts = vocabularyLineParts(row.line)

  const forms = control('p', parts.forms.join(' · '))
  forms.className = 'vocab-hint-editor-forms'
  forms.lang = language
  forms.dir = 'auto'

  const english = lookup === 'en'
  const name = languageName(lookup)
  const input = hintInput(hints, lookup)
  const lineLabel = label(english ? 'English hints' : name + ' hints for this line', input)
  const help = control('small', english ? 'Separate hints with commas.' : 'Separate hints with |.')
  if (needsReview) help.textContent += ' This entry changed. Check the translation before saving; it is hidden until reviewed.'
  help.id = 'vocabularyHintEditorHelp'
  const useCatalog = button('Use catalog hints')
  useCatalog.hidden = !hasOverride
  let reset = false
  useCatalog.onclick = () => {
    reset = true
    input.value = ''
    input.placeholder = 'Using catalog hints'
    input.focus()
  }
  input.addEventListener('input', () => {
    reset = false
    input.placeholder = ''
  })
  const shared = control('fieldset')
  shared.className = 'vocab-hint-editor-shared'
  shared.append(control('legend', 'Shared ' + name + ' catalog'), control('small', 'Applies to entries with the same English hint.'))
  const translations = sharedHints.map(({ cue, hints }) => {
    const field = hintInput(hints, lookup)
    shared.append(label(cue, field))
    return { cue, field, hints }
  })

  const status = control('p')
  status.setAttribute('role', 'status')
  status.hidden = true
  const cancel = button('Cancel')
  const saveButton = button('Save changes', 'submit')
  const actions = control('div')
  actions.className = 'vocab-hint-editor-actions'
  actions.append(cancel, saveButton)

  let saving = false
  cancel.onclick = () => dialog.close()
  dialog.addEventListener('cancel', event => { if (saving) event.preventDefault() })
  dialog.addEventListener('close', () => dialog.remove())
  form.onsubmit = async event => {
    event.preventDefault()
    if (saving) return
    const next = english ? splitVocabularyHints(input.value) : splitLocalizedHints(input.value)
    const lineHints = reset ? null : !needsReview && equalHints(next, hints) ? undefined : next
    const sharedChanges = translations.map(({ cue, field, hints }) => ({ cue, hints, next: splitLocalizedHints(field.value) }))
      .filter(({ hints, next }) => !equalHints(hints, next))
      .map(({ cue, next }) => [cue, next])
    if (lineHints === undefined && !sharedChanges.length) {
      dialog.close()
      return
    }
    saving = input.disabled = useCatalog.disabled = shared.disabled = saveButton.disabled = cancel.disabled = true
    status.hidden = false
    status.textContent = 'Saving hints…'
    try {
      await save(lineHints, sharedChanges)
      dialog.close()
    } catch (error) {
      status.textContent = error.message || 'Could not save hints.'
    } finally {
      saving = input.disabled = useCatalog.disabled = shared.disabled = saveButton.disabled = cancel.disabled = false
    }
  }

  form.append(forms, lineLabel, help, useCatalog)
  if (translations.length) form.append(shared)
  form.append(status, actions)
  dialog.append(title, form)
  document.body.append(dialog)
  dialog.showModal()
}
