// Who an item from the other user's library belongs to, for display only:
// "🔒 Satya" beside a playlist or video that came from the other layer, ''
// for the user's own items and whenever there is no other layer.
//
// An item is a merged srts/index.json entry ({ readOnly, owner }) or a merged
// recordings.json collection ({ readOnly }); both carry readOnly: true only
// when they came from the other user's repo (see data-source.js). The label
// is text for the screen: it must never go into an option value, a key, a
// comparison or anything that is saved.
//
// The name comes from users.json, which strangers write: callers insert it
// with .text()/.attr() or an escape helper, never as raw HTML.

import { cleanName, sameLogin } from './account-state.js'

export const OWNER_LABEL_MAX = 16
export const LOCK = '🔒'

// At most `max` code points (a surrogate pair is never split), with "…"
// when cut.
function capped(s, max) {
  const chars = Array.from(s)
  return chars.length > max ? chars.slice(0, max).join('').trimEnd() + '…' : s
}

// The display name for `login`: its users-list name, else the name stored
// with the account's other entry, else the login itself.
export function ownerName(login, account, users) {
  if (typeof login !== 'string' || !login) return ''
  const u = Array.isArray(users) ? users.find(x => x && sameLogin(x.login, login)) : null
  const other = account && account.other
  const stored = other && sameLogin(other.login, login) ? other.name : null
  const name = cleanName(u && u.name, null) || cleanName(stored, null) || login
  return capped(name, OWNER_LABEL_MAX)
}

// "🔒 <name>" for an item of the other user's library, '' otherwise (own
// items, a missing item, no other layer on the account).
export function ownerLabel(item, account, users) {
  const other = account && account.other
  if (!other || !item || typeof item !== 'object' || item.readOnly !== true) return ''
  const login = typeof item.owner === 'string' && item.owner ? item.owner : other.login
  if (account.login && sameLogin(login, account.login)) return ''
  const name = ownerName(login, account, users)
  return name ? `${LOCK} ${name}` : ''
}

// `text` with the item's label in front ("🔒 Satya · text"), or `text`
// unchanged when the item has no label.
export function withOwnerLabel(text, item, account, users) {
  const label = ownerLabel(item, account, users)
  return label ? `${label} · ${text}` : text
}
