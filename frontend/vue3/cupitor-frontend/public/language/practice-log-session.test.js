import { loadAccount, saveAccount, saveGuest } from './account-state.js'
import { configure } from './data-source.js'
import { capturePracticeLogSession, practiceLogLocalKey } from './practice-log-session.js'

const owner = { login: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages', other: null }
const alice = { login: 'alice', repo: 'data', branch: 'main', other: { login: owner.login, repo: owner.repo, branch: owner.branch } }
beforeEach(() => { localStorage.clear(); configure(null) })
afterEach(() => { localStorage.clear(); configure(null) })

test('an unidentified visitor never reads or writes the owner local key', () => {
  localStorage.setItem('cupitor:practiceLog:swedish', 'Owner only')
  const session = capturePracticeLogSession('swedish')
  expect(session.key).toBe('cupitor:practiceLog:swedish@~guest')
  expect(session.remote).toBe(false)
  expect(localStorage.getItem(session.key)).toBeNull()
  expect(localStorage.getItem('cupitor:practiceLog:swedish')).toBe('Owner only')
})

test('signed-in users and guests retain distinct log keys; the selected shared library does not become self', () => {
  for (const account of [owner, alice, { ...alice, repo: null, branch: null }, { login: null, other: alice.other }]) {
    saveAccount(account); configure(loadAccount())
    const session = capturePracticeLogSession('swedish')
    expect(session.key).toBe(practiceLogLocalKey('swedish', loadAccount()))
    expect(session.remote).toBe(!!account.login && !!account.repo)
  }
})

test('account changes invalidate an open log before source configuration catches up', () => {
  saveAccount(alice); configure(loadAccount())
  const session = capturePracticeLogSession('swedish')
  saveGuest()
  expect(() => session.assertCurrent()).toThrow(/account changed/)
})

test('confirming the owner identity invalidates an anonymous log rather than merging it into owner data', () => {
  const session = capturePracticeLogSession('swedish')
  saveAccount(owner)
  expect(() => session.assertCurrent()).toThrow(/account changed/)
  configure(loadAccount())
  expect(capturePracticeLogSession('swedish').key).toBe('cupitor:practiceLog:swedish')
})

test('same-tab account mutations notify open personal views', () => {
  const changed = jest.fn()
  window.addEventListener('cupitor:account-changed', changed)
  try { saveAccount(alice); saveGuest(); expect(changed).toHaveBeenCalledTimes(2) }
  finally { window.removeEventListener('cupitor:account-changed', changed) }
})
