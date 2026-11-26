import { loadAccount, scopedKey, storageOwner } from './account-state.js'
import { captureSourceContext, hasSelf, langFromLocation } from './data-source.js'

// A missing account record identifies the legacy shared library, not the
// person using this device. Never use its owner's personal log or local key.
export function practiceLogLocalKey(language, account = loadAccount()) {
  return scopedKey(`cupitor:practiceLog:${language}`, account)
}

const identity = account => JSON.stringify([
  !!account.legacy, storageOwner(account), account.repo?.toLowerCase(), account.branch,
])

export function capturePracticeLogSession(language = langFromLocation()) {
  const account = loadAccount(), initial = identity(account)
  const context = captureSourceContext(language)
  return Object.freeze({
    key: practiceLogLocalKey(language, account),
    remote: !account.legacy && hasSelf(),
    assertCurrent() {
      context.assertCurrent()
      if (identity(loadAccount()) !== initial)
        throw Object.assign(new Error('The account changed. Reload before opening your practice log.'), { code: 'stale-data-source' })
    },
  })
}
