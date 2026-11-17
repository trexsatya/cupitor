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

export function openVocabularyEditor({
  row, language, lookup, hints, languageName, save,
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
  const separator = english ? ', ' : ' | '
  const input = control('input')
  input.value = hints.join(separator)
  input.lang = lookup
  input.dir = 'auto'
  const hintLabel = label(languageName(lookup) + ' hints', input)
  const help = control('small', english ? 'Separate hints with commas.' : 'Separate hints with |.')
  help.id = 'vocabularyHintEditorHelp'
  input.setAttribute('aria-describedby', help.id)

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
    const next = english ? splitVocabularyHints(input.value)
      : [...new Set(input.value.split('|').map(hint => hint.trim()).filter(Boolean))]
    if (next.length === hints.length && next.every((hint, index) => hint === hints[index])) {
      dialog.close()
      return
    }
    saving = input.disabled = saveButton.disabled = cancel.disabled = true
    status.hidden = false
    status.textContent = 'Saving hints…'
    try {
      await save(next)
      dialog.close()
    } catch (error) {
      status.textContent = error.message || 'Could not save hints.'
    } finally {
      saving = input.disabled = saveButton.disabled = cancel.disabled = false
    }
  }

  form.append(forms, hintLabel, help, status, actions)
  dialog.append(title, form)
  document.body.append(dialog)
  dialog.showModal()
}
