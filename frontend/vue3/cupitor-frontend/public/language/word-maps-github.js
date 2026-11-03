import { fetchWithRetry } from './net.js'
import { hasSelf, writeTarget, langFromLocation, sourceDescriptor } from './data-source.js'
import { createWordMapSync } from './word-maps-sync.js'
import { resolveWordMapConflicts } from './word-maps-sync-dialog.js'

// Same authenticated GitHubUtils / native GitHubProxy and data repo as recordings.
export function githubWordMapSync(
  storageKey,
  { github = window.GitHubUtils, fetchFn = fetch, storage = localStorage } = {}
) {
  if (!hasSelf() || !github) return null
  const target = writeTarget(),
    lang = langFromLocation(),
    descriptor = sourceDescriptor('self', lang),
    path = `${descriptor.root}/word-maps.json`
  const sourceKey = JSON.stringify([
    target.owner.toLowerCase(),
    target.repo.toLowerCase(),
    target.branch,
    lang,
  ])
  const checkAccount = () => {
    if (!hasSelf() || sourceDescriptor('self').identity !== descriptor.identity)
      throw new Error('The account or repository changed, or another language is active. Reopen Word maps before syncing.')
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
  return createWordMapSync({
    storageKey,
    sourceKey,
    storage,
    resolveConflicts: resolveWordMapConflicts,
    readFile: async () => {
      checkAccount()
      if (typeof window.GitHubProxy !== 'undefined' || github.hasGHToken?.()) {
        try {
          const file = await github.getFile(target.owner, target.repo, path, '', target.branch)
          checkAccount()
          return file.content
        } catch (e) {
          if (/^GitHub API error 404\b/.test(String(e.message))) {
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
    commitFile: async (getContent) => {
      checkAccount()
      const result = await github.commitMultipleFiles({
        ...target,
        commitMessage: 'word maps: sync maps',
        files: [
          {
            path,
            getContent: async (text) => {
              checkAccount()
              const content = await getContent(text)
              checkAccount()
              return content
            },
          },
        ],
      })
      checkAccount()
      return result
    },
  })
}
