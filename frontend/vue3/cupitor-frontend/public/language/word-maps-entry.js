import { userDataReady } from './user-data.js'
import { githubWordMapSync } from './word-maps-github.js'
import { wordMapStorageKey } from './word-map-search.js'
import { openWordMaps, hostBridge } from './word-maps.js'

// Resolve the account and studied language at open time, just like other tools.
window.openWordMaps = async (focus) => {
  const storage = await userDataReady()
  const storageKey = wordMapStorageKey()
  return openWordMaps({
    storageKey,
    storage,
    focus,
    sync: githubWordMapSync(storageKey, { storage }),
    vocabulary: Object.values(window.vocabulary || {})
      .flat()
      .filter((line) => typeof line === 'string')
      .flatMap((line) => line.split('|').slice(1))
      .map((word) => word.trim())
      .filter(Boolean),
    onLookup: (term) => {
      const settings = window.jQuery('#settingsPanel')
      if (settings.hasClass('ui-dialog-content')) settings.dialog('close')
      window.jQuery('#searchText').val(term).trigger('change')
    },
    ...(typeof WordMapsHost !== 'undefined' ? hostBridge((m) => WordMapsHost.postMessage(m)) : {}),
  })
}
