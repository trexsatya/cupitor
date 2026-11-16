import { openVocabularyMeaningEditor } from './vocabulary-meaning-editor.js'
import { vocabularyHintSeed } from './vocabulary-hint-seed.js'

const id = 'swedish-openings'
const group = vocabularyHintSeed.groups[id]
const original = group.forms.find(form => form.text === 'hål')
const label = (form, text) => [...form.querySelectorAll('label')].find(entry => entry.firstChild.textContent === text)
const byAria = (form, name) => form.querySelector('[aria-label="' + name + '"]')

beforeEach(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false; this.dispatchEvent(new Event('close')) }
})
afterEach(() => { document.body.replaceChildren() })

test('keeps group and form IDs while editing spelling, category and shared aliases', async () => {
  let calls = 0
  const save = jest.fn(async () => {})
  openVocabularyMeaningEditor({
    row: { category: group.category, line: group.line }, group: { ...group, id },
    catalog: vocabularyHintSeed, language: 'sv', lookup: 'hi', meaningId: 'hole-in-surface',
    languages: ['en', 'hi'], categories: [group.category, 'Nouns'],
    languageName: code => ({ sv: 'Swedish', en: 'English', hi: 'Hindi' })[code],
    makeId: () => 'new-' + (++calls), save,
  })
  const form = document.querySelector('#vocabularyMeaningEditor form')
  const category = label(form, 'Category').querySelector('select')
  category.value = 'Nouns'
  const hints = form.querySelector('textarea')
  hints.value = 'छेद, chhed, suraakh'
  hints.dispatchEvent(new Event('input'))
  const word = byAria(form, 'Vocabulary form 3')
  word.value = 'borrhål'
  word.dispatchEvent(new Event('input'))
  form.dispatchEvent(new Event('submit', { cancelable: true }))
  await Promise.resolve()
  expect(save).toHaveBeenCalledTimes(1)
  const update = save.mock.calls[0][0]
  expect(update.groupId).toBe(id)
  expect(update.group.category).toBe('Nouns')
  expect(update.group.forms.find(entry => entry.text === 'borrhål')).toEqual({
    ...original, text: 'borrhål',
  })
  expect(update.meanings['hole-in-surface'].hints.hi).toEqual(['छेद', 'chhed', 'suraakh'])
  expect(document.getElementById('vocabularyMeaningEditor')).toBeNull()
})
