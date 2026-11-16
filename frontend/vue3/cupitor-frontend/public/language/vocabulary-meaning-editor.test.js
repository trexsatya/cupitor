import { openVocabularyEditor } from './vocabulary-meaning-editor.js'

function openEditor(options = {}) {
  const save = jest.fn(async () => {})
  openVocabularyEditor({
    row: { category: 'Food', line: '(drink)|dricka|dricker|drack|druckit|' },
    language: 'sv', lookup: 'hi', categories: ['Food', 'Verbs'],
    languageName: code => ({ sv: 'Swedish', es: 'Spanish', en: 'English', hi: 'Hindi' })[code],
    translations: new Map([['drink', ['पीना', 'peena']], ['drink water', ['पानी पीना']]]),
    save, ...options,
  })
  return { form: document.querySelector('#vocabularyMeaningEditor form'), save }
}

function submit(form) {
  form.dispatchEvent(new Event('submit', { cancelable: true }))
  return Promise.resolve()
}

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')) }
})
afterEach(() => { document.body.replaceChildren() })

test('edits three fields and previews shared Hindi hints for the English cue', async () => {
  const { form, save } = openEditor()
  expect([...form.querySelectorAll('label')].map(label => label.firstChild.textContent))
    .toEqual(['Category', 'English hints', 'Swedish forms'])
  const preview = form.querySelector('.vocab-hint-preview')
  expect(preview.hidden).toBe(false)
  expect(preview.textContent).toContain('पीना | peena')
  const english = form.querySelector('input')
  english.value = 'drink water'
  english.dispatchEvent(new Event('input'))
  expect(preview.textContent).toContain('पानी पीना')
  expect(preview.textContent).not.toContain('peena')

  form.querySelector('select').value = 'Verbs'
  form.querySelector('textarea').value = 'dricka vatten | dricker vatten'
  await submit(form)
  expect(save).toHaveBeenCalledWith({ category: 'Verbs', line: '(drink water)|dricka vatten|dricker vatten|' })
  expect(document.getElementById('vocabularyMeaningEditor')).toBeNull()
})

test('retains the original vocabulary syntax when only the category changes', async () => {
  const { form, save } = openEditor({
    row: { category: 'Food', line: 'tener (have)' }, language: 'es', lookup: 'en',
  })
  expect(form.querySelector('.vocab-hint-preview').hidden).toBe(true)
  form.querySelector('select').value = 'Verbs'
  await submit(form)
  expect(save).toHaveBeenCalledWith({ category: 'Verbs', line: 'tener (have)' })
})
