import { githubWordMapSync } from './word-maps-github.js'
import { wordMapStorageKey } from './word-map-search.js'
import { openWordMaps, hostBridge } from './word-maps.js'

// Resolve the account and studied language at open time, just like other tools.
window.openWordMaps = (focus) => {
  const storageKey = wordMapStorageKey()
  return openWordMaps({
    storageKey,
    focus,
    sync: githubWordMapSync(storageKey),
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
