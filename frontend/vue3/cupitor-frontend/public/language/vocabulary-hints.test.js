import { parseVocabularyFile } from './vocab-merge.js'
import { createVocabularyMatcher } from './vocabulary-matcher.js'
import { vocabularyHintSeed } from './vocabulary-hint-seed.js'
import { assertVocabularyRow, changeVocabularyCatalog, createVocabularyHintIndex,
  mergeVocabularyCatalogs, parseVocabularyCatalog, parseVocabularyHintLanguages, parseVocabularyHintTranslations, reviseVocabularyGroup, vocabularyLineParts } from './vocabulary-hints.js'

const openings = vocabularyHintSeed.groups['swedish-openings']
const eats = vocabularyHintSeed.groups['swedish-eat']
const eatsEs = vocabularyHintSeed.groups['spanish-eat']
const indexFor = (vocab, target, source, catalog = vocabularyHintSeed, translations) =>
  createVocabularyHintIndex(createVocabularyMatcher(vocab, { lang: target }).rows, target, catalog, source, translations)
const indexed = (group, source, catalog = vocabularyHintSeed) =>
  indexFor({ [group.category]: [group.line] }, group.language, source, catalog)

test('indexes whole English cues as one complete vocabulary group per search', () => {
  const index = indexed(openings, 'en')
  expect(index.search(' opening | GAP | opening ').map(r => r.line)).toEqual([openings.line])
  expect([...index.search('opening')[0].forms]).toEqual([])
  expect(index.search('gaping')).toEqual([])
  expect(index.search(' |  ')).toEqual([])
  expect(vocabularyLineParts('(a narrow gap, think (opinion, belief))|springa')).toEqual({
    hints: ['a narrow gap', 'think (opinion, belief)'], forms: ['springa'],
  })
  expect(indexed(openings, 'hi').search('gap')).toEqual([])
  expect(indexFor({ Verbs: ['hacer (do,make)'] }, 'es', 'en').search('make')).toHaveLength(1)
})

test('links native phrases and romanized spellings only to the intended forms and group', () => {
  const vocab = { [openings.category]: [openings.line], Verbs: ['(run)|springa|sprang|'] }
  const index = indexFor(vocab, 'sv', 'hi')
  expect(index.search('छेद')[0].localizedHints).toEqual(['छेद', 'chhed'])
  expect(index.search('CHHED')[0].localizedHints).toEqual(['chhed', 'छेद'])
  expect(index.search('छेद')[0].line).toBe(index.search('CHHED')[0].line)
  expect([...index.search('छेद')[0].forms]).toEqual(['hål'])
  const hits = index.search('  पतली   दरार  ')
  expect(hits).toHaveLength(1)
  expect(hits[0].line).toBe(openings.line)
  expect([...hits[0].forms]).toEqual(['slits', 'springa', 'springor'])
  expect(index.search('दरार')).toEqual([])
  expect(createVocabularyMatcher(vocab).search('hål')[0].line).toBe(openings.line)
})

test('a shared hint change reaches the linked target languages without changing their groups', () => {
  const before = parseVocabularyCatalog(null)
  const meaning = vocabularyHintSeed.meanings['eat-food']
  const updated = changeVocabularyCatalog(null, before, {
    groups: {}, meanings: { 'eat-food': { ...meaning, hints: { ...meaning.hints, hi: ['भोजन करना'] } } },
  })
  const catalog = mergeVocabularyCatalogs(vocabularyHintSeed, updated)
  for (const [group, form] of [[eats, 'äta'], [eatsEs, 'comer']]) {
    const index = indexed(group, 'hi', catalog)
    expect(index.search('खाना')).toEqual([])
    expect(index.search('भोजन करना')[0].forms.has(form)).toBe(true)
  }
})

test('retains a renamed form ID, drops removed forms and hides links for a removed group', () => {
  const corrected = reviseVocabularyGroup(openings, openings.line, {
    category: 'Nouns', line: openings.line.replace('hål', 'borrhål'),
  })
  const group = reviseVocabularyGroup(corrected, corrected.line, {
    category: 'Nouns', line: '(opening, gap)|borrhål|öppning|spalt|',
  })
  expect(group.forms.map(form => form.text)).toEqual(['öppning', 'borrhål'])
  const parsed = parseVocabularyCatalog(JSON.stringify({
    version: 1, groups: { 'swedish-openings': group }, meanings: {},
  }))
  const catalog = mergeVocabularyCatalogs(vocabularyHintSeed, parsed)
  const index = indexed(group, 'hi', catalog)
  expect([...index.search('chhed')[0].forms]).toEqual(['borrhål'])
  expect(index.groupFor(0).forms.find(form => form.text === 'borrhål').id).toBe(openings.forms.find(form => form.text === 'hål').id)
  expect(index.search('पतली दरार')).toEqual([])
  expect(indexFor({}, 'sv', 'hi', catalog).search('chhed')).toEqual([])
})

test('live vocabulary changes are re-indexed and an ambiguous modified row gets no seeded link', () => {
  const vocab = parseVocabularyFile('#' + openings.category + '\n' + openings.line.replace('springor', 'springor|spalt'))
  expect(indexFor(vocab, 'sv', 'hi').search('chhed')).toHaveLength(1)
  expect(indexFor(vocab, 'sv', 'en').search('gap')).toHaveLength(1)
  vocab[openings.category].push('(opening, gap)|hål|other|')
  expect(indexFor(vocab, 'sv', 'hi').search('chhed')).toHaveLength(0)
  expect(indexFor(vocab, 'sv', 'en').search('gap')).toHaveLength(2)
})

test('changes to a legacy cue do not erase a unique native-language link', () => {
  const revised = openings.line.replace('opening, gap', 'physical opening')
  const vocab = { [openings.category]: [revised] }
  expect(indexFor(vocab, 'sv', 'en').search('opening')).toEqual([])
  expect(indexFor(vocab, 'sv', 'en').search('physical opening')[0].line).toBe(revised)
  expect([...indexFor(vocab, 'sv', 'hi').search('chhed')[0].forms]).toEqual(['hål'])
})

test('rejects conflicting updates to a meaning or vocabulary row', () => {
  const baseline = parseVocabularyCatalog(null)
  const first = changeVocabularyCatalog(null, baseline, {
    groups: {}, meanings: { test: { label: 'First edit', hints: {} } },
  })
  expect(() => changeVocabularyCatalog(JSON.stringify(first), baseline, {
    groups: {}, meanings: { test: { label: 'Second edit', hints: {} } },
  })).toThrow(/changed/)
  expect(() => assertVocabularyRow('#Nouns\n(hole)|new|', '#Nouns\n(hole)|old|', 'Nouns', '(hole)|old|')).toThrow(/changed/)
})

test('a whole-group Hindi hint finds the row without inventing specific word matches', () => {
  const line = '(chair)|stol|stolar|'
  const group = { language:'sv', category:'Objects', line, forms:[], meanings:['chair'] }
  const base = parseVocabularyCatalog(JSON.stringify({ version:1,
    meanings:{ chair:{ label:'Chair', hints:{ hi:['कुर्सी'] } } }, groups:{ chairs:group } }))
  const hit = indexed(group,'hi',base).search('कुर्सी')[0]
  expect(hit.line).toBe(line)
  expect([...hit.forms]).toEqual([])
  const revision = mergeVocabularyCatalogs(base, { meanings:{ chair:{ label:'Chair', hints:{ hi:['बैठने की कुर्सी'] } } },
    groups:{ chairs:{ ...group, line:'(chair)|stol|stolar|stolen|' } } })
  const updated = indexed(revision.groups.chairs,'hi',revision)
  expect(updated.search('कुर्सी')).toEqual([])
  expect(updated.search('बैठने की कुर्सी')[0].line).toContain('stolen')
})

test('parses separate pipe files with commas, aliases and stable English keys', () => {
  const hindi = parseVocabularyHintTranslations('# Hindi\nDRINK = पीना | peena\ndrink = पीना | pina\nyes, of course = हाँ, ज़रूर\n', 'hi')
  const french = parseVocabularyHintTranslations('drink = boire', 'fr')
  expect([...hindi]).toEqual([['drink', ['पीना', 'peena', 'pina']], ['yes, of course', ['हाँ, ज़रूर']]])
  expect([...french]).toEqual([['drink', ['boire']]])
  expect(parseVocabularyHintLanguages('hi\n# comment\nfr\n../../fr\nfr\n')).toEqual(['hi', 'fr'])
})

test('new lines in any study language inherit translations from the same English cue', () => {
  const hints = parseVocabularyHintTranslations('Drink = पीना | peena\ndrink water = पानी पीना', 'hi')
  const noMeanings = mergeVocabularyCatalogs()
  const sv = { Food: ['(drink)|dricka|drack|', '(drink water)|dricka vatten|'] }
  sv.Food.push('( drink )|klunka|')
  const swedish = indexFor(sv, 'sv', 'hi', noMeanings, hints)
  const spanish = indexFor({ Food: ['(drink)|beber|tomar|'] }, 'es', 'hi', noMeanings, hints)
  expect(swedish.search('peena').map(result => result.line)).toEqual([sv.Food[0], sv.Food[2]])
  expect(swedish.search('पानी पीना').map(result => result.line)).toEqual([sv.Food[1]])
  expect(spanish.search('peena')[0]).toMatchObject({ line: '(drink)|beber|tomar|', localizedHints: ['peena','पीना'] })
  expect(spanish.search('पीना')[0].localizedHints).toEqual(['पीना','peena'])
  expect(spanish.groupFor(0)).toBeUndefined()
})

test('a localized whole-group override keeps an ambiguous English cue precise', () => {
  const line = '(gap)|löneskillnad|'
  const catalog = parseVocabularyCatalog(JSON.stringify({ version:1,
    meanings:{ pay:{ label:'Pay gap', hints:{ hi:['वेतन में अंतर'] } } },
    groups:{ wages:{ language:'sv', category:'Wages', line, forms:[], meanings:['pay'] } },
  }))
  const hints = parseVocabularyHintTranslations('gap = खाली जगह', 'hi')
  const index = indexFor({ Wages:[line], Physical:['(gap)|mellanrum|'] }, 'sv','hi',catalog,hints)
  expect(index.search('खाली जगह').map(result => result.line)).toEqual(['(gap)|mellanrum|'])
  expect(index.search('वेतन में अंतर').map(result => result.line)).toEqual([line])
})

test('displays the shared spellings when a curated form also matches', () => {
  const group = vocabularyHintSeed.groups['swedish-drink']
  const hints = parseVocabularyHintTranslations('drink = पीना | peena', 'hi')
  const index = indexFor({ [group.category]: [group.line] }, 'sv', 'hi', vocabularyHintSeed, hints)
  expect(index.search('peena')[0].localizedHints).toEqual(['peena','पीना'])
  expect([...index.search('peena')[0].forms]).toContain('dricka')
  expect(index.search('पानी पीना')[0].localizedHints[0]).toBe('पानी पीना')
})
