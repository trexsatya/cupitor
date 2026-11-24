import { mergeVocabulary, parseVocabularyFile, vocabularyToText } from './vocab-merge.js'
import { identifyNewVocabularyEntries, vocabularyEntries } from './vocabulary-entries.js'
import { changeVocabularyCatalog, synchronizeVocabularyGroups, VOCABULARY_CATALOG_PATH } from './vocabulary-hints.js'

// Both transforms share one plan per commit, even when catalog reads finish
// first. Each GitHub retry receives a fresh, pinned snapshot.
export function vocabularyCommitFiles({ path, baselineText, local, language, catalog, catalogBaseline, patch = {}, assertCurrent = () => {} }) {
  let text, nextCatalog
  identifyNewVocabularyEntries(local)
  const plans = new Map()
  const build = remote => {
    assertCurrent()
    const merged = mergeVocabulary(baselineText, local, remote || '')
    identifyNewVocabularyEntries(merged)
    return vocabularyToText(merged)
  }
  const plan = snapshot => {
    if (!plans.has(snapshot.headSha)) plans.set(snapshot.headSha, snapshot.read(path).then(build))
    return plans.get(snapshot.headSha)
  }
  const files = [{
    path,
    async getContent(remote, snapshot) {
      text = snapshot ? await plan(snapshot) : build(remote)
      return text
    },
  }, {
    path: VOCABULARY_CATALOG_PATH,
    async getContent(remote, snapshot) {
      if (snapshot) text = await plan(snapshot)
      assertCurrent()
      if (text === undefined) throw new Error('Read the vocabulary before synchronizing its hints.')
      const next = parseVocabularyFile(text)
      const byId = new Map(vocabularyEntries(next).filter(entry => entry.id).map(entry => [entry.id, entry]))
      for (const group of Object.values(patch.groups || {})) {
        if (!group.entryId) continue
        const entry = byId.get(group.entryId)
        if (!entry || entry.category !== group.category || entry.line !== group.line) {
          throw new Error('This vocabulary entry changed in the repository. Reload before editing its hints.')
        }
      }
      const synchronized = synchronizeVocabularyGroups(catalog, language, parseVocabularyFile(baselineText), next)
      nextCatalog = changeVocabularyCatalog(remote, catalogBaseline, {
        ...patch, groups: { ...synchronized, ...patch.groups },
      })
      return JSON.stringify(nextCatalog, null, 2) + '\n'
    },
  }]
  return { files, result: () => ({ text, catalog: nextCatalog }) }
}
