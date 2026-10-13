// The account panel: a jQuery UI dialog opened from the settings footer (and
// from the banner above the settings panel), plus the banner itself.
//
// accountPanelVM is pure: account state and the panel's own progress in,
// what to show out. The DOM code below only paints a view-model and runs
// the actions; every piece of text reaches the page through jQuery .text()
// or .val(), never as HTML (users' names come from strangers' pull requests).
//
// Every change of account (sign-in, sign-out, setup, "also load data from")
// ends in a page reload: storage keys and sources are fixed when the page
// loads.

import {
  OWNER, loadAccount, saveAccount, sameLogin, isOwnerLogin,
} from './account-state.js'
import { layerStats } from './data-source.js'
import {
  fetchUsers, cachedUsers, ownerEntry, runSetup, listingStatus, SetupError,
  signInWithToken, signOut, reconcileLogin, installUnauthorizedHandler, fetchLogin,
  UNAUTHORIZED_AT_KEY, REFUSED_GRACE_MS,
} from './account.js'
import {
  appBridgeAvailable, installAckListener, requestAppSignIn, requestAppSignOut, requestAppStatus,
} from './account-bridge.js'

export const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=public_repo&description=Cupitor'
export const SETUP_REPO_MSG = 'Set up your repo to save changes.'
export const NO_TOKEN_MSG = 'Paste your GitHub token to save.'
export const UNCHECKED_MSG = "Couldn't check your sign-in with GitHub. Saving may fail until it can be checked."
export const SIGNED_OUT_MSG = 'You were signed out because GitHub no longer accepts your sign-in. Your unsaved edits stay on this device.'

const STEP_LABELS = { repo: 'Create your data repo', listing: 'Ask to be listed' }
const STEP_TEXT = {
  waiting: 'waiting',
  checking: 'checking',
  creating: 'creating it from the template',
  forking: 'copying cupitor-users',
  syncing: 'updating your copy',
  branching: 'making a branch',
  committing: 'adding your entry',
  'opening-pr': 'opening the request',
  done: 'done',
  failed: 'failed',
}

const LISTING_LINES = {
  listed: 'Listed: others can load your library.',
  awaiting: 'Waiting for approval to be listed. You can use your repo meanwhile.',
  not_approved: 'Your listing was not approved. You can keep using your repo.',
  none: 'Not listed yet. Ask to be listed so others can load your library.',
  error: "Couldn't check whether you are listed.",
}

// A failed setup step in plain words.
export function setupErrorText(err) {
  if (!err) return null
  const code = err.code
  if (code === 'unauthorized') return "GitHub didn't accept your sign-in. Sign out, sign in again and retry."
  if (code === 'github') {
    const st = err.status ? ` (error ${err.status})` : ''
    return `GitHub didn't answer as expected${st}. Retry in a moment.`
  }
  // The rest carry a plain message from account.js.
  if (err.message) return String(err.message)
  return 'Something went wrong. Retry in a moment.'
}

// An in-app sign-in failure (BridgeError code) in plain words.
export function appSignInErrorText(code) {
  switch (code) {
    case 'cancelled': return 'Sign-in cancelled.'
    case 'denied': return 'You declined the sign-in on GitHub.'
    case 'expired': return 'The sign-in code expired. Try again.'
    case 'network': return "Couldn't reach GitHub. Check your connection and try again."
    case 'busy': return 'A sign-in is already open in the app. Finish it there, then try again.'
    case 'timeout': return "The app didn't answer. Try again."
    case 'post_failed': return "Couldn't reach the app. Try again."
    case 'not_available':
    case 'unknown_op': return "This version of the app can't sign in from here. Update the app."
    default: return 'Sign-in failed in the app. Try again.'
  }
}

// A token sign-in failure in plain words.
export function tokenErrorText(e) {
  const msg = String((e && e.message) || e || '')
  const m = /^GitHub API error (\d+)\b/.exec(msg)
  if (m) return `GitHub refused the request (error ${m[1]}). Check the token has the public_repo scope.`
  return msg || 'Sign-in failed. Try again.'
}

// Notices about the other user's layer: one when nothing at all could be
// read from it, then the latest distinct notices the page collected.
export function otherNoticesOf(state, stats, notices) {
  const out = []
  if (state && state.other && stats && stats.other) {
    const o = stats.other
    if (o.hits === 0 && (o.misses + o.errors) > 0) {
      out.push(`No data found in ${state.other.login}/${state.other.repo}. Nothing from that library is shown.`)
    }
  }
  const seen = new Set(out)
  const recent = []
  for (const n of (Array.isArray(notices) ? notices : []).slice().reverse()) {
    if (typeof n !== 'string' || !n || seen.has(n)) continue
    seen.add(n); recent.push(n)
    if (recent.length >= 3) break
  }
  return out.concat(recent.reverse())
}

// The user entry to record as "other" for the picker's value: '' → null,
// a listed login (not self) → its entry, the current other → itself;
// anything else → undefined (ignore the change).
export function pickOther(users, state, login) {
  if (!login) return null
  if (state && sameLogin(login, state.login)) return undefined
  const u = (users || []).find(x => x && sameLogin(x.login, login))
  if (u) return u
  if (state && state.other && sameLogin(state.other.login, login)) return state.other
  return undefined
}

function statusOf(state) {
  if (!state.login) return 'guest'
  if (state.legacy || isOwnerLogin(state.login)) return 'owner'
  if (state.repo) return 'ready'
  return state.missingRepo ? 'missing-repo' : 'no-repo'
}

function userLabel(u) {
  return u.name && u.name !== u.login ? `${u.name} (${u.login})` : u.login
}

// inApp: inside the Cupitor app (no token form). bridge: the app can sign
// in/out from here (AccountBridge). listing: listingStatus result, 'error',
// or null while unknown. setup: { steps: { repo, listing }, error, running }.
// reconcile: the boot check's answer ('ok'|'unchecked'|'no_token'|null).
export function accountPanelVM({
  state, users, inApp = false, bridge = inApp, listing = null, setup = null, reconcile = null,
  notices = [], message = null, busy = false, signedOutRecently = false, repoName = null,
}) {
  const status = statusOf(state)
  const login = state.login
  const noToken = !inApp && reconcile === 'no_token' && status !== 'guest'
  const lines = []
  if (status === 'guest') {
    lines.push('You are not signed in.')
    lines.push(state.other ? `You are reading ${state.other.name}'s library. Sign in to save your own changes.`
      : 'Sign in to save your own changes.')
  } else if (status === 'owner') {
    lines.push(state.legacy
      ? `This device saves to ${OWNER.login}/${OWNER.repo}. The sign-in has not been checked yet.`
      : `Signed in as ${login} (owner). Changes save to ${OWNER.login}/${OWNER.repo}.`)
  } else if (status === 'ready') {
    lines.push(`Signed in as ${login}. Changes save to ${login}/${state.repo} (${state.branch}).`)
    lines.push(listing ? (LISTING_LINES[listing] || LISTING_LINES.error) : 'Checking whether you are listed...')
  } else if (status === 'no-repo') {
    lines.push(`Signed in as ${login}. You have no data repo yet.`)
  } else {
    lines.push(`Signed in as ${login}.`)
    lines.push(`Your data repo ${login}/${state.missingRepo.repo} can't be found (deleted, renamed or made private).`)
  }
  if (noToken) lines.push(NO_TOKEN_MSG)
  if (reconcile === 'unchecked' && status !== 'guest') lines.push(UNCHECKED_MSG)
  if (signedOutRecently && status === 'guest') lines.push(SIGNED_OUT_MSG)

  let banner = null
  if (signedOutRecently && status === 'guest') banner = SIGNED_OUT_MSG
  else if (noToken) banner = NO_TOKEN_MSG
  else if (status === 'guest' || status === 'no-repo') banner = SETUP_REPO_MSG
  else if (status === 'missing-repo') banner = "Your data repo can't be found. Set it up again to save changes."
  else if (reconcile === 'unchecked') banner = "Couldn't check your sign-in."

  const list = (users && users.length ? users : [ownerEntry()]).filter(u => u && !sameLogin(u.login, login))
  if (state.other && !list.some(u => sameLogin(u.login, state.other.login)) && !sameLogin(state.other.login, login)) {
    list.push(state.other)
  }
  const chosen = state.other ? state.other.login : ''
  const otherOptions = [{ value: '', label: 'none', selected: chosen === '' }]
    .concat(list.map(u => ({ value: u.login, label: userLabel(u), selected: chosen !== '' && sameLogin(u.login, chosen) })))

  const err = setup && setup.error ? setup.error : null
  const running = !!(setup && setup.running)
  const steps = setup && setup.steps ? setup.steps : null
  const setupSteps = steps && (running || err || Object.keys(steps).length)
    ? Object.keys(STEP_LABELS).map(k => {
      const st = steps[k] || 'waiting'
      return { key: k, label: STEP_LABELS[k], status: st, text: STEP_TEXT[st] || st }
    })
    : []
  const canSetUp = status === 'no-repo' || status === 'missing-repo' || (status === 'ready' && listing === 'none') || !!err
  const showSetup = status !== 'guest' && status !== 'owner' && !noToken && canSetUp
  const askName = !!err && (err.code === 'repo_taken' || err.code === 'bad_name')
  let repoNameInput = null
  // Once a name was typed it stays on screen (and is used) for every retry.
  if (showSetup && (askName || status === 'missing-repo' || (repoName && status !== 'ready'))) {
    repoNameInput = repoName != null ? repoName : (askName ? '' : state.missingRepo.repo)
  }

  return {
    status,
    lines,
    banner,
    message: message || null,
    notices: otherNoticesOf(state, null, notices),
    otherOptions,
    setupSteps,
    setupError: err ? { step: err.step, code: err.code, text: setupErrorText(err) } : null,
    showSetup,
    setupLabel: err ? 'Retry' : (status === 'ready' ? 'Ask to be listed' : 'Set up your repo'),
    repoNameInput,
    showTokenForm: !inApp && (status === 'guest' || noToken),
    showAppSignIn: inApp && status === 'guest',
    appSignInWorks: !!bridge,
    // Inside the app without the bridge a local sign-out would be undone
    // at the next load (the app keeps its token), so it is not offered.
    showSignOut: status !== 'guest' && (!inApp || !!bridge),
    tokenUrl: TOKEN_URL,
    busy: !!busy || running,
  }
}

// ---- live state and dependencies (replaceable in tests) ----

const defaultDeps = () => ({
  loadAccount, saveAccount, fetchUsers, cachedUsers, runSetup, listingStatus, fetchLogin,
  signInWithToken, signOut, reconcileLogin, installUnauthorizedHandler,
  requestAppSignIn, requestAppSignOut, requestAppStatus, appBridgeAvailable, installAckListener,
  layerStats,
  inApp: () => appBridgeAvailable() || typeof GitHubProxy !== 'undefined',
  reload: () => window.location.reload(),
  session: () => { try { return typeof sessionStorage !== 'undefined' ? sessionStorage : null } catch (_) { return null } },
  now: () => Date.now(),
})
let D = defaultDeps()
let ui = freshUi()
function freshUi() {
  return { users: null, listing: null, setup: null, reconcile: null, message: null, busy: false, repoName: null, bootState: null, open: false }
}

// The panel cannot be closed while setup runs, for at most this long (a
// hung request must not trap the modal).
export const SETUP_CLOSE_LOCK_MS = 60000
export const SETUP_RUNNING_MSG = 'Setup is running. You can close this in a moment.'
// When (ms, sessionStorage) the user signed out on purpose. A 401 mark
// (UNAUTHORIZED_AT_KEY) not newer than this is no forced sign-out to explain.
export const SIGNED_OUT_BY_USER_KEY = 'cupitor:signedOutByUser'

// Tests only: swap dependencies and reset the panel's state.
export function __setAccountPanelDeps(overrides = {}) {
  D = { ...defaultDeps(), ...overrides }
  ui = freshUi()
}

const snapshot = () => JSON.stringify(D.loadAccount())

function signedOutRecently() {
  const s = D.session()
  let at = 0
  let byUser = 0
  try { at = Number(s ? s.getItem(UNAUTHORIZED_AT_KEY) : 0) } catch (_) {}
  try { byUser = Number(s ? s.getItem(SIGNED_OUT_BY_USER_KEY) : 0) } catch (_) {}
  if (!(at > 0) || byUser >= at) return false
  const elapsed = D.now() - at
  return elapsed >= 0 && elapsed < REFUSED_GRACE_MS
}

function currentUsers() {
  return ui.users || D.cachedUsers() || [ownerEntry()]
}

function currentVM() {
  const state = D.loadAccount()
  const inApp = D.inApp()
  const vm = accountPanelVM({
    state, users: currentUsers(), inApp, bridge: D.appBridgeAvailable(), listing: ui.listing,
    setup: ui.setup, reconcile: ui.reconcile, notices: [], message: ui.message, busy: ui.busy,
    signedOutRecently: signedOutRecently(), repoName: ui.repoName,
  })
  let stats = null
  try { stats = D.layerStats() } catch (_) {}
  vm.notices = otherNoticesOf(state, stats, (typeof window !== 'undefined' && window._otherLayerNotices) || [])
  return vm
}

// ---- painting ----

const btn = (id, label, disabled) =>
  $('<button type="button" class="lang-tool-btn"></button>').attr('id', id).text(label).prop('disabled', !!disabled)
const para = (text, cls) => $('<p></p>').addClass(cls || '').text(text)

export function renderAccountPanel() {
  if (typeof $ !== 'function') return
  const vm = currentVM()
  const $b = $('#accountBanner')
  if (vm.banner) {
    $b.empty().append($('<span></span>').text(vm.banner), ' ', btn('accountBannerBtn', 'Account')).show()
  } else {
    $b.hide().empty()
  }

  const $d = $('#accountDialog')
  if (!$d.length) return
  // Keep what the user is typing across re-renders.
  const typedToken = $('#acctToken').val()
  const remember = $('#acctRemember').prop('checked')
  const typedRepo = $('#acctRepoName').val()

  const $root = $('<div class="acct-root"></div>')
  const $lines = $('<div class="acct-lines"></div>')
  vm.lines.forEach(l => $lines.append(para(l)))
  $root.append($lines)
  if (vm.message) $root.append(para(vm.message, 'acct-msg'))
  vm.notices.forEach(n => $root.append(para(n, 'acct-notice')))

  if (vm.showAppSignIn && vm.appSignInWorks) {
    $root.append($('<p></p>').append(btn('acctAppSignIn', 'Sign in with GitHub', vm.busy)))
  } else if (vm.showAppSignIn) {
    $root.append(para(appSignInErrorText('not_available')))
  }
  if (vm.showTokenForm) {
    const $t = $('<div class="acct-token"></div>')
    $t.append($('<p></p>').append(
      'Paste a classic GitHub token with the public_repo scope. ',
      $('<a target="_blank" rel="noopener noreferrer"></a>').attr('href', vm.tokenUrl).text('Create one on GitHub'),
      '.'))
    $t.append($('<input type="password" id="acctToken" autocomplete="off" spellcheck="false">')
      .attr('placeholder', 'ghp_...').val(typedToken || '').prop('disabled', vm.busy))
    $t.append($('<label class="acct-remember"></label>').append(
      $('<input type="checkbox" id="acctRemember">').prop('checked', !!remember).prop('disabled', vm.busy), ' Remember on this device'))
    $t.append($('<p></p>').append(btn('acctTokenSignIn', 'Sign in', vm.busy)))
    $root.append($t)
  }
  if (vm.showSetup || vm.setupSteps.length) {
    const $s = $('<div class="acct-setup"></div>')
    vm.setupSteps.forEach(st => {
      $s.append($('<div class="acct-step"></div>').addClass(`acct-step-${st.status === 'done' || st.status === 'failed' ? st.status : 'other'}`)
        .text(`${st.label}: ${st.text}`))
    })
    if (vm.setupError) $s.append(para(vm.setupError.text, 'acct-err'))
    if (vm.repoNameInput !== null) {
      $s.append($('<label class="acct-repo-name"></label>').append('Repo name ',
        $('<input type="text" id="acctRepoName" autocomplete="off" spellcheck="false">')
          .attr('placeholder', 'cupitor-data').val(typedRepo != null ? typedRepo : vm.repoNameInput).prop('disabled', vm.busy)))
    }
    if (vm.showSetup) $s.append($('<p></p>').append(btn('acctSetup', vm.setupLabel, vm.busy)))
    $root.append($s)
  }
  const $sel = $('<select id="acctOther"></select>').prop('disabled', vm.busy)
  vm.otherOptions.forEach(o => $sel.append($('<option></option>').val(o.value).text(o.label).prop('selected', o.selected)))
  $root.append($('<div class="acct-other"></div>').append($('<label></label>').append('Also load data from ', $sel)))
  if (vm.showSignOut) $root.append($('<p></p>').append(btn('acctSignOut', 'Sign out', vm.busy)))
  $d.empty().append($root)
}

function setBusy(busy, message = null) {
  ui.busy = busy
  ui.message = message
  renderAccountPanel()
}

// ---- actions ----

async function doSetup() {
  const state = D.loadAccount()
  if (!state.login || ui.busy) return
  const typed = typeof $ === 'function' && $('#acctRepoName').length ? String($('#acctRepoName').val() || '').trim() : ''
  if (typed) ui.repoName = typed
  const repoName = state.repo ? undefined
    : typed || ui.repoName || (state.missingRepo ? state.missingRepo.repo : undefined)
  ui.setup = { steps: {}, error: null, running: true, startedAt: D.now() }
  setBusy(true, null)
  try {
    let name = state.login
    try {
      const me = await D.fetchLogin()
      if (me && sameLogin(me.login, state.login)) name = me.name
    } catch (_) {}
    await D.runSetup({
      login: state.login, name, repoName,
      report: (step, st) => { if (ui.setup) { ui.setup.steps[step] = st; renderAccountPanel() } },
    })
    setBusy(true, 'Done. Reloading...')
    D.reload()
  } catch (e) {
    const err = e instanceof SetupError
      ? { step: e.step, code: e.code, message: e.message, status: e.status }
      : { step: 'repo', code: 'failed', message: `Something went wrong: ${(e && e.message) || e}` }
    ui.setup = { steps: { ...((ui.setup && ui.setup.steps) || {}), [err.step]: 'failed' }, error: err, running: false }
    // A failure after the repo was recorded: the account changed, so closing
    // the panel reloads (see the dialog's close handler). The listing step
    // did not finish, so the user is not listed yet.
    const recorded = !!D.loadAccount().repo && !state.repo
    if (D.loadAccount().repo && err.step === 'listing') ui.listing = 'none'
    // Closed meanwhile (after the close lock ran out): boot again if needed.
    if (!ui.open && snapshot() !== ui.bootState) { D.reload(); return }
    setBusy(false, recorded ? 'Your repo is ready; close this panel to start saving to it.' : null)
  }
}

async function doAppSignIn() {
  if (ui.busy) return
  setBusy(true, 'Finish signing in in the app...')
  let signedIn = false
  let code = null
  try {
    const d = await D.requestAppSignIn()
    signedIn = !!(d && d.signed_in === true)
    if (!signedIn) code = 'failed'
  } catch (e) {
    code = (e && e.code) || 'failed'
    if (code === 'busy' || code === 'timeout' || code === 'post_failed') {
      try {
        const s = await D.requestAppStatus()
        signedIn = !!(s && s.signed_in === true)
      } catch (_) {}
    }
  }
  if (!signedIn) { setBusy(false, appSignInErrorText(code)); return }
  // The status path did not go through requestAppSignIn's clean-up.
  try { const s = D.session(); if (s) s.removeItem(UNAUTHORIZED_AT_KEY) } catch (_) {}
  let r = 'unchecked'
  try { r = await D.reconcileLogin({ bridgeAvailable: true }) } catch (_) {}
  if (r === 'reload') { D.reload(); return }
  ui.reconcile = r
  if (!D.loadAccount().login) {
    setBusy(false, "The app signed in, but GitHub didn't confirm who you are. Try again in a moment.")
    return
  }
  setBusy(false, r === 'ok' ? 'Signed in.' : "Signed in, but couldn't check your sign-in with GitHub. Close this panel to try again.")
}

async function doTokenSignIn() {
  if (ui.busy || typeof $ !== 'function') return
  const token = String($('#acctToken').val() || '').trim()
  const remember = !!$('#acctRemember').prop('checked')
  if (!token) { setBusy(false, 'Paste a token first.'); return }
  setBusy(true, 'Checking the token...')
  try {
    await D.signInWithToken(token, { remember })
    try {
      const s = D.session()
      if (s) { s.removeItem(UNAUTHORIZED_AT_KEY); s.removeItem(SIGNED_OUT_BY_USER_KEY) }
    } catch (_) {}
    D.reload()
  } catch (e) {
    setBusy(false, tokenErrorText(e))
  }
}

async function doSignOut() {
  if (ui.busy) return
  setBusy(true, 'Signing out...')
  if (D.appBridgeAvailable()) {
    // A sign-out the app did not confirm (e.g. timeout) still signs out here.
    // The app may still hold its token then; the same mark the 401 handler
    // sets keeps the next boot check from signing it straight back in.
    try { await D.requestAppSignOut() } catch (e) {
      console.warn('[account] app sign-out failed', e)
      try { const s = D.session(); if (s) s.setItem(UNAUTHORIZED_AT_KEY, String(D.now())) } catch (_) {}
    }
  }
  // On purpose: the guest view must not say GitHub refused the sign-in.
  try { const s = D.session(); if (s) s.setItem(SIGNED_OUT_BY_USER_KEY, String(D.now())) } catch (_) {}
  D.signOut()
  const after = D.loadAccount()
  if (after.legacy || after.login) {
    setBusy(false, "Couldn't save the sign-out on this device. Allow site data for this page and try again.")
    return
  }
  D.reload()
}

function onOtherChange() {
  if (ui.busy || typeof $ !== 'function') return
  const login = String($('#acctOther').val() || '')
  const state = D.loadAccount()
  const pick = pickOther(currentUsers(), state, login)
  if (pick === undefined) { renderAccountPanel(); return }
  const { legacy, ...rest } = state // eslint-disable-line no-unused-vars
  if (!D.saveAccount({ ...rest, other: pick })) {
    setBusy(false, "Couldn't save your choice on this device. Allow site data for this page and try again.")
    return
  }
  setBusy(true, 'Reloading...')
  D.reload()
}

// ---- dialog ----

export function openAccountDialog(message = null) {
  if (typeof $ !== 'function') return
  if (message) ui.message = message
  let $d = $('#accountDialog')
  if (!$d.length) $d = $('<div id="accountDialog" title="Account"></div>').appendTo('body')
  if (ui.bootState === null) ui.bootState = snapshot()
  ui.open = true
  renderAccountPanel()
  const opts = {
    title: 'Account',
    width: Math.min(520, $(window).width() - 24),
    modal: true,
    autoOpen: true,
    draggable: false,
    resizable: false,
    position: { my: 'center top', at: 'center top+30', of: window },
    // Setup keeps going until it ends in a reload or an error on screen;
    // after SETUP_CLOSE_LOCK_MS the panel may close anyway.
    beforeClose: () => {
      const s = ui.setup
      if (!s || !s.running || D.now() - (s.startedAt || 0) >= SETUP_CLOSE_LOCK_MS) return true
      ui.message = SETUP_RUNNING_MSG
      renderAccountPanel()
      return false
    },
    close: () => {
      ui.open = false
      if (!ui.busy) ui.message = null
      // The account changed while the panel was open (e.g. setup recorded
      // the repo and then failed at the listing step): boot again.
      if (snapshot() !== ui.bootState) D.reload()
    },
  }
  // Options alone never reopen an existing dialog; it needs an explicit open.
  if ($d.hasClass('ui-dialog-content')) $d.dialog('option', opts).dialog('open')
  else $d.dialog(opts)
  // Show the cached list now, the fresh one when it arrives.
  Promise.resolve().then(() => D.fetchUsers()).then(u => {
    if (Array.isArray(u) && u.length) { ui.users = u; renderAccountPanel() }
  }).catch(() => {})
  const state = D.loadAccount()
  if (state.login && state.repo && !state.legacy && !isOwnerLogin(state.login)) {
    Promise.resolve().then(() => D.listingStatus({ login: state.login }))
      .then(s => { ui.listing = s }, () => { ui.listing = 'error' })
      .then(() => renderAccountPanel())
  }
}

// window.cupitorShowSetupPrompt: language.js calls it when a write needs an
// own repo.
export function showSetupPrompt(message) { openAccountDialog(message || SETUP_REPO_MSG) }

// Wires the panel into the page: the set-up prompt hook, the AccountBridge
// ack listener, the buttons, and a first paint of the banner. Call once,
// after the DOM is ready.
export function initAccountPanel() {
  if (typeof window === 'undefined' || typeof $ !== 'function') return
  try { D.installAckListener(window) } catch (_) {}
  window.cupitorShowSetupPrompt = showSetupPrompt
  ui.bootState = snapshot()
  $(document)
    .off('.acctPanel')
    .on('click.acctPanel', '#accountBtn, #accountBannerBtn', () => openAccountDialog())
    .on('click.acctPanel', '#acctSetup', doSetup)
    .on('click.acctPanel', '#acctAppSignIn', doAppSignIn)
    .on('click.acctPanel', '#acctTokenSignIn', doTokenSignIn)
    .on('keydown.acctPanel', '#acctToken', e => { if (e.key === 'Enter') doTokenSignIn() })
    .on('click.acctPanel', '#acctSignOut', doSignOut)
    .on('change.acctPanel', '#acctOther', onOtherChange)
  renderAccountPanel()
  // The other-layer notices are known once the subtitles have loaded.
  const ready = window._subtitlesReadyPromise
  if (ready && typeof ready.then === 'function') ready.then(renderAccountPanel, renderAccountPanel)
}

// The boot check: watch for a 401 (sign out, in the app also sign the app
// out, then reload), make the record agree with the token in use, and
// reload when it changed. Resolves with reconcileLogin's answer.
export async function bootAccount() {
  D.installUnauthorizedHandler({
    onSignedOut: async () => {
      if (typeof window !== 'undefined') window._suppressGHTokenPrompt = true
      if (D.appBridgeAvailable()) {
        try { await D.requestAppSignOut() } catch (e) { console.warn('[account] app sign-out failed', e) }
      }
      D.reload()
    },
  })
  let r
  try { r = await D.reconcileLogin({ bridgeAvailable: D.inApp() }) } catch (e) {
    console.warn('[account] sign-in check failed', e)
    r = 'unchecked'
  }
  if (r === 'reload') { D.reload(); return r }
  ui.reconcile = r
  // A legacy record may have been written as-is ('ok'): not a change to
  // reload for when the panel closes.
  ui.bootState = snapshot()
  renderAccountPanel()
  return r
}
