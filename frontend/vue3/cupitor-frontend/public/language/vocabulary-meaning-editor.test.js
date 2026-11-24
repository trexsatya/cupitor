import { openVocabularyEditor } from './vocabulary-meaning-editor.js'

function openEditor(options = {}) {
  const save = jest.fn(async () => {})
  openVocabularyEditor({
    row: { category: 'Food', line: '(drink)|dricka|dricker|drack|druckit|' },
    language: 'sv', lookup: 'hi', hints: ['पीना', 'peena'],
    languageName: code => ({ sv: 'Swedish', es: 'Spanish', en: 'English', hi: 'Hindi' })[code],
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

test('edits only the familiar-language hints and shows the forms as context', async () => {
  const { form, save } = openEditor()
  expect([...form.querySelectorAll('label')].map(label => label.firstChild.textContent)).toEqual(['Hindi hints for this line'])
  expect(form.querySelector('.vocab-hint-editor-forms').textContent).toBe('dricka · dricker · drack · druckit')
  expect(form.querySelector('select, textarea')).toBeNull()
  const input = form.querySelector('input')
  expect(input.lang).toBe('hi')
  expect(input.value).toBe('पीना | peena')
  input.value = 'पानी पीना | pee lena'
  await submit(form)
  expect(save).toHaveBeenCalledWith(['पानी पीना', 'pee lena'], [])
  expect(document.getElementById('vocabularyMeaningEditor')).toBeNull()
})

test('uses commas for English hints and keeps parenthetical qualifiers', async () => {
  const { form, save } = openEditor({ lookup: 'en', hints: ['drink'] })
  const input = form.querySelector('input')
  expect(input.value).toBe('drink')
  input.value = 'drink (water, tea), sip'
  await submit(form)
  expect(save).toHaveBeenCalledWith(['drink (water, tea)', 'sip'], [])
})

test('skips writes for unchanged hints and lets the user clear hints', async () => {
  const unchanged = openEditor()
  await submit(unchanged.form)
  expect(unchanged.save).not.toHaveBeenCalled()
  const { form, save } = openEditor()
  form.querySelector('input').value = ''
  await submit(form)
  expect(save).toHaveBeenCalledWith([], [])
})

test('edits each shared English cue independently of the line override', async () => {
  const { form, save } = openEditor({ sharedHints: [
    { cue: 'drink', hints: ['पीना'] }, { cue: 'sip', hints: ['घूँट लेना'] },
  ] })
  const shared = form.querySelector('fieldset')
  expect(shared.querySelector('legend').textContent).toBe('Shared Hindi catalog')
  const [drink, sip] = shared.querySelectorAll('input')
  expect(drink.value).toBe('पीना')
  sip.value = 'चुस्की लेना | chuski lena'
  await submit(form)
  expect(save).toHaveBeenCalledWith(undefined, [['sip', ['चुस्की लेना', 'chuski lena']]])
})

test('can remove an explicit empty override to use the catalog', async () => {
  const { form, save } = openEditor({ hints: [], hasOverride: true })
  const reset = [...form.querySelectorAll('button')].find(button => button.textContent === 'Use catalog hints')
  expect(reset.hidden).toBe(false)
  reset.click()
  await submit(form)
  expect(save).toHaveBeenCalledWith(null, [])
})

test('reviewing an unchanged translation still records approval for this language', async () => {
  const { form, save } = openEditor({ needsReview: true })
  expect(form.querySelector('#vocabularyHintEditorHelp').textContent).toContain('hidden until reviewed')
  await submit(form)
  expect(save).toHaveBeenCalledWith(['पीना', 'peena'], [])
})
