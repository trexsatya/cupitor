import {
  appBridgeAvailable, installAckListener, bridgeCall, BridgeError,
  requestAppSignIn, requestAppSignOut, requestAppStatus,
  ACK_EVENT, SIGN_IN_TIMEOUT_MS, STATUS_TIMEOUT_MS, SIGN_OUT_TIMEOUT_MS,
} from './account-bridge.js'
import { UNAUTHORIZED_AT_KEY } from './account.js'

function fakeWindow() {
  const listeners = {}
  const w = {
    AccountBridge: { postMessage: jest.fn() },
    addEventListener: jest.fn((n, fn) => { (listeners[n] = listeners[n] || []).push(fn) }),
    dispatchEvent: (ev) => { (listeners[ev.type] || []).forEach(fn => fn(ev)) },
  }
  // Like the app: the global is set just before the dispatch.
  w.ack = (detail) => { w.__cupitorAccountAck = detail; w.dispatchEvent({ type: ACK_EVENT, detail }) }
  w.listenerCount = () => (listeners[ACK_EVENT] || []).length
  return w
}
const sent = (w, i = 0) => JSON.parse(w.AccountBridge.postMessage.mock.calls[i][0])
function fakeStorage(init = {}) {
  const m = new Map(Object.entries(init))
  return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: k => m.delete(k), m }
}

afterEach(() => { jest.useRealTimers() })

describe('appBridgeAvailable', () => {
  test('only when the channel has a postMessage function', () => {
    expect(appBridgeAvailable(null)).toBe(false)
    expect(appBridgeAvailable({})).toBe(false)
    expect(appBridgeAvailable({ AccountBridge: {} })).toBe(false)
    expect(appBridgeAvailable({ AccountBridge: { postMessage: 'x' } })).toBe(false)
    expect(appBridgeAvailable(fakeWindow())).toBe(true)
  })
  test('a throwing getter counts as absent', () => {
    const w = {}
    Object.defineProperty(w, 'AccountBridge', { get() { throw new Error('nope') } })
    expect(appBridgeAvailable(w)).toBe(false)
  })
})

describe('bridgeCall', () => {
  test('no channel → rejects with "not available" and code not_available', async () => {
    await expect(bridgeCall('signIn', { w: {} })).rejects.toThrow(/not available/)
    await expect(bridgeCall('signIn', { w: {} })).rejects.toMatchObject({ code: 'not_available' })
  })

  test('signIn posts {op, request_id} as a JSON string and resolves with the ack data', async () => {
    const w = fakeWindow()
    const p = requestAppSignIn({ w, session: fakeStorage() })
    expect(typeof w.AccountBridge.postMessage.mock.calls[0][0]).toBe('string')
    const msg = sent(w)
    expect(msg).toEqual({ op: 'signIn', request_id: expect.stringMatching(/^acct-/) })
    w.ack({ request_id: 'someone-else', op: 'signIn', ok: true, data: { signed_in: false } }) // ignored
    w.ack({ request_id: msg.request_id, op: 'signIn', ok: true, data: { signed_in: true } })
    expect(await p).toEqual({ signed_in: true })
  })

  test('installs its own listener once per window (installAckListener is idempotent)', async () => {
    const w = fakeWindow()
    installAckListener(w); installAckListener(w)
    const p1 = bridgeCall('getStatus', { w })
    const p2 = bridgeCall('getStatus', { w })
    expect(w.listenerCount()).toBe(1)
    w.ack({ request_id: sent(w, 0).request_id, op: 'getStatus', ok: true, data: { signed_in: false } })
    w.ack({ request_id: sent(w, 1).request_id, op: 'getStatus', ok: true, data: { signed_in: true } })
    await expect(p1).resolves.toEqual({ signed_in: false })
    await expect(p2).resolves.toEqual({ signed_in: true })
  })

  test('acks out of order go to the right request; request ids are unique', async () => {
    const w = fakeWindow()
    const a = bridgeCall('signOut', { w })
    const b = bridgeCall('getStatus', { w })
    const [ma, mb] = [sent(w, 0), sent(w, 1)]
    expect(ma.request_id).not.toBe(mb.request_id)
    w.ack({ request_id: mb.request_id, op: 'getStatus', ok: true, data: { signed_in: true } })
    w.ack({ request_id: ma.request_id, op: 'signOut', ok: true, data: { signed_in: false } })
    await expect(a).resolves.toEqual({ signed_in: false })
    await expect(b).resolves.toEqual({ signed_in: true })
  })

  test('a duplicate ack is ignored after the first settles the call', async () => {
    const w = fakeWindow()
    const p = bridgeCall('getStatus', { w })
    const id = sent(w).request_id
    w.ack({ request_id: id, op: 'getStatus', ok: true, data: { signed_in: true } })
    expect(() => w.ack({ request_id: id, op: 'getStatus', ok: false, error: 'internal' })).not.toThrow()
    await expect(p).resolves.toEqual({ signed_in: true })
  })

  test('ok:false rejects with a BridgeError carrying the code', async () => {
    const w = fakeWindow()
    const p = requestAppSignOut({ w })
    w.ack({ request_id: sent(w).request_id, op: 'signOut', ok: false, error: 'internal' })
    await expect(p).rejects.toThrow('internal')
    await expect(p).rejects.toBeInstanceOf(BridgeError)
    await expect(p).rejects.toMatchObject({ code: 'internal', op: 'signOut' })
  })

  test.each(['cancelled', 'denied', 'expired', 'network', 'busy', 'internal', 'unknown_op'])(
    'signIn error %s is passed through as the code', async (code) => {
      const w = fakeWindow()
      const p = requestAppSignIn({ w, session: fakeStorage() })
      w.ack({ request_id: sent(w).request_id, op: 'signIn', ok: false, error: code })
      await expect(p).rejects.toMatchObject({ code })
    })

  test('ok:false without an error code → code "failed"', async () => {
    const w = fakeWindow()
    const p = bridgeCall('getStatus', { w })
    w.ack({ request_id: sent(w).request_id, op: 'getStatus', ok: false })
    await expect(p).rejects.toMatchObject({ code: 'failed' })
  })

  test('the bad_json ack (request_id null) and malformed events settle nothing', async () => {
    jest.useFakeTimers()
    const w = fakeWindow()
    const p = bridgeCall('getStatus', { w, timeoutMs: 1000 })
    w.ack({ request_id: null, op: 'unknown', ok: false, error: 'bad_json' })
    w.dispatchEvent({ type: ACK_EVENT })
    w.dispatchEvent({ type: ACK_EVENT, detail: 'junk' })
    w.dispatchEvent({ type: ACK_EVENT, detail: null })
    jest.advanceTimersByTime(1001)
    await expect(p).rejects.toMatchObject({ code: 'timeout' })
  })

  test('times out with code timeout; a late ack is then ignored', async () => {
    jest.useFakeTimers()
    const w = fakeWindow()
    const p = bridgeCall('getStatus', { w, timeoutMs: 1000 })
    jest.advanceTimersByTime(999)
    jest.advanceTimersByTime(2)
    await expect(p).rejects.toThrow(/timeout/)
    expect(() => w.ack({ request_id: sent(w).request_id, op: 'getStatus', ok: true, data: { signed_in: true } })).not.toThrow()
  })

  test('the ack clears the timer', async () => {
    jest.useFakeTimers()
    const w = fakeWindow()
    const p = bridgeCall('getStatus', { w, timeoutMs: 1000 })
    w.ack({ request_id: sent(w).request_id, op: 'getStatus', ok: true, data: { signed_in: true } })
    await expect(p).resolves.toEqual({ signed_in: true })
    expect(jest.getTimerCount()).toBe(0)
  })

  test('a throwing postMessage rejects and leaves no timer behind', async () => {
    jest.useFakeTimers()
    const w = fakeWindow(); w.AccountBridge.postMessage = () => { throw new Error('gone') }
    await expect(bridgeCall('signIn', { w })).rejects.toThrow('gone')
    expect(jest.getTimerCount()).toBe(0)
  })

  test('an ack sent synchronously from inside postMessage still resolves', async () => {
    const w = fakeWindow()
    w.AccountBridge.postMessage = (raw) => {
      const m = JSON.parse(raw)
      w.ack({ request_id: m.request_id, op: m.op, ok: true, data: { signed_in: true } })
    }
    await expect(bridgeCall('getStatus', { w })).resolves.toEqual({ signed_in: true })
  })

  test('ok:true without data resolves {}', async () => {
    const w = fakeWindow()
    const p = bridgeCall('getStatus', { w })
    w.ack({ request_id: sent(w).request_id, op: 'getStatus', ok: true })
    await expect(p).resolves.toEqual({})
  })
})

describe('timeouts per op', () => {
  test('signIn waits longer than GitHub code lifetime (15 min); getStatus is short', async () => {
    expect(SIGN_IN_TIMEOUT_MS).toBeGreaterThan(15 * 60 * 1000)
    expect(STATUS_TIMEOUT_MS).toBeLessThanOrEqual(10000)
    jest.useFakeTimers()
    const w = fakeWindow()
    const s = requestAppSignIn({ w, session: fakeStorage() })
    const g = requestAppStatus({ w })
    let signInSettled = false
    s.catch(() => {}).finally(() => { signInSettled = true })
    jest.advanceTimersByTime(STATUS_TIMEOUT_MS + 1)
    await expect(g).rejects.toMatchObject({ code: 'timeout' })
    jest.advanceTimersByTime(15 * 60 * 1000)
    await Promise.resolve()
    expect(signInSettled).toBe(false)
    jest.advanceTimersByTime(SIGN_IN_TIMEOUT_MS)
    await expect(s).rejects.toMatchObject({ code: 'timeout' })
  })
  test('signOut has a short timeout and resolves {signed_in:false}', async () => {
    expect(SIGN_OUT_TIMEOUT_MS).toBeLessThanOrEqual(30000)
    jest.useFakeTimers()
    const w = fakeWindow()
    const ok = requestAppSignOut({ w })
    w.ack({ request_id: sent(w).request_id, op: 'signOut', ok: true, data: { signed_in: false } })
    await expect(ok).resolves.toEqual({ signed_in: false })
    const lost = requestAppSignOut({ w })
    jest.advanceTimersByTime(SIGN_OUT_TIMEOUT_MS + 1)
    await expect(lost).rejects.toMatchObject({ code: 'timeout', op: 'signOut' })
  })
  test('a caller can override the timeout', async () => {
    jest.useFakeTimers()
    const w = fakeWindow()
    const p = requestAppStatus({ w, timeoutMs: 50 })
    jest.advanceTimersByTime(51)
    await expect(p).rejects.toMatchObject({ code: 'timeout' })
  })
})

describe('requestAppSignIn and the 401 grace mark', () => {
  test('a successful sign-in removes UNAUTHORIZED_AT_KEY from sessionStorage', async () => {
    const w = fakeWindow()
    const session = fakeStorage({ [UNAUTHORIZED_AT_KEY]: '123' })
    const p = requestAppSignIn({ w, session })
    w.ack({ request_id: sent(w).request_id, op: 'signIn', ok: true, data: { signed_in: true } })
    await p
    expect(session.getItem(UNAUTHORIZED_AT_KEY)).toBe(null)
  })
  test('a failed sign-in keeps the mark', async () => {
    const w = fakeWindow()
    const session = fakeStorage({ [UNAUTHORIZED_AT_KEY]: '123' })
    const p = requestAppSignIn({ w, session })
    w.ack({ request_id: sent(w).request_id, op: 'signIn', ok: false, error: 'cancelled' })
    await expect(p).rejects.toMatchObject({ code: 'cancelled' })
    expect(session.getItem(UNAUTHORIZED_AT_KEY)).toBe('123')
  })
  test('a sign-in ack with signed_in not true keeps the mark', async () => {
    const w = fakeWindow()
    const session = fakeStorage({ [UNAUTHORIZED_AT_KEY]: '123' })
    const p = requestAppSignIn({ w, session })
    w.ack({ request_id: sent(w).request_id, op: 'signIn', ok: true, data: {} })
    await p
    expect(session.getItem(UNAUTHORIZED_AT_KEY)).toBe('123')
  })
  test('a throwing storage does not break the sign-in', async () => {
    const w = fakeWindow()
    const session = { removeItem() { throw new Error('blocked') } }
    const p = requestAppSignIn({ w, session })
    w.ack({ request_id: sent(w).request_id, op: 'signIn', ok: true, data: { signed_in: true } })
    await expect(p).resolves.toEqual({ signed_in: true })
  })
})
