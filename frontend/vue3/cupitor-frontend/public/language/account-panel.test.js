import jq from 'jquery'
import {
  accountPanelVM, setupErrorText, appSignInErrorText, tokenErrorText, otherNoticesOf, pickOther,
  renderAccountPanel, initAccountPanel, openAccountDialog, showSetupPrompt, bootAccount,
  __setAccountPanelDeps, SETUP_REPO_MSG, NO_TOKEN_MSG, VISITOR_MSG, SIGNED_OUT_MSG, TOKEN_URL,
  SETUP_CLOSE_LOCK_MS, SETUP_RUNNING_MSG, SIGNED_OUT_BY_USER_KEY,
} from './account-panel.js'
import { SetupError, UNAUTHORIZED_AT_KEY } from './account.js'
import { BridgeError } from './account-bridge.js'

const owner = { login: 'trexsatya', name: 'Satya', repo: 'trexsatya.github.io', branch: 'gh-pages' }
const alice = { login: 'alice', name: 'Alice', repo: 'cupitor-data', branch: 'main' }
const bob = { login: 'bob', name: 'Bob', repo: 'cupitor-data', branch: 'main' }
const users = [owner, alice, bob]

const guest = { login: null, repo: null, branch: null, other: owner }
const aliceReady = { login: 'alice', repo: 'cupitor-data', branch: 'main', other: owner }
const aliceNoRepo = { login: 'alice', repo: null, branch: null, other: owner }
const aliceMissing = { ...aliceNoRepo, missingRepo: { repo: 'my-data', branch: 'main' } }
const ownerState = { login: 'trexsatya', repo: 'trexsatya.github.io', branch: 'gh-pages', other: null }
const legacy = { ...ownerState, legacy: true }

const text = vm => vm.lines.join(' ')

describe('accountPanelVM: states', () => {
  test('guest in a browser: banner, token form, no app sign-in, no setup, no sign-out', () => {
    const vm = accountPanelVM({ state: guest, users, inApp: false })
    expect(vm.status).toBe('guest')
    expect(vm.banner).toBe(SETUP_REPO_MSG)
    expect(text(vm)).toMatch(/not signed in/)
    expect(text(vm)).toMatch(/reading Satya's library/)
    expect(vm.showTokenForm).toBe(true)
    expect(vm.showAppSignIn).toBe(false)
    expect(vm.showSetup).toBe(false)
    expect(vm.showSignOut).toBe(false)
    expect(vm.tokenUrl).toBe(TOKEN_URL)
    expect(vm.otherOptions).toEqual([
      { value: '', label: 'none', selected: false },
      { value: 'trexsatya', label: 'Satya (trexsatya)', selected: true },
      { value: 'alice', label: 'Alice (alice)', selected: false },
      { value: 'bob', label: 'Bob (bob)', selected: false },
    ])
  })
  test('guest in the app: app sign-in, never a token form', () => {
    const vm = accountPanelVM({ state: guest, users, inApp: true, bridge: true })
    expect(vm.showAppSignIn).toBe(true)
    expect(vm.showTokenForm).toBe(false)
    expect(vm.appSignInWorks).toBe(true)
    expect(accountPanelVM({ state: guest, users, inApp: true, bridge: false }).appSignInWorks).toBe(false)
  })
  test('guest with other none', () => {
    const vm = accountPanelVM({ state: { ...guest, other: null }, users })
    expect(vm.otherOptions[0]).toEqual({ value: '', label: 'none', selected: true })
    expect(text(vm)).not.toMatch(/reading/)
  })
  test('owner: no banner, no setup, sign-out, every listed user offered but self', () => {
    const vm = accountPanelVM({ state: ownerState, users })
    expect(vm.status).toBe('owner')
    expect(vm.banner).toBeNull()
    expect(text(vm)).toMatch(/Signed in as trexsatya \(owner\)\. Changes save to trexsatya\/trexsatya\.github\.io/)
    expect(vm.showSetup).toBe(false)
    expect(vm.showSignOut).toBe(true)
    expect(vm.showTokenForm).toBe(false)
    expect(vm.otherOptions.map(o => o.value)).toEqual(['', 'alice', 'bob'])
    expect(vm.otherOptions[0].selected).toBe(true)
  })
  test('legacy owner: says the sign-in is not checked', () => {
    const vm = accountPanelVM({ state: legacy, users })
    expect(vm.status).toBe('owner')
    expect(text(vm)).toMatch(/not been checked/)
  })
  test('signed in without a repo: setup offered, writes-blocked banner, self not offered', () => {
    const vm = accountPanelVM({ state: aliceNoRepo, users })
    expect(vm.status).toBe('no-repo')
    expect(vm.showSetup).toBe(true)
    expect(vm.setupLabel).toBe('Set up your repo')
    expect(vm.repoNameInput).toBeNull()
    expect(vm.banner).toBe(SETUP_REPO_MSG)
    expect(vm.showTokenForm).toBe(false)
    expect(vm.otherOptions.map(o => o.value)).toEqual(['', 'trexsatya', 'bob'])
  })
  test('self is never offered, ignoring case', () => {
    const vm = accountPanelVM({ state: { ...aliceReady, login: 'Alice' }, users })
    expect(vm.otherOptions.map(o => o.value)).toEqual(['', 'trexsatya', 'bob'])
  })
  test('missing repo: names it, offers setup with that name', () => {
    const vm = accountPanelVM({ state: aliceMissing, users })
    expect(vm.status).toBe('missing-repo')
    expect(text(vm)).toMatch("Your data repo alice/my-data can't be found (deleted, renamed or made private).")
    expect(vm.showSetup).toBe(true)
    expect(vm.repoNameInput).toBe('my-data')
    expect(vm.banner).toMatch(/can't be found/)
  })
  test('ready: no banner; each listing status in words', () => {
    const vm = accountPanelVM({ state: aliceReady, users, listing: 'awaiting' })
    expect(vm.status).toBe('ready')
    expect(vm.banner).toBeNull()
    expect(text(vm)).toMatch(/Changes save to alice\/cupitor-data \(main\)/)
    expect(text(vm)).toMatch(/Waiting for approval/)
    expect(vm.showSetup).toBe(false)
    expect(text(accountPanelVM({ state: aliceReady, users, listing: 'not_approved' }))).toMatch(/not approved/)
    expect(text(accountPanelVM({ state: aliceReady, users, listing: 'listed' }))).toMatch(/Listed/)
    expect(text(accountPanelVM({ state: aliceReady, users, listing: 'error' }))).toMatch(/Couldn't check whether you are listed/)
    expect(text(accountPanelVM({ state: aliceReady, users, listing: null }))).toMatch(/Checking whether you are listed/)
    const none = accountPanelVM({ state: aliceReady, users, listing: 'none' })
    expect(text(none)).toMatch(/Not listed yet/)
    expect(none.showSetup).toBe(true)
    expect(none.setupLabel).toBe('Ask to be listed')
  })
  test('an other that is not in the list is still shown, selected', () => {
    const carol = { login: 'carol', name: 'Carol', repo: 'cupitor-data', branch: 'main' }
    const vm = accountPanelVM({ state: { ...aliceReady, other: carol }, users })
    expect(vm.otherOptions.find(o => o.value === 'carol')).toEqual({ value: 'carol', label: 'Carol (carol)', selected: true })
  })
  test('no users at all: the owner is offered', () => {
    const vm = accountPanelVM({ state: { ...aliceReady, other: null }, users: null })
    expect(vm.otherOptions.map(o => o.value)).toEqual(['', 'trexsatya'])
  })
})

describe('accountPanelVM: boot check', () => {
  test("'no_token' in a browser: token form, banner, no setup", () => {
    for (const state of [ownerState, aliceReady, aliceNoRepo]) {
      const vm = accountPanelVM({ state, users, reconcile: 'no_token' })
      expect(vm.banner).toBe(NO_TOKEN_MSG)
      expect(vm.showTokenForm).toBe(true)
      expect(vm.showSetup).toBe(false)
      expect(text(vm)).toMatch(/Paste your GitHub token to save/)
    }
  })
  test("legacy record with 'no_token' in a browser (a fresh visitor): shown as not signed in", () => {
    const vm = accountPanelVM({ state: legacy, users, reconcile: 'no_token' })
    expect(vm.status).toBe('owner')
    expect(vm.lines).toEqual(["Not signed in. Reading Satya's library."])
    expect(vm.banner).toBe(VISITOR_MSG)
    expect(vm.showTokenForm).toBe(true)
    expect(vm.showSetup).toBe(false)
    expect(vm.showSignOut).toBe(false)
  })
  test('the visitor line names the owner by login when the users list has no name for them', () => {
    const vm = accountPanelVM({ state: legacy, users: [{ login: 'trexsatya', repo: 'trexsatya.github.io' }], reconcile: 'no_token' })
    expect(vm.lines).toEqual(["Not signed in. Reading trexsatya's library."])
  })
  test('legacy record with a token, or in the app, keeps the owner text', () => {
    for (const args of [{ reconcile: 'ok' }, { reconcile: null }, { reconcile: 'no_token', inApp: true }]) {
      const vm = accountPanelVM({ state: legacy, users, ...args })
      expect(vm.lines).toEqual(['This device saves to trexsatya/trexsatya.github.io. The sign-in has not been checked yet.'])
      expect(vm.banner).toBeNull()
      expect(vm.showTokenForm).toBe(false)
      expect(vm.showSignOut).toBe(true)
    }
    const unchecked = accountPanelVM({ state: legacy, users, reconcile: 'unchecked' })
    expect(text(unchecked)).toMatch(/not been checked/)
    expect(unchecked.banner).toMatch(/Couldn't check your sign-in/)
  })
  test("'no_token' never shows a token form in the app", () => {
    const vm = accountPanelVM({ state: aliceReady, users, inApp: true, reconcile: 'no_token' })
    expect(vm.showTokenForm).toBe(false)
    expect(vm.banner).toBeNull()
  })
  test("'unchecked': a line and a banner for signed-in users", () => {
    const vm = accountPanelVM({ state: aliceReady, users, reconcile: 'unchecked', listing: 'listed' })
    expect(text(vm)).toMatch(/Couldn't check your sign-in/)
    expect(vm.banner).toMatch(/Couldn't check your sign-in/)
  })
  test('signed out by a 401: guest is told why', () => {
    const vm = accountPanelVM({ state: guest, users, signedOutRecently: true })
    expect(vm.banner).toBe(SIGNED_OUT_MSG)
    expect(text(vm)).toMatch(/no longer accepts/)
  })
})

describe('accountPanelVM: setup progress', () => {
  test('steps in words, the busy flag while running', () => {
    const vm = accountPanelVM({ state: aliceNoRepo, users, setup: { steps: { repo: 'done', listing: 'forking' }, error: null, running: true } })
    expect(vm.setupSteps).toEqual([
      { key: 'repo', label: 'Create your data repo', status: 'done', text: 'done' },
      { key: 'listing', label: 'Ask to be listed', status: 'forking', text: 'copying cupitor-users' },
    ])
    expect(vm.busy).toBe(true)
  })
  test('a step not started yet reads waiting', () => {
    const vm = accountPanelVM({ state: aliceNoRepo, users, setup: { steps: {}, error: null, running: true } })
    expect(vm.setupSteps.map(s => s.status)).toEqual(['waiting', 'waiting'])
  })
  test('a failed listing step: Retry, error in words', () => {
    const vm = accountPanelVM({ state: aliceReady, users, listing: 'none',
      setup: { steps: { repo: 'done', listing: 'failed' }, error: { step: 'listing', code: 'github', status: 502, message: 'GitHub API error 502: x' } } })
    expect(vm.showSetup).toBe(true)
    expect(vm.setupLabel).toBe('Retry')
    expect(vm.setupError).toEqual({ step: 'listing', code: 'github', text: "GitHub didn't answer as expected (error 502). Retry in a moment." })
    expect(vm.repoNameInput).toBeNull()
    expect(vm.busy).toBe(false)
  })
  test('repo_taken and bad_name ask for another repo name', () => {
    for (const code of ['repo_taken', 'bad_name']) {
      const vm = accountPanelVM({ state: aliceNoRepo, users, setup: { steps: { repo: 'failed' }, error: { step: 'repo', code, message: 'm' } } })
      expect(vm.repoNameInput).toBe('')
      expect(vm.setupLabel).toBe('Retry')
    }
    const typed = accountPanelVM({ state: aliceNoRepo, users, repoName: 'mine', setup: { steps: { repo: 'failed' }, error: { step: 'repo', code: 'repo_taken', message: 'm' } } })
    expect(typed.repoNameInput).toBe('mine')
  })
})

describe('plain-word helpers', () => {
  test('setupErrorText', () => {
    expect(setupErrorText(null)).toBeNull()
    expect(setupErrorText({ code: 'unauthorized', message: 'GitHub API error 401' })).toMatch(/didn't accept your sign-in/)
    expect(setupErrorText({ code: 'github', status: 0, message: 'x' })).toBe("GitHub didn't answer as expected. Retry in a moment.")
    expect(setupErrorText({ code: 'repo_taken', message: 'alice/x already exists' })).toBe('alice/x already exists')
    expect(setupErrorText({ code: 'timeout' })).toMatch(/Retry/)
  })
  test('appSignInErrorText covers every bridge code', () => {
    for (const c of ['cancelled', 'denied', 'expired', 'network', 'busy', 'timeout', 'post_failed', 'not_available', 'unknown_op', 'internal', 'failed', null]) {
      expect(appSignInErrorText(c)).toMatch(/\.$/)
    }
    expect(appSignInErrorText('busy')).toMatch(/already open/)
  })
  test('tokenErrorText', () => {
    expect(tokenErrorText(new Error('GitHub did not accept this token'))).toBe('GitHub did not accept this token')
    expect(tokenErrorText(new Error('GitHub API error 403: rate'))).toMatch(/error 403.*public_repo/)
  })
  test('otherNoticesOf: empty layer first, then latest distinct notices', () => {
    const st = { ...aliceReady }
    expect(otherNoticesOf(st, { other: { hits: 0, misses: 2, errors: 0 } }, ['a', 'b', 'a', 'c', 'd']))
      .toEqual(['No data found in trexsatya/trexsatya.github.io. Nothing from that library is shown.', 'a', 'c', 'd'])
    expect(otherNoticesOf(st, { other: { hits: 1, misses: 2, errors: 0 } }, [])).toEqual([])
    expect(otherNoticesOf({ ...st, other: null }, { other: { hits: 0, misses: 2, errors: 0 } }, ['x'])).toEqual(['x'])
  })
  test('pickOther', () => {
    expect(pickOther(users, aliceReady, '')).toBeNull()
    expect(pickOther(users, aliceReady, 'BOB')).toBe(bob)
    expect(pickOther(users, aliceReady, 'alice')).toBeUndefined()
    expect(pickOther(users, aliceReady, 'zed')).toBeUndefined()
    const carol = { login: 'carol', name: 'Carol', repo: 'r', branch: 'main' }
    expect(pickOther(users, { ...aliceReady, other: carol }, 'carol')).toBe(carol)
  })
})

// ---- DOM ----

const flush = () => new Promise(r => setTimeout(r, 0))

function setup({ state = guest, inApp = false, bridge = false, ...over } = {}) {
  global.$ = global.jQuery = jq
  jq.fn.dialog = jest.fn(function (opts) { if (opts && typeof opts === 'object') this.data('dlgOpts', opts); return this })
  document.body.innerHTML = '<div id="accountBanner" style="display:none"></div><button id="accountBtn">Account</button><div id="accountDialog"></div>'
  let current = state
  const deps = {
    loadAccount: jest.fn(() => current),
    saveAccount: jest.fn(s => { current = s; return true }),
    fetchUsers: jest.fn(async () => users),
    cachedUsers: jest.fn(() => users),
    runSetup: jest.fn(async () => ({ status: 'awaiting' })),
    listingStatus: jest.fn(async () => 'awaiting'),
    fetchLogin: jest.fn(async () => ({ login: 'alice', name: 'Alice A' })),
    signInWithToken: jest.fn(async () => aliceReady),
    signOut: jest.fn(() => { current = { login: null, repo: null, branch: null, other: owner }; return true }),
    reconcileLogin: jest.fn(async () => 'ok'),
    installUnauthorizedHandler: jest.fn(() => () => {}),
    requestAppSignIn: jest.fn(async () => ({ signed_in: true })),
    requestAppSignOut: jest.fn(async () => ({ signed_in: false })),
    requestAppStatus: jest.fn(async () => ({ signed_in: false })),
    appBridgeAvailable: jest.fn(() => bridge),
    installAckListener: jest.fn(),
    layerStats: jest.fn(() => ({ other: { hits: 0, misses: 0, errors: 0 } })),
    inApp: jest.fn(() => inApp),
    reload: jest.fn(),
    session: () => window.sessionStorage,
    now: () => Date.now(),
    ...over,
  }
  __setAccountPanelDeps(deps)
  return { deps, set: s => { current = s } }
}

afterEach(() => {
  window.sessionStorage.clear()
  delete window._otherLayerNotices
  delete window.cupitorShowSetupPrompt
  delete window._suppressGHTokenPrompt
})

describe('render', () => {
  test('untrusted names and notices are text, never markup', () => {
    const evil = { login: 'mallory', name: '<img src=x onerror="window.__pwned=1">', repo: 'r', branch: 'main' }
    const { deps } = setup({ state: { ...guest, other: evil } })
    deps.cachedUsers.mockReturnValue([owner, evil])
    window._otherLayerNotices = ['<b id="boom">notice</b>']
    renderAccountPanel()
    expect(document.querySelector('#accountDialog img')).toBeNull()
    expect(document.querySelector('#boom')).toBeNull()
    expect(document.querySelector('#accountDialog').textContent).toContain('<img src=x')
    expect(document.querySelector('#accountDialog').textContent).toContain('<b id="boom">')
    const opt = [...document.querySelectorAll('#acctOther option')].find(o => o.value === 'mallory')
    expect(opt.textContent).toBe(`${evil.name} (mallory)`)
    expect(opt.selected).toBe(true)
    expect(window.__pwned).toBeUndefined()
  })
  test('guest banner with an Account button; ready user has none', () => {
    const { set } = setup()
    renderAccountPanel()
    expect(jq('#accountBanner').css('display')).not.toBe('none')
    expect(jq('#accountBanner').text()).toContain(SETUP_REPO_MSG)
    expect(jq('#accountBannerBtn').length).toBe(1)
    set(aliceReady)
    renderAccountPanel()
    expect(jq('#accountBanner').css('display')).toBe('none')
  })
  test('guest in a browser gets the token form with the GitHub link; in the app, the sign-in button', () => {
    setup()
    renderAccountPanel()
    expect(jq('#acctToken').length).toBe(1)
    expect(jq('#acctRemember').length).toBe(1)
    expect(jq('.acct-token a').attr('href')).toBe(TOKEN_URL)
    expect(jq('#acctAppSignIn').length).toBe(0)
    setup({ inApp: true, bridge: true })
    renderAccountPanel()
    expect(jq('#acctToken').length).toBe(0)
    expect(jq('#acctAppSignIn').length).toBe(1)
  })
  test('typed token survives a re-render', () => {
    setup()
    renderAccountPanel()
    jq('#acctToken').val('ghp_abc')
    renderAccountPanel()
    expect(jq('#acctToken').val()).toBe('ghp_abc')
  })
})

describe('init and the set-up prompt', () => {
  test('cupitorShowSetupPrompt opens the dialog with the message', () => {
    setup({ state: aliceNoRepo })
    initAccountPanel()
    expect(typeof window.cupitorShowSetupPrompt).toBe('function')
    window.cupitorShowSetupPrompt('Set up your repo to save changes.')
    expect(jq.fn.dialog).toHaveBeenCalled()
    expect(jq('#accountDialog .acct-msg').text()).toBe('Set up your repo to save changes.')
    expect(jq('#acctSetup').text()).toBe('Set up your repo')
  })
  test('opening refreshes users in the background and checks the listing', async () => {
    const { deps } = setup({ state: aliceReady })
    deps.cachedUsers.mockReturnValue(null)
    initAccountPanel()
    openAccountDialog()
    // cached list absent → the owner only, until the fresh list arrives
    expect([...document.querySelectorAll('#acctOther option')].map(o => o.value)).toEqual(['', 'trexsatya'])
    await flush()
    expect([...document.querySelectorAll('#acctOther option')].map(o => o.value)).toEqual(['', 'trexsatya', 'bob'])
    expect(deps.listingStatus).toHaveBeenCalledWith({ login: 'alice' })
    expect(jq('#accountDialog').text()).toMatch(/Waiting for approval/)
  })
  test('listing check failure says so', async () => {
    const { deps } = setup({ state: aliceReady })
    deps.listingStatus.mockRejectedValue(new Error('x'))
    initAccountPanel()
    openAccountDialog()
    await flush()
    expect(jq('#accountDialog').text()).toMatch(/Couldn't check whether you are listed/)
  })
  test('the owner and guests are not checked for a listing', async () => {
    const { deps } = setup({ state: ownerState })
    initAccountPanel(); openAccountDialog(); await flush()
    expect(deps.listingStatus).not.toHaveBeenCalled()
  })
  test('a second open of an existing dialog opens it again', () => {
    setup({ state: ownerState })
    initAccountPanel()
    openAccountDialog()
    jq('#accountDialog').addClass('ui-dialog-content')
    jq.fn.dialog.mockClear()
    openAccountDialog()
    expect(jq.fn.dialog).toHaveBeenCalledWith('option', expect.objectContaining({ title: 'Account' }))
    expect(jq.fn.dialog).toHaveBeenCalledWith('open')
  })
})

describe('actions', () => {
  test('token sign-in: remember flag passed, reload on success', async () => {
    const { deps } = setup()
    initAccountPanel(); openAccountDialog()
    jq('#acctToken').val('  ghp_x  ')
    jq('#acctRemember').prop('checked', true)
    jq('#acctTokenSignIn').trigger('click')
    await flush()
    expect(deps.signInWithToken).toHaveBeenCalledWith('ghp_x', { remember: true })
    expect(deps.reload).toHaveBeenCalled()
  })
  test('token sign-in failure: message, no reload', async () => {
    const { deps } = setup()
    deps.signInWithToken.mockRejectedValue(new Error('GitHub did not accept this token'))
    initAccountPanel(); openAccountDialog()
    jq('#acctToken').val('bad')
    jq('#acctTokenSignIn').trigger('click')
    await flush()
    expect(deps.reload).not.toHaveBeenCalled()
    expect(jq('.acct-msg').text()).toBe('GitHub did not accept this token')
  })
  test('empty token: asks for one', async () => {
    const { deps } = setup()
    initAccountPanel(); openAccountDialog()
    jq('#acctTokenSignIn').trigger('click')
    await flush()
    expect(deps.signInWithToken).not.toHaveBeenCalled()
    expect(jq('.acct-msg').text()).toBe('Paste a token first.')
  })
  test('app sign-in: reconciles and reloads', async () => {
    const { deps } = setup({ inApp: true, bridge: true })
    deps.reconcileLogin.mockResolvedValue('reload')
    initAccountPanel(); openAccountDialog()
    jq('#acctAppSignIn').trigger('click')
    await flush(); await flush()
    expect(deps.requestAppSignIn).toHaveBeenCalled()
    expect(deps.reconcileLogin).toHaveBeenCalledWith({ bridgeAvailable: true })
    expect(deps.reload).toHaveBeenCalled()
  })
  test('app sign-in timeout: asks the app for its status, signed in → reload, refused mark cleared', async () => {
    const { deps } = setup({ inApp: true, bridge: true })
    window.sessionStorage.setItem(UNAUTHORIZED_AT_KEY, String(Date.now()))
    deps.requestAppSignIn.mockRejectedValue(new BridgeError('timeout', 'signIn'))
    deps.requestAppStatus.mockResolvedValue({ signed_in: true })
    deps.reconcileLogin.mockResolvedValue('reload')
    initAccountPanel(); openAccountDialog()
    jq('#acctAppSignIn').trigger('click')
    await flush(); await flush()
    expect(deps.requestAppStatus).toHaveBeenCalled()
    expect(window.sessionStorage.getItem(UNAUTHORIZED_AT_KEY)).toBeNull()
    expect(deps.reload).toHaveBeenCalled()
  })
  test('app sign-in busy and not signed in: message, no reload', async () => {
    const { deps } = setup({ inApp: true, bridge: true })
    deps.requestAppSignIn.mockRejectedValue(new BridgeError('busy', 'signIn'))
    initAccountPanel(); openAccountDialog()
    jq('#acctAppSignIn').trigger('click')
    await flush(); await flush()
    expect(deps.requestAppStatus).toHaveBeenCalled()
    expect(deps.reload).not.toHaveBeenCalled()
    expect(jq('.acct-msg').text()).toMatch(/already open in the app/)
  })
  test('app sign-in cancelled: no status call, message', async () => {
    const { deps } = setup({ inApp: true, bridge: true })
    deps.requestAppSignIn.mockRejectedValue(new BridgeError('cancelled', 'signIn'))
    initAccountPanel(); openAccountDialog()
    jq('#acctAppSignIn').trigger('click')
    await flush()
    expect(deps.requestAppStatus).not.toHaveBeenCalled()
    expect(jq('.acct-msg').text()).toBe('Sign-in cancelled.')
  })
  test('sign-out in the app: app then local, reload; a timed-out app call still signs out here', async () => {
    const { deps } = setup({ state: aliceReady, inApp: true, bridge: true })
    deps.requestAppSignOut.mockRejectedValue(new BridgeError('timeout', 'signOut'))
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    initAccountPanel(); openAccountDialog()
    jq('#acctSignOut').trigger('click')
    await flush()
    expect(deps.requestAppSignOut).toHaveBeenCalled()
    expect(deps.signOut).toHaveBeenCalled()
    expect(deps.reload).toHaveBeenCalled()
    console.warn.mockRestore()
  })
  test('sign-out in a browser: no app call', async () => {
    const { deps } = setup({ state: aliceReady })
    initAccountPanel(); openAccountDialog()
    jq('#acctSignOut').trigger('click')
    await flush()
    expect(deps.requestAppSignOut).not.toHaveBeenCalled()
    expect(deps.signOut).toHaveBeenCalled()
    expect(deps.reload).toHaveBeenCalled()
  })
  test('sign-out that cannot be saved: message, no reload', async () => {
    const { deps } = setup({ state: aliceReady })
    deps.signOut.mockReturnValue(false)
    initAccountPanel(); openAccountDialog()
    jq('#acctSignOut').trigger('click')
    await flush()
    expect(deps.reload).not.toHaveBeenCalled()
    expect(jq('.acct-msg').text()).toMatch(/Couldn't save the sign-out/)
  })
  test('in the app without the bridge: no sign-out offered', () => {
    setup({ state: aliceReady, inApp: true, bridge: false })
    renderAccountPanel()
    expect(jq('#acctSignOut').length).toBe(0)
  })
  test('picking another user saves it and reloads; picking none saves null', () => {
    const { deps } = setup({ state: aliceReady })
    initAccountPanel(); openAccountDialog()
    jq('#acctOther').val('bob').trigger('change')
    expect(deps.saveAccount).toHaveBeenCalledWith({ ...aliceReady, other: bob })
    expect(deps.reload).toHaveBeenCalledTimes(1)
    // Reloading: the panel takes no further changes.
    jq('#acctOther').prop('disabled', false).val('').trigger('change')
    expect(deps.saveAccount).toHaveBeenCalledTimes(1)
    const again = setup({ state: aliceReady }).deps
    initAccountPanel(); openAccountDialog()
    jq('#acctOther').val('').trigger('change')
    expect(again.saveAccount).toHaveBeenCalledWith({ ...aliceReady, other: null })
    expect(again.reload).toHaveBeenCalledTimes(1)
  })
  test('a legacy owner picking saves a plain record (no legacy flag)', () => {
    const { deps } = setup({ state: legacy })
    initAccountPanel(); openAccountDialog()
    jq('#acctOther').val('alice').trigger('change')
    expect(deps.saveAccount).toHaveBeenCalledWith({ ...ownerState, other: alice })
  })
  test('picking: a save that fails shows a message, no reload', () => {
    const { deps } = setup({ state: aliceReady })
    deps.saveAccount.mockReturnValue(false)
    initAccountPanel(); openAccountDialog()
    jq('#acctOther').val('bob').trigger('change')
    expect(deps.reload).not.toHaveBeenCalled()
    expect(jq('.acct-msg').text()).toMatch(/Couldn't save your choice/)
  })
  test('setup: progress shown per step, reload at the end', async () => {
    const { deps } = setup({ state: aliceNoRepo })
    let seen = null
    deps.runSetup.mockImplementation(async ({ report }) => {
      report('repo', 'creating')
      seen = jq('#accountDialog').text()
      report('repo', 'done'); report('listing', 'done')
      return { status: 'awaiting' }
    })
    initAccountPanel(); openAccountDialog()
    jq('#acctSetup').trigger('click')
    await flush()
    expect(seen).toMatch(/Create your data repo: creating it from the template/)
    expect(seen).toMatch(/Ask to be listed: waiting/)
    expect(deps.runSetup).toHaveBeenCalledWith(expect.objectContaining({ login: 'alice', name: 'Alice A', repoName: undefined }))
    expect(deps.reload).toHaveBeenCalled()
  })
  test('setup of a missing repo passes its name', async () => {
    const { deps } = setup({ state: aliceMissing })
    initAccountPanel(); openAccountDialog()
    expect(jq('#acctRepoName').val()).toBe('my-data')
    jq('#acctSetup').trigger('click')
    await flush()
    expect(deps.runSetup).toHaveBeenCalledWith(expect.objectContaining({ repoName: 'my-data' }))
  })
  test('repo_taken: asks for another name, Retry uses it', async () => {
    const { deps } = setup({ state: aliceNoRepo })
    deps.runSetup.mockRejectedValueOnce(new SetupError('repo', 'repo_taken', 'alice/cupitor-data already exists and is not a Cupitor data repo. Choose another name.'))
    initAccountPanel(); openAccountDialog()
    jq('#acctSetup').trigger('click')
    await flush()
    expect(deps.reload).not.toHaveBeenCalled()
    expect(jq('.acct-err').text()).toMatch(/Choose another name/)
    expect(jq('#acctSetup').text()).toBe('Retry')
    jq('#acctRepoName').val('cupitor-mine')
    jq('#acctSetup').trigger('click')
    await flush()
    expect(deps.runSetup).toHaveBeenLastCalledWith(expect.objectContaining({ repoName: 'cupitor-mine' }))
    expect(deps.reload).toHaveBeenCalled()
  })
  test('listing step fails after the repo was recorded: closing the panel reloads', async () => {
    const { deps, set } = setup({ state: aliceNoRepo })
    deps.runSetup.mockImplementation(async ({ report }) => {
      report('repo', 'done')
      set(aliceReady)
      throw new SetupError('listing', 'timeout', 'GitHub is still creating your copy of cupitor-users. Retry in a moment.')
    })
    initAccountPanel(); openAccountDialog()
    jq('#acctSetup').trigger('click')
    await flush()
    expect(deps.reload).not.toHaveBeenCalled()
    expect(jq('#accountDialog').text()).toMatch(/Ask to be listed: failed/)
    expect(jq('.acct-msg').text()).toMatch(/Your repo is ready/)
    const opts = jq('#accountDialog').data('dlgOpts')
    opts.close()
    expect(deps.reload).toHaveBeenCalled()
  })
  test('a typed repo name is kept for a retry after a different failure', async () => {
    const { deps } = setup({ state: aliceNoRepo })
    deps.runSetup
      .mockRejectedValueOnce(new SetupError('repo', 'repo_taken', 'taken. Choose another name.'))
      .mockRejectedValueOnce(new SetupError('repo', 'timeout', 'GitHub is still creating the repo. Retry in a moment.'))
    initAccountPanel(); openAccountDialog()
    jq('#acctSetup').trigger('click'); await flush()
    jq('#acctRepoName').val('my-own'); jq('#acctSetup').trigger('click'); await flush()
    expect(jq('#acctRepoName').val()).toBe('my-own')
    jq('#acctSetup').trigger('click'); await flush()
    expect(deps.runSetup.mock.calls.map(c => c[0].repoName)).toEqual([undefined, 'my-own', 'my-own'])
  })
  test('the panel cannot be closed while setup runs', async () => {
    const { deps } = setup({ state: aliceNoRepo })
    let finish
    deps.runSetup.mockImplementation(() => new Promise(r => { finish = r }))
    initAccountPanel(); openAccountDialog()
    jq('#acctSetup').trigger('click'); await flush()
    const opts = jq('#accountDialog').data('dlgOpts')
    expect(opts.beforeClose()).toBe(false)
    finish({ status: 'awaiting' }); await flush()
    expect(deps.reload).toHaveBeenCalled()
  })
  test('closing is refused with a message during setup, allowed after the lock; a later failure that changed the account reloads', async () => {
    let t = 1000
    const { deps, set } = setup({ state: aliceNoRepo, now: () => t })
    let fail
    deps.runSetup.mockImplementation(() => new Promise((_, rej) => { fail = rej }))
    initAccountPanel(); openAccountDialog()
    jq('#acctSetup').trigger('click'); await flush()
    const opts = jq('#accountDialog').data('dlgOpts')
    expect(opts.beforeClose()).toBe(false)
    expect(jq('.acct-msg').text()).toBe(SETUP_RUNNING_MSG)
    t += SETUP_CLOSE_LOCK_MS
    expect(opts.beforeClose()).toBe(true)
    opts.close()
    expect(deps.reload).not.toHaveBeenCalled() // nothing recorded yet
    set(aliceReady) // the repo got recorded, then the listing step fails
    fail(new SetupError('listing', 'github', 'x', { status: 502 })); await flush()
    expect(deps.reload).toHaveBeenCalled()
  })
  test('a listing failure after the repo was recorded: not listed (no endless "Checking")', async () => {
    const { deps, set } = setup({ state: aliceNoRepo })
    deps.runSetup.mockImplementation(async () => { set(aliceReady); throw new SetupError('listing', 'timeout', 'Retry in a moment.') })
    initAccountPanel(); openAccountDialog()
    jq('#acctSetup').trigger('click'); await flush()
    const t = jq('#accountDialog').text()
    expect(t).not.toMatch(/Checking whether you are listed/)
    expect(t).toMatch(/Not listed yet/)
    expect(jq('#acctSetup').text()).toBe('Retry')
  })
  test('app sign-in the app confirms but GitHub does not: no "Signed in." claim', async () => {
    const { deps } = setup({ state: guest, inApp: true, bridge: true })
    deps.reconcileLogin.mockResolvedValue('ok') // still a guest (e.g. GET /user 401)
    initAccountPanel(); openAccountDialog()
    jq('#acctAppSignIn').trigger('click'); await flush(); await flush()
    expect(jq('.acct-msg').text()).toMatch(/didn't confirm who you are/)
    expect(deps.reload).not.toHaveBeenCalled()
  })
  test('a voluntary sign-out is not explained as GitHub refusing the sign-in', async () => {
    setup({ state: aliceReady, inApp: true, bridge: true }).deps.requestAppSignOut.mockRejectedValue(new BridgeError('timeout', 'signOut'))
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    initAccountPanel(); openAccountDialog()
    jq('#acctSignOut').trigger('click'); await flush()
    console.warn.mockRestore()
    // The boot check's guard is still set...
    expect(Number(window.sessionStorage.getItem(UNAUTHORIZED_AT_KEY))).toBeGreaterThan(0)
    // ...but the guest view after the reload does not blame GitHub.
    setup({ state: guest })
    renderAccountPanel()
    expect(jq('#accountBanner').text()).not.toContain(SIGNED_OUT_MSG)
    expect(jq('#accountBanner').text()).toContain(SETUP_REPO_MSG)
  })
  test('a 401 after a voluntary sign-out is explained again', () => {
    setup()
    window.sessionStorage.setItem(SIGNED_OUT_BY_USER_KEY, String(Date.now() - 5000))
    window.sessionStorage.setItem(UNAUTHORIZED_AT_KEY, String(Date.now()))
    renderAccountPanel()
    expect(jq('#accountBanner').text()).toContain(SIGNED_OUT_MSG)
  })
  test('token sign-in clears both sign-out marks', async () => {
    setup()
    window.sessionStorage.setItem(UNAUTHORIZED_AT_KEY, String(Date.now()))
    window.sessionStorage.setItem(SIGNED_OUT_BY_USER_KEY, String(Date.now()))
    initAccountPanel(); openAccountDialog()
    jq('#acctToken').val('ghp_x'); jq('#acctTokenSignIn').trigger('click'); await flush()
    expect(window.sessionStorage.getItem(UNAUTHORIZED_AT_KEY)).toBeNull()
    expect(window.sessionStorage.getItem(SIGNED_OUT_BY_USER_KEY)).toBeNull()
  })
  test("app sign-in that ends 'ok' clears an earlier 'unchecked' warning", async () => {
    const { deps } = setup({ state: guest, inApp: true, bridge: true })
    deps.reconcileLogin.mockResolvedValueOnce('unchecked')
    await bootAccount()
    deps.reconcileLogin.mockResolvedValueOnce('ok')
    openAccountDialog()
    jq('#acctAppSignIn').trigger('click')
    // From here on the record reads as signed in.
    deps.loadAccount.mockReturnValue(aliceReady)
    await flush(); await flush()
    expect(jq('.acct-msg').text()).toBe('Signed in.')
    expect(jq('#accountDialog').text()).not.toMatch(/Couldn't check your sign-in/)
  })
  test('app sign-out that times out sets the refused mark so the next boot does not sign back in', async () => {
    setup({ state: aliceReady, inApp: true, bridge: true }).deps.requestAppSignOut.mockRejectedValue(new BridgeError('timeout', 'signOut'))
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    initAccountPanel(); openAccountDialog()
    jq('#acctSignOut').trigger('click'); await flush()
    console.warn.mockRestore()
    expect(Number(window.sessionStorage.getItem(UNAUTHORIZED_AT_KEY))).toBeGreaterThan(0)
  })
  test('in the app without the bridge a guest is told to update, no button', () => {
    setup({ inApp: true, bridge: false })
    renderAccountPanel()
    expect(jq('#acctAppSignIn').length).toBe(0)
    expect(jq('#accountDialog').text()).toMatch(/Update the app/)
  })
  test('closing the panel without a change does not reload', () => {
    const { deps } = setup({ state: aliceReady })
    initAccountPanel(); openAccountDialog()
    jq('#accountDialog').data('dlgOpts').close()
    expect(deps.reload).not.toHaveBeenCalled()
  })
})

describe('bootAccount', () => {
  test("'reload' reloads", async () => {
    const { deps } = setup()
    deps.reconcileLogin.mockResolvedValue('reload')
    expect(await bootAccount()).toBe('reload')
    expect(deps.reload).toHaveBeenCalled()
    expect(deps.installUnauthorizedHandler).toHaveBeenCalled()
  })
  test("'no_token' shows the token banner; 'unchecked' its banner; a throw counts as unchecked", async () => {
    const { deps } = setup({ state: ownerState })
    deps.reconcileLogin.mockResolvedValue('no_token')
    expect(await bootAccount()).toBe('no_token')
    expect(jq('#accountBanner').text()).toContain(NO_TOKEN_MSG)
    expect(deps.reload).not.toHaveBeenCalled()
    const fresh = setup({ state: legacy })
    fresh.deps.reconcileLogin.mockResolvedValue('no_token')
    expect(await bootAccount()).toBe('no_token')
    expect(jq('#accountBanner').text()).toContain(VISITOR_MSG)
    expect(jq('#accountBanner').text()).not.toContain(NO_TOKEN_MSG)
    expect(fresh.deps.saveAccount).not.toHaveBeenCalled()
    setup({ state: aliceReady }).deps.reconcileLogin.mockRejectedValue(new Error('x'))
    jest.spyOn(console, 'warn').mockImplementation(() => {})
    expect(await bootAccount()).toBe('unchecked')
    console.warn.mockRestore()
    expect(jq('#accountBanner').text()).toMatch(/Couldn't check your sign-in/)
  })
  test('401 sign-out: suppresses the token prompt, signs the app out, reloads', async () => {
    const { deps } = setup({ state: aliceReady, inApp: true, bridge: true })
    await bootAccount()
    const { onSignedOut } = deps.installUnauthorizedHandler.mock.calls[0][0]
    await onSignedOut()
    expect(window._suppressGHTokenPrompt).toBe(true)
    expect(deps.requestAppSignOut).toHaveBeenCalled()
    expect(deps.reload).toHaveBeenCalled()
  })
  test('401 sign-out in a browser: no app call', async () => {
    const { deps } = setup({ state: aliceReady })
    await bootAccount()
    await deps.installUnauthorizedHandler.mock.calls[0][0].onSignedOut()
    expect(deps.requestAppSignOut).not.toHaveBeenCalled()
    expect(deps.reload).toHaveBeenCalled()
  })
  test('after a 401 sign-out the guest banner says why', () => {
    setup()
    window.sessionStorage.setItem(UNAUTHORIZED_AT_KEY, String(Date.now()))
    renderAccountPanel()
    expect(jq('#accountBanner').text()).toContain(SIGNED_OUT_MSG)
  })
})

test('showSetupPrompt defaults the message', () => {
  setup({ state: aliceNoRepo })
  showSetupPrompt()
  expect(jq('.acct-msg').text()).toBe(SETUP_REPO_MSG)
})
