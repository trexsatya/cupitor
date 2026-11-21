import { fetchWithRetry } from './net.js'
import { hasSelf, writeTarget, langFromLocation, sourceDescriptor, captureSourceContext } from './data-source.js'
import { createWordMapSync } from './word-maps-sync.js'
import { resolveWordMapConflicts } from './word-maps-sync-dialog.js'
import { wordMapFileStore } from './word-maps-store.js'

// Same authenticated GitHubUtils / native GitHubProxy and data repo as recordings.
export function githubWordMapSync(
  storageKey,
  { github = window.GitHubUtils, fetchFn = fetch, storage = localStorage } = {}
) {
  if (!hasSelf() || !github) return null
  const target = writeTarget(),
    lang = langFromLocation(),
    descriptor = sourceDescriptor('self', lang)
  const context = captureSourceContext()
  const sourceKey = JSON.stringify([
    target.owner.toLowerCase(),
    target.repo.toLowerCase(),
    target.branch,
    lang,
  ])
  const checkAccount = () => {
    try { context.assertCurrent() }
    catch (_) {
      throw Object.assign(new Error('The account or repository changed, or another language is active. Reopen Word maps before syncing.'),
        { code: 'stale-data-source' })
    }
  }
  const branchPath = `/repos/${target.owner}/${target.repo}/git/ref/heads/${target.branch}`
  const publicRequest = (url) =>
    fetchWithRetry(
      url,
      {
        tries: 1,
        timeoutMs: 10000,
        passthrough404: true,
        init: { cache: 'no-store' },
      },
      { fetch: fetchFn }
    )
  const files = wordMapFileStore({
    readFile: async (relativePath) => {
      checkAccount()
      const path = `${descriptor.root}/${relativePath}`
      const missingPart = () => Object.assign(new Error(`Missing word map file: ${relativePath}`),
        { code: 'word-maps-part-missing' })
      if (typeof window.GitHubProxy !== 'undefined' || github.hasGHToken?.()) {
        try {
          const file = await github.getFile(target.owner, target.repo, path, '', target.branch)
          checkAccount()
          return file.content
        } catch (e) {
          if (/^GitHub API error 404\b/.test(String(e.message))) {
            if (relativePath !== 'word-maps.json') throw missingPart()
            // GitHub also returns 404 for inaccessible repos and missing
            // branches. Those must never look like an empty collection.
            await github.request('GET', branchPath)
            checkAccount()
            return null
          }
          throw e
        }
      }
      // Opening the editor must not prompt for a PAT. Public reads use the
      // fresh contents API; write authentication stays with the normal Sync flow.
      const response = await fetchWithRetry(
        `https://api.github.com/repos/${target.owner}/${
          target.repo
        }/contents/${path}?ref=${encodeURIComponent(target.branch)}`,
        {
          tries: 1,
          timeoutMs: 10000,
          passthrough404: true,
          init: { headers: { Accept: 'application/vnd.github.raw+json' }, cache: 'no-store' },
        },
        { fetch: fetchFn }
      )
      if (response.status === 404) {
        if (relativePath !== 'word-maps.json') throw missingPart()
        const branch = await publicRequest('https://api.github.com' + branchPath)
        if (!branch.ok)
          throw new Error(
            'The repository or branch could not be read. Sign in again or check your repository setup'
          )
        checkAccount()
        return null
      }
      if (!response.ok) throw new Error(`Could not load word maps (${response.status})`)
      const text = await response.text()
      checkAccount()
      return text
    },
    commitFiles: async (files) => {
      checkAccount()
      const result = await github.commitMultipleFiles({
        ...target,
        commitMessage: 'word maps: sync maps in separate files',
        files: files.map(file => ({
          ...file,
          path: `${descriptor.root}/${file.path}`,
          ...(file.getContent ? {
            getContent: async text => {
              checkAccount()
              const content = await file.getContent(text)
              checkAccount()
              return content
            },
          } : {}),
        })),
      })
      checkAccount()
      return result
    },
  })
  return createWordMapSync({
    storageKey,
    sourceKey,
    storage,
    resolveConflicts: resolveWordMapConflicts,
    ...files,
  })
}
