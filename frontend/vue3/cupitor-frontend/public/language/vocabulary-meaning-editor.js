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

export function openVocabularyEditor({
  row, language, lookup, categories, languageName, translations, groupHintOverride, save,
}) {
  if (document.getElementById('vocabularyMeaningEditor')) return
  const dialog = control('dialog')
  dialog.id = 'vocabularyMeaningEditor'
  dialog.setAttribute('aria-labelledby', 'vocabularyMeaningEditorTitle')
  const title = control('h2', 'Edit vocabulary')
  title.id = 'vocabularyMeaningEditorTitle'
  const form = control('form')
  const parts = vocabularyLineParts(row.line)

  const category = control('select')
  for (const name of new Set([row.category, ...categories])) category.append(new Option(name, name))
  category.value = row.category

  const english = control('input')
  english.value = parts.hints.join(', ')
  const forms = control('textarea')
  forms.value = parts.forms.join(' | ')
  forms.required = true
  forms.rows = 2
  forms.lang = language
  forms.dir = 'auto'
  forms.setAttribute('aria-describedby', 'vocabularyFormsHelp')
  const formsHelp = control('small', 'Separate forms with |')
  formsHelp.id = 'vocabularyFormsHelp'

  const preview = control('div')
  preview.className = 'vocab-hint-preview'
  preview.setAttribute('aria-live', 'polite')
  const previewTitle = control('span', groupHintOverride
    ? languageName(lookup) + ' hints for this line'
    : 'Shared ' + languageName(lookup) + ' hints')
  const previewValues = control('div')
  preview.append(previewTitle, previewValues)

  function refreshPreview() {
    const hints = groupHintOverride
      ? [[null, groupHintOverride]]
      : splitVocabularyHints(english.value).map(cue => [cue, translations?.get(normalizeHint(cue, 'en'))])
    const matches = hints.filter(([, values]) => values?.length)
    preview.hidden = lookup === 'en' || matches.length === 0
    previewValues.replaceChildren(...matches.map(([cue, values]) => {
      const line = control('div')
      if (matches.length > 1 && cue) line.append(document.createTextNode(cue + ' · '))
      const value = control('span', values.join(' | '))
      value.lang = lookup
      line.append(value)
      return line
    }))
  }

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
  english.addEventListener('input', refreshPreview)
  form.onsubmit = async event => {
    event.preventDefault()
    if (saving) return
    const hints = splitVocabularyHints(english.value)
    const nextForms = forms.value.split('|').map(value => value.trim()).filter(Boolean)
    const written = [...(hints.length ? ['(' + hints.join(', ') + ')'] : []), ...nextForms].join('|') + '|'
    if (!nextForms.length || nextForms.some(value => /[\r\n]/u.test(value)) || written.startsWith('#') ||
        /[|\r\n]/u.test(english.value) || !isProperlyBracketed(written)) {
      status.hidden = false
      status.textContent = 'Enter forms separated by | and balance parentheses and brackets.'
      return
    }
    const sameWords = nextForms.length === parts.forms.length && nextForms.every((value, i) => value === parts.forms[i])
    const sameHints = hints.length === parts.hints.length && hints.every((value, i) => value === parts.hints[i])
    // A category-only move can keep the exact line, including older vocabulary syntax.
    const line = sameWords && sameHints ? row.line : written
    saving = saveButton.disabled = cancel.disabled = true
    status.hidden = false
    status.textContent = 'Saving vocabulary…'
    try {
      await save({ category: category.value, line })
      dialog.close()
    } catch (error) {
      status.textContent = error.message || 'Could not save vocabulary.'
    } finally {
      saving = saveButton.disabled = cancel.disabled = false
    }
  }

  refreshPreview()
  const formsLabel = label(languageName(language) + ' forms', forms)
  formsLabel.append(formsHelp)
  form.append(label('Category', category), label('English hints', english), preview, formsLabel, status, actions)
  dialog.append(title, form)
  document.body.append(dialog)
  dialog.showModal()
}
