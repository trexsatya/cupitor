import { githubWordMapSync } from './word-maps-github.js'
import { scopedKey } from './account-state.js'
import { openWordMaps, hostBridge } from './word-maps.js'

// Resolve the account and studied language at open time, just like other tools.
window.openWordMaps = () => {
  const storageKey = scopedKey(
    'cupitor:wordMaps:' + (new URLSearchParams(location.search).get('lang') || 'swedish')
  )
  return openWordMaps({
    storageKey,
    sync: githubWordMapSync(storageKey),
    vocabulary: Object.values(window.vocabulary || {})
      .flat()
      .filter((line) => typeof line === 'string')
      .flatMap((line) => line.split('|').slice(1))
      .map((word) => word.trim())
      .filter(Boolean),
    onLookup: (term) => {
      window.jQuery('#settingsPanel').dialog('close')
      window.jQuery('#searchText').val(term).trigger('change')
    },
    ...(typeof WordMapsHost !== 'undefined' ? hostBridge((m) => WordMapsHost.postMessage(m)) : {}),
  })
}
