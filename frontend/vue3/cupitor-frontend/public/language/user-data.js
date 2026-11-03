import { loadAccount, scopedKey, storageOwner, sources } from './account-state.js'
import { languageDefinition } from './language-config.js'
import { sourceDescriptor, hasSelf, hasOther, captureSourceContext, langFromLocation } from './data-source.js'
import { parseWordMaps } from './word-maps-sync.js'
import { openUserDataStore } from './user-data-store.js'
import { withWordMapRecords, MAP_RECORDS_FORMAT } from './word-map-library.js'

const object = raw => {
  const value = JSON.parse(raw)
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid saved collection; original data is retained.')
}
const json = raw => { JSON.parse(raw) }
const accountIdentity = account => JSON.stringify([storageOwner(account), account.repo, account.branch])
export function legacyUserDataKeys(account, language, storage) {
  if (!languageDefinition(language)?.capabilities.study) return []
  const key = name => scopedKey(name, account)
  const specs = [
    ...['recordings', 'recording', 'recLastPlayed', 'playUnavailable']
      .map(name => ({ key: key('cupitor:' + name), validate: object })),
    ...['recording:state', 'recording:current', 'recording:currentExtId', 'recordings:dirty']
      .map(name => ({ key: key('cupitor:' + name) })),
    { key: key('cupitor:pendingVocab'), claim: key('cupitor:pendingVocab') + ':' + language, validate: object,
      extract: raw => (languageDefinition(JSON.parse(raw).lang)?.name || 'swedish') === language ? raw : null },
    { key: key('cupitor:pendingSrtEdits'), claim: key('cupitor:pendingSrtEdits') + ':' + language, validate: object,
      extract: raw => {
        object(raw)
        const entries = Object.entries(JSON.parse(raw)).filter(([path]) => {
          const lang = path.match(/(?:^|\/)db\/language\/([^/]+)\//)?.[1] || 'swedish'
          return lang === language
        })
        return entries.length ? JSON.stringify(Object.fromEntries(entries)) : null
      } },
    { key: key('cupitor:capturedSubtitles'), claim: key('cupitor:capturedSubtitles') + ':' + language,
      validate: raw => { if (!Array.isArray(JSON.parse(raw))) throw new Error('Invalid captured subtitle buffer.') },
      extract: raw => {
        const array = JSON.parse(raw)
        if (!Array.isArray(array)) throw new Error('Invalid captured subtitle buffer.')
        const selected = array.filter(item => (languageDefinition(item?.detail?.sourceLang)?.name || 'swedish') === language)
        return selected.length ? JSON.stringify(selected) : null
      } },
    { key: key(`cupitor:wordMaps:${language}`), validate: parseWordMaps },
    { key: key(`cupitor:practiceLog:${language}`), validate: object },
    { key: key(`cupitor:playlistFolders:${language}`), validate: object },
    { key: key(`cupitor:playlistFolders:${language}:base`), validate: object },
    { key: key(`cupitor:recordings:base:db/language/${language}/recordings.json`), validate: object },
    { key: key('cupitor:openView'), validate: json },
  ]
  const maps = key(`cupitor:wordMaps:${language}`) + ':base:'
  const self = sources(account).self
  const mapBase = self && maps + JSON.stringify([self.owner.toLowerCase(), self.repo.toLowerCase(), self.branch, language])
  const takes = 'cupitor:localSpeakOver:' + language + ':'
  const suffix = storageOwner(account) === 'trexsatya' ? '' : '@' + storageOwner(account)
  for (let i = 0; i < storage.length; i++) {
    const name = storage.key(i)
    const mapLanguage = name.startsWith('cupitor:wordMaps:') && !name.includes(':base:')
      && (suffix ? name.endsWith(suffix) : !name.includes('@'))
      ? name.slice('cupitor:wordMaps:'.length, suffix ? -suffix.length : undefined) : null
    if (mapLanguage && mapLanguage !== language && languageDefinition(mapLanguage)?.name === language)
      specs.push({ key:name, validate:parseWordMaps })
    if (name === mapBase || (name.startsWith(takes) && (suffix ? name.endsWith(suffix) : !name.includes('@'))))
      specs.push({ key: name, validate: json })
  }
  return specs
}

let ready, current
export function userDataReady() {
  if (ready) return ready
  const account = loadAccount(), language = langFromLocation(), context = captureSourceContext()
  const identity = accountIdentity(account)
  const descriptor = hasSelf() ? sourceDescriptor('self') : hasOther() ? sourceDescriptor('other') : null
  const scope = JSON.stringify([storageOwner(account), language, descriptor?.identity || null])
  const assertCurrent = () => {
    context.assertCurrent()
    if (accountIdentity(loadAccount()) !== identity)
      throw Object.assign(new Error('The account or repository changed. Reload before editing; pending work is retained.'), { code: 'stale-data-source' })
  }
  ready = Promise.resolve().then(() => openUserDataStore({ scope, legacyStorage: localStorage,
    legacyKeys: legacyUserDataKeys(account, language, localStorage), assertCurrent,
    onStatus: status => {
      window.dispatchEvent(new CustomEvent('cupitor:user-data-status', { detail: status }))
      if (status.error) showUserDataError(status.error)
    },
  })).then(rawStore => {
    const mapLanguages = new Set([language, new URLSearchParams(location.search).get('lang') || language])
    const store = withWordMapRecords(rawStore, [...mapLanguages].map(lang => scopedKey('cupitor:wordMaps:' + lang, account)))
    current = store
    window.cupitorUserData = store
    window.openDeviceDataDialog = () => openDeviceDataDialog(store)
    window.addEventListener('beforeunload', event => {
      if (!store.status.pending) return
      event.preventDefault(); event.returnValue = ''
    })
    return store
  }).catch(error => { showUserDataError(error); throw error })
  return ready
}

function openDeviceDataDialog(store) {
  document.getElementById('deviceDataDialog')?.remove()
  const dialog = document.createElement('dialog'); dialog.id = 'deviceDataDialog'
  const title = document.createElement('h2'); title.textContent = 'Device data'
  const explanation = document.createElement('p')
  explanation.textContent = 'Back up playlists, word maps and pending edits for this account, language and repository. Recorded audio and downloaded subtitles are separate.'
  const status = document.createElement('p'); status.setAttribute('role', 'status')
  const exportButton = document.createElement('button'); exportButton.textContent = 'Export device data'
  exportButton.onclick = () => download(store.exportData())
  const restore = document.createElement('label'); restore.textContent = 'Restore device backup '
  const input = document.createElement('input'); input.type = 'file'; input.accept = '.json,application/json'
  input.onchange = async () => {
    const file = input.files[0]; if (!file) return
    try {
      const backup = JSON.parse(await file.text())
      if (!confirm('Replace this device’s playlists, maps and pending edits with this backup? Export current work first if you want to keep it.')) return
      const specs = legacyUserDataKeys(loadAccount(), langFromLocation(), localStorage)
      await store.importData(backup, (key, value) => {
        const spec = specs.find(item => item.key === key)
        if (spec) {
          const directory = key.includes('cupitor:wordMaps:') && JSON.parse(value)
          if (directory?.format === MAP_RECORDS_FORMAT) {
            if (!Array.isArray(directory.ids) || new Set(directory.ids).size !== directory.ids.length)
              throw new Error('Invalid word-map directory in backup.')
            for (const id of directory.ids) {
              const mapKey = key + ':map:' + encodeURIComponent(id)
              const maps = parseWordMaps([JSON.parse(backup.values[mapKey])])
              if (maps[0].id !== id) throw new Error('Word-map backup identity mismatch.')
            }
          } else spec.validate?.(value)
          return
        }
        const maps = scopedKey('cupitor:wordMaps:' + langFromLocation()) + ':base:'
        const mapRecords = specs.filter(spec=>spec.key.includes('cupitor:wordMaps:')&&!spec.key.includes(':base:')).map(spec=>spec.key+':map:')
        const takes = 'cupitor:localSpeakOver:' + langFromLocation() + ':'
        if (mapRecords.some(prefix=>key.startsWith(prefix))) { parseWordMaps([JSON.parse(value)]); return }
        if (key.startsWith(maps) || key.startsWith(takes)) { JSON.parse(value); return }
        throw new Error('This backup includes an unsupported record.')
      })
      location.reload()
    } catch (cause) { status.textContent = 'Restore failed: ' + cause.message }
    finally { input.value = '' }
  }
  restore.append(input)
  const close = document.createElement('button'); close.textContent = 'Close'; close.onclick = () => dialog.close()
  dialog.append(title, explanation, exportButton, document.createElement('hr'), restore, status, close)
  document.body.append(dialog); dialog.showModal()
}
export function currentUserData() {
  if (!current) throw new Error('Device data is still loading. Please wait before editing.')
  return current
}

function download(value) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob), a = document.createElement('a')
  a.href = url; a.download = 'cupitor-device-data.json'; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function showUserDataError(error) {
  let banner = document.getElementById('userDataError')
  if (!banner) {
    banner = document.createElement('div'); banner.id = 'userDataError'
    banner.setAttribute('role', 'alert')
    Object.assign(banner.style, { position: 'sticky', top: '0', zIndex: '2147483647', padding: '12px', background: '#fff0cf', color: '#302000' })
    const text = document.createElement('span'); text.className = 'user-data-error-text'
    const exportButton = document.createElement('button'); exportButton.textContent = 'Export pending work'
    exportButton.onclick = () => {
      if (current) return download(current.exportData())
      const values = Object.fromEntries(legacyUserDataKeys(loadAccount(), langFromLocation(), localStorage)
        .map(({key}) => [key, localStorage.getItem(key)]).filter(([, value]) => value != null))
      download({ format: 'cupitor-legacy-recovery-v1', values })
    }
    const retry = document.createElement('button'); retry.textContent = 'Retry save'
    retry.onclick = async () => {
      try {
        if (!current) { location.reload(); return }
        await current.retry(); banner.remove()
      } catch (cause) { showUserDataError(cause) }
    }
    banner.append(text, ' ', exportButton, ' ', retry)
    document.body.prepend(banner)
  }
  banner.querySelector('.user-data-error-text').textContent = 'Device save is incomplete. ' + error.message + ' '
}
