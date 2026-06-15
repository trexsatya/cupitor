// Networking primitives — timeout wrapping, retry-with-backoff fetch,
// bounded-concurrency batch runner, NFC normalisation, and the generic
// "read-merge-conditional-put" GitHub commit loop. Pure module: no
// jQuery, no app state. Heavy deps (fetch, GitHubUtils) are accepted as
// optional parameters with global fallbacks so the same callsite works
// both in the browser and under jest.

// Wrap a promise in a per-call timeout so a single hung fetch doesn't
// stall a Promise.allSettled batch. Returned promise rejects with
// `Error('timeout: ' + label)` if the original doesn't settle in time.
export function withTimeout(promise, ms, label, setTimeoutFn = setTimeout) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeoutFn(() => reject(new Error('timeout: ' + label)), ms))
  ])
}

// Force NFC normalization on any string that goes into a GitHub SRT path
// or gets stored in window.srts / index.json. Without this, captured
// filenames can drift between NFC ("å" precomposed) and NFD ("a" + ◌̊
// decomposed) — git treats them as different paths. Normalizing to NFC
// at every boundary makes the storage layer monomorphic.
export function nfc(s) {
  return String(s == null ? '' : s).normalize('NFC')
}

// Apply `fn` to each item with a bounded concurrency window. Each item's
// promise is fully settled (success or failure swallowed) before the
// lane is reused, so a single slow / hung fetch can't starve the rest
// — assuming the caller applied its own per-call timeout upstream.
//
// Returns an array of {status:'fulfilled', value} | {status:'rejected', reason}
// records in the same order as `items`, matching Promise.allSettled's
// shape. `onProgress(done, total)` (optional) fires after each item.
export async function runInBatches(items, fn, concurrency = 8, onProgress) {
  if (!Array.isArray(items) || !items.length) return []
  const total = items.length
  const results = new Array(total)
  let next = 0
  let done = 0
  const worker = async () => {
    while (true) {
      const i = next++
      if (i >= total) return
      try {
        results[i] = { status: 'fulfilled', value: await fn(items[i], i) }
      } catch (e) {
        results[i] = { status: 'rejected', reason: e }
      }
      done++
      if (typeof onProgress === 'function') {
        try { onProgress(done, total) } catch (_) {}
      }
    }
  }
  const lanes = Math.max(1, Math.min(concurrency, total))
  await Promise.all(Array.from({ length: lanes }, () => worker()))
  return results
}

// Retry a fetch up to `tries` times with exponential backoff (with jitter)
// and a per-attempt timeout. Used for boot-critical fetches because
// raw.githubusercontent.com occasionally returns 5xx / empty bodies on the
// very first hit after a deploy.
//
// Two cache defenses make this safe to call repeatedly:
//   1) cache: 'no-store' on every attempt so the browser doesn't consult
//      the disk cache.
//   2) ?_cb=<random> appended on each retry as a belt-and-braces buster in
//      case an intermediary (CDN, service worker) ignores no-store.
//
// `deps` (optional) lets tests inject {fetch, sleep, now} stubs — defaults
// to globalThis.fetch + setTimeout + Date.now in production.
export async function fetchWithRetry(url, { tries = 4, timeoutMs = 12000, init = {} } = {}, deps = {}) {
  const fetchFn = deps.fetch || (typeof fetch !== 'undefined' ? fetch : null)
  if (!fetchFn) throw new Error('fetchWithRetry: no fetch implementation available')
  const sleep = deps.sleep || ((ms) => new Promise(r => setTimeout(r, ms)))
  const now = deps.now || (() => Date.now())
  const setTimeoutFn = deps.setTimeout || setTimeout
  const random = deps.random || Math.random

  const baseInit = { cache: 'no-store', ...init }
  let lastErr
  for (let i = 0; i < tries; i++) {
    const reqUrl = i === 0
      ? url
      : url + (url.indexOf('?') === -1 ? '?' : '&') + '_cb=' + now() + '-' + i
    try {
      const res = await withTimeout(fetchFn(reqUrl, baseInit), timeoutMs, reqUrl, setTimeoutFn)
      if (!res.ok) throw new Error('HTTP ' + res.status + ' for ' + reqUrl)
      return res
    } catch (e) {
      lastErr = e
      if (i === tries - 1) break
      const backoff = 400 * Math.pow(2, i) + random() * 200
      await sleep(backoff)
    }
  }
  throw lastErr
}

// Generic read-merge-conditional-put-retry for a single file on GitHub.
// `merge(remoteContent)` is called with the live remote text (or null if
// the file doesn't yet exist) and must return the text to commit. If
// GitHub rejects the PUT because someone updated the file between our
// read and write (409 / 422 on the sha), we re-read and re-call `merge`
// — so the merge function MUST be safe to invoke multiple times with
// different remote inputs.
//
// `deps.githubUtils` defaults to window.GitHubUtils. `deps.owner` /
// `deps.repo` default to trexsatya/trexsatya.github.io (the only writer
// in this app today).
export async function commitWithMerge({
  filePath, branch = 'gh-pages', commitMessage, merge, maxAttempts = 5
}, deps = {}) {
  const githubUtils = deps.githubUtils || (typeof window !== 'undefined' ? window.GitHubUtils : null)
  if (!githubUtils) throw new Error('commitWithMerge: no GitHubUtils available')
  const owner = deps.owner || 'trexsatya'
  const repo = deps.repo || 'trexsatya.github.io'
  const log = deps.log || ((msg) => { try { console.warn(msg) } catch (_) {} })

  let lastErr
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    let remoteContent = null
    let sha
    try {
      const file = await githubUtils.getFile(owner, repo, filePath, '', branch)
      remoteContent = file.content
      sha = file.sha
    } catch (_) {
      // File doesn't exist on remote yet — we'll create it.
    }
    const merged = await merge(remoteContent)
    if (merged === null || merged === undefined) {
      throw new Error(`commitWithMerge: merge returned no content for ${filePath}`)
    }
    try {
      await githubUtils.putFile(owner, repo, filePath, merged, commitMessage, sha, '', branch)
      return merged
    } catch (e) {
      lastErr = e
      // 409 (sha mismatch / conflict) or 422 (stale sha) → another writer
      // beat us; re-read and retry. Anything else bubbles up.
      if (attempt < maxAttempts - 1 && /GitHub API error (409|422)\b/.test(String(e && e.message))) {
        log(`commitWithMerge: conflict on ${filePath}, retrying (${attempt + 2}/${maxAttempts})`)
        continue
      }
      throw e
    }
  }
  throw lastErr || new Error(`commitWithMerge: exhausted retries on ${filePath}`)
}
