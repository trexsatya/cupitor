import { ownerLabel, ownerName, withOwnerLabel, OWNER_LABEL_MAX } from './owner-label.js'

const SATYA = { login: 'trexsatya', name: 'Satya', repo: 'trexsatya.github.io', branch: 'gh-pages' }
const ALICE = { login: 'alice', repo: 'cupitor-data', branch: 'main', other: SATYA }
const OWNER_ALONE = { login: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages', other: null }
const GUEST = { login: null, repo: null, branch: null, other: SATYA }
const USERS = [SATYA, { login: 'alice', name: 'Alice A', repo: 'cupitor-data', branch: 'main' }]
const ch = cp => String.fromCodePoint(cp)

describe('ownerLabel', () => {
  test('an index entry from the other layer → lock and the users-list name', () => {
    expect(ownerLabel({ link: 'x', readOnly: true, owner: 'trexsatya', src: 'other' }, ALICE, USERS)).toBe('🔒 Satya')
  })
  test('a playlist from the other layer (no owner field) → the account other', () => {
    expect(ownerLabel({ items: {}, readOnly: true, src: 'other' }, ALICE, USERS)).toBe('🔒 Satya')
  })
  test('own items are unlabelled', () => {
    expect(ownerLabel({ link: 'x', readOnly: false, owner: 'alice', src: 'self' }, ALICE, USERS)).toBe('')
    expect(ownerLabel({ items: {} }, ALICE, USERS)).toBe('')
  })
  test('no other layer → never a label, even for a stray readOnly flag', () => {
    expect(ownerLabel({ link: 'x', readOnly: true, owner: 'bob' }, OWNER_ALONE, USERS)).toBe('')
    expect(ownerLabel({ link: 'x', readOnly: true }, null, USERS)).toBe('')
  })
  test('readOnly must be exactly true', () => {
    expect(ownerLabel({ readOnly: 'yes' }, ALICE, USERS)).toBe('')
    expect(ownerLabel({ readOnly: 1 }, ALICE, USERS)).toBe('')
  })
  test('missing or odd items are unlabelled', () => {
    for (const it of [null, undefined, 'x', 3]) expect(ownerLabel(it, ALICE, USERS)).toBe('')
  })
  test('a guest sees the label on the owner library', () => {
    expect(ownerLabel({ readOnly: true, owner: 'trexsatya' }, GUEST, null)).toBe('🔒 Satya')
  })
  test('an item owned by the signed-in login is never labelled', () => {
    expect(ownerLabel({ readOnly: true, owner: 'Alice' }, ALICE, USERS)).toBe('')
  })
  test('no users list → the name stored with the account other', () => {
    expect(ownerLabel({ readOnly: true }, { ...ALICE, other: { ...SATYA, name: 'Satya K' } }, null)).toBe('🔒 Satya K')
  })
  test('no name anywhere → the login', () => {
    const acc = { ...ALICE, other: { login: 'bob', repo: 'r', branch: 'main' } }
    expect(ownerLabel({ readOnly: true }, acc, [])).toBe('🔒 bob')
  })
})

describe('ownerName', () => {
  test('logins compare without case', () => {
    expect(ownerName('TrexSatya', ALICE, USERS)).toBe('Satya')
  })
  test('the users-list name wins over the stored one', () => {
    expect(ownerName('trexsatya', { other: { ...SATYA, name: 'Old' } }, USERS)).toBe('Satya')
  })
  test('long names are cut with an ellipsis, surrogate pairs kept whole', () => {
    const long = '😀'.repeat(40)
    const out = ownerName('bob', null, [{ login: 'bob', name: long }])
    const chars = Array.from(out)
    expect(chars).toHaveLength(OWNER_LABEL_MAX + 1)
    expect(chars[chars.length - 1]).toBe('…')
    expect(chars.slice(0, -1).every(c => c === '😀')).toBe(true)
  })
  test('control and bidi characters are stripped; a blank name falls back to the login', () => {
    expect(ownerName('bob', null, [{ login: 'bob', name: 'B' + ch(0x202e) + 'ob' + ch(7) }])).toBe('Bob')
    expect(ownerName('bob', null, [{ login: 'bob', name: '   ' }])).toBe('bob')
    expect(ownerName('bob', null, [{ login: 'bob', name: 42 }])).toBe('bob')
  })
  test('markup is returned as text (the caller escapes it)', () => {
    expect(ownerName('bob', null, [{ login: 'bob', name: '<b>x</b>' }])).toBe('<b>x</b>')
  })
  test('no login → empty', () => {
    expect(ownerName('', ALICE, USERS)).toBe('')
    expect(ownerName(null, ALICE, USERS)).toBe('')
  })
})

describe('withOwnerLabel', () => {
  test('prefixes the label for other items, leaves own text unchanged', () => {
    expect(withOwnerLabel('Verbs (3)', { readOnly: true }, ALICE, USERS)).toBe('🔒 Satya · Verbs (3)')
    expect(withOwnerLabel('Verbs (3)', { items: {} }, ALICE, USERS)).toBe('Verbs (3)')
    expect(withOwnerLabel('Verbs (3)', { readOnly: true }, OWNER_ALONE, USERS)).toBe('Verbs (3)')
  })
})
