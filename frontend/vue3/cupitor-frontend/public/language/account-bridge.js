// The webapp side of the app's AccountBridge channel (Cupitor's
// lib/account/account_bridge.dart, docs/webapp-integration-spec.md §3.9):
//   JS → Dart   AccountBridge.postMessage(JSON.stringify({ op, request_id }))
//               op: 'signIn' | 'signOut' | 'getStatus'
//   Dart → JS   CustomEvent 'cupitorAccountAck' on window (detail also on
//               window.__cupitorAccountAck)
//               detail { request_id, op, ok, error?, data?: { signed_in } }
// Errors: cancelled | denied | expired | network | busy | internal |
// unknown_op, and bad_json (request_id null, never matched here). A signOut
// while a signIn is pending makes that signIn's ack 'cancelled'. The token
// never crosses; after signed_in the page asks GET /user through
// GitHubProxy. In a plain browser the channel is absent.

import { UNAUTHORIZED_AT_KEY } from './account.js'

export const ACK_EVENT = 'cupitorAccountAck'
// Device sign-in can take as long as GitHub's code is valid (15 min).
export const SIGN_IN_TIMEOUT_MS = 16 * 60 * 1000
export const STATUS_TIMEOUT_MS = 5000
// signOut only clears the app's stored token.
export const SIGN_OUT_TIMEOUT_MS = 10000

// error codes: the app's codes, plus 'not_available', 'timeout', 'failed'
// (ok:false with no code) and 'post_failed' (postMessage threw).
export class BridgeError extends Error {
  constructor(code, op, message = code) {
    super(message)
    this.name = 'BridgeError'
    this.code = code
    this.op = op
  }
}

const defaultWindow = () => (typeof window !== 'undefined' ? window : null)
const _pending = new Map()
const _listening = new WeakSet()
let _seq = 0

export function appBridgeAvailable(w = defaultWindow()) {
  try {
    return !!(w && w.AccountBridge && typeof w.AccountBridge.postMessage === 'function')
  } catch (_) { return false }
}

function onAck(e) {
  const a = e && e.detail
  if (!a || typeof a !== 'object' || typeof a.request_id !== 'string') return
  const p = _pending.get(a.request_id)
  if (!p) return // someone else's, a duplicate, or one that already timed out
  _pending.delete(a.request_id)
  clearTimeout(p.timer)
  if (a.ok === true) p.resolve(a.data && typeof a.data === 'object' ? a.data : {})
  else {
    const code = typeof a.error === 'string' && a.error ? a.error : 'failed'
    p.reject(new BridgeError(code, p.op))
  }
}

// Safe to call more than once; bridgeCall calls it itself.
export function installAckListener(w = defaultWindow()) {
  if (!w || typeof w.addEventListener !== 'function' || _listening.has(w)) return
  w.addEventListener(ACK_EVENT, onAck)
  _listening.add(w)
}

// Resolves with the ack's data ({ signed_in }); rejects with a BridgeError.
export function bridgeCall(op, { w = defaultWindow(), timeoutMs = SIGN_IN_TIMEOUT_MS } = {}) {
  if (!appBridgeAvailable(w)) {
    return Promise.reject(new BridgeError('not_available', op, 'In-app sign-in is not available in a browser'))
  }
  installAckListener(w)
  return new Promise((resolve, reject) => {
    const request_id = 'acct-' + (++_seq) + '-' + Date.now().toString(36)
    const timer = setTimeout(() => {
      _pending.delete(request_id)
      reject(new BridgeError('timeout', op, `timeout waiting for ${op}`))
    }, timeoutMs)
    // Registered before posting, so even an immediate ack finds it.
    _pending.set(request_id, { resolve, reject, timer, op })
    try {
      w.AccountBridge.postMessage(JSON.stringify({ op, request_id }))
    } catch (e) {
      clearTimeout(timer)
      if (_pending.delete(request_id)) {
        const err = new BridgeError('post_failed', op, (e && e.message) || 'post_failed')
        err.cause = e
        reject(err)
      }
    }
  })
}

const defaultSession = () => {
  try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null } catch (_) { return null }
}

// After the app signs in, the 401 handler's grace mark (account.js
// UNAUTHORIZED_AT_KEY) would make the boot check answer 'unchecked' for a
// minute; a fresh sign-in drops it so the reload adopts the new login.
export async function requestAppSignIn({ session = defaultSession(), ...opts } = {}) {
  const data = await bridgeCall('signIn', opts)
  if (data.signed_in === true) {
    try { if (session) session.removeItem(UNAUTHORIZED_AT_KEY) } catch (_) {}
  }
  return data
}
export const requestAppSignOut = (opts) => bridgeCall('signOut', { timeoutMs: SIGN_OUT_TIMEOUT_MS, ...opts })
export const requestAppStatus = (opts) => bridgeCall('getStatus', { timeoutMs: STATUS_TIMEOUT_MS, ...opts })
