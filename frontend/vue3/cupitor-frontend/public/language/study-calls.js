// CallBridge follows NotifBridge: JSON requests with request_id, an ack per
// request, and durable snapshots pushed on page load and app resume.
export function createCallClient(win, timeoutMs = 15000) {
  const pending = new Map()
  let sequence = 0
  const available = () => typeof win.CallBridge?.postMessage === 'function'
  const onAck = event => {
    const ack = event.detail
    const request = pending.get(ack?.request_id)
    if (!request || ack.op !== request.op) return
    pending.delete(ack.request_id)
    win.clearTimeout(request.timer)
    if (ack.ok === true) request.resolve(ack.data ?? true)
    else request.reject(new Error(ack.error || 'call_failed'))
  }
  win.addEventListener('cupitorCallAck', onAck)
  return {
    available,
    rpc(op, payload = {}) {
      if (!available()) return Promise.reject(new Error('unsupported'))
      return new Promise((resolve, reject) => {
        const request_id = `call-${Date.now().toString(36)}-${++sequence}`
        const timer = win.setTimeout(() => {
          pending.delete(request_id)
          reject(new Error('timeout'))
        }, op === 'requestPermission' ? 120000 : timeoutMs)
        pending.set(request_id, { resolve, reject, timer, op })
        try { win.CallBridge.postMessage(JSON.stringify({ ...payload, op, request_id })) }
        catch (error) { pending.delete(request_id); win.clearTimeout(timer); reject(error) }
      })
    },
    dispose() {
      win.removeEventListener('cupitorCallAck', onAck)
      for (const request of pending.values()) {
        win.clearTimeout(request.timer)
        request.reject(new Error('cancelled'))
      }
      pending.clear()
    },
  }
}

export function callPayload({ title, question, choices, language, when, responseType = 'choice',
  correctChoice, acceptedAnswers, maxRetries = 3, matchThreshold = 0.8, voiceResponse = true, voiceName, speechRate }, now = Date.now()) {
  title = String(title || '').trim()
  question = String(question || '').trim()
  const lines = value => String(value || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean)
  choices = responseType === 'text' ? [] : lines(choices)
  language = String(language || '').trim()
  if (!title || title.length > 120 || !question || question.length > 4000 ||
      !['choice', 'text'].includes(responseType) ||
      (responseType === 'choice' && (choices.length < 2 || choices.length > 9 || choices.some(s => s.length > 200))) ||
      !/^[a-zA-Z]{2,3}(-[a-zA-Z]{2,4})?$/.test(language)) {
    throw new Error('Enter a title, a question, 2–9 alternatives and a language such as sv-SE.')
  }
  const retries = Number(maxRetries)
  const threshold = Number(matchThreshold)
  if (maxRetries === '' || !Number.isInteger(retries) || retries < 0 || retries > 10) throw new Error('Choose 0–10 retries after the first attempt.')
  if (!Number.isFinite(threshold) || threshold < 0.7 || threshold > 1) throw new Error('Choose a valid answer matching setting.')
  const result = { title, question, choices, language, response_type: responseType, max_retries: retries,
    match_threshold: threshold, voice_response: voiceResponse !== false }
  if (responseType === 'text') {
    const accepted = lines(acceptedAnswers)
    if (!accepted.length || accepted.length > 20 || accepted.some(s => s.length > 500 || !s.replace(/[.!?\s]/g, ''))) {
      throw new Error('Enter 1–20 accepted answers, one per line.')
    }
    result.accepted_answers = accepted
  } else if (correctChoice !== undefined) {
    const index = Number(correctChoice)
    if (correctChoice === '' || !Number.isInteger(index) || index < 0 || index >= choices.length) throw new Error('Choose the correct alternative.')
    result.correct_choice_index = index
  }
  if (voiceName !== undefined) {
    if (typeof voiceName !== 'string' || voiceName.length > 200) throw new Error('Choose a valid speaking voice.')
    result.voice_name = voiceName.trim()
  }
  if (speechRate !== undefined) {
    if (typeof speechRate !== 'number' || !Number.isFinite(speechRate) || speechRate < 0.5 || speechRate > 1.5) throw new Error('Choose a speaking speed from 0.5 to 1.5.')
    result.speech_rate = speechRate
  }
  if (when) {
    const timestamp = new Date(when).getTime()
    if (!Number.isFinite(timestamp) || timestamp <= now || timestamp > now + 366 * 86400000) {
      throw new Error('Choose a future time within the next year.')
    }
    result.when_ms = timestamp
  }
  return result
}

export const CALL_IMPORT_EXAMPLE = { version: 1, defaults: {
  language: 'sv-SE', max_retries: 3, match_threshold: 0.8, voice_response: true,
}, calls: [
  { title: 'Swedish words', question: 'Vad betyder försynt?', response_type: 'choice',
    choices: ['Stillsam och försiktig', 'Hård och rättfram', 'Mycket högljudd'], correct_choice_index: 0 },
  { title: 'Geography', question: 'Vad heter Sveriges huvudstad?', response_type: 'text',
    accepted_answers: ['Stockholm', 'Stockholms stad'] },
] }

function validateImportedCall(raw, index, now) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('Each call must be an object.')
  if (typeof raw.question !== 'string' || (raw.title !== undefined && typeof raw.title !== 'string') ||
      (raw.voice_response !== undefined && typeof raw.voice_response !== 'boolean') ||
      (raw.enabled !== undefined && typeof raw.enabled !== 'boolean')) throw new Error('Question/title must be text and voice_response must be true or false.')
  const type = raw.response_type || (raw.accepted_answers ? 'text' : 'choice')
  const choices = raw.choices || []
  const answers = raw.accepted_answers || []
  if (!Array.isArray(choices) || choices.some(s => typeof s !== 'string' || /[\r\n]/.test(s)) ||
      !Array.isArray(answers) || answers.some(s => typeof s !== 'string' || !s.trim() || s.length > 500)) {
    throw new Error('Choices and accepted_answers must be arrays of text.')
  }
  let when
  if (raw.when_ms !== undefined) {
    if (!Number.isSafeInteger(raw.when_ms)) throw new Error('when_ms must be an epoch timestamp in milliseconds.')
    when = new Date(raw.when_ms).toISOString()
  } else if (raw.when !== undefined) {
    if (typeof raw.when !== 'string' || !/(Z|[+-]\d\d:\d\d)$/.test(raw.when)) throw new Error('File times need an ISO date with a timezone, such as 2026-12-01T09:00:00+01:00.')
    when = raw.when
  }
  const payload = callPayload({ title: raw.title || `Study question ${index + 1}`, question: raw.question,
    language: raw.language || 'sv-SE', choices: choices.join('\n'), responseType: type,
    correctChoice: raw.correct_choice_index ?? '', acceptedAnswers: answers.map(s => s.replace(/\s+/g, ' ')).join('\n'),
    maxRetries: raw.max_retries ?? 3, matchThreshold: raw.match_threshold ?? 0.8,
    voiceResponse: raw.voice_response !== false, voiceName: raw.voice_name, speechRate: raw.speech_rate, when }, now)
  if (type === 'text') payload.accepted_answers = answers.map(s => s.replace(/\s+/g, ' ').trim())
  payload.enabled = raw.enabled !== false
  return payload
}

export const MAX_CALL_IMPORT = 5000

export function parseCallImport(text, now = Date.now(), maxCalls = MAX_CALL_IMPORT) {
  if (typeof text !== 'string' || text.length > 1024 * 1024) throw new Error('Choose a JSON file smaller than 1 MB.')
  let data
  try { data = JSON.parse(text.replace(/^\uFEFF/, '')) } catch (_) { throw new Error('The file is not valid JSON.') }
  if (!Array.isArray(data) && (!data || typeof data !== 'object' || (data.version !== undefined && data.version !== 1))) throw new Error('Unsupported call file format.')
  const calls = Array.isArray(data) ? data : data.calls
  const defaults = Array.isArray(data) ? {} : data.defaults || {}
  if (!Array.isArray(calls) || !calls.length || calls.length > maxCalls || calls.length > MAX_CALL_IMPORT || typeof defaults !== 'object' || Array.isArray(defaults)) throw new Error(`A file must contain 1–${maxCalls} calls. Change the pending call limit in Settings for larger lists.`)
  return calls.map((call, index) => {
    try {
      if (!call || typeof call !== 'object' || Array.isArray(call)) throw new Error('Each call must be an object.')
      return validateImportedCall({ ...defaults, ...call }, index, now)
    } catch (e) { throw new Error(`Call ${index + 1}: ${e.message}`) }
  })
}

export function scheduleImportedCalls(calls, start, spacingMinutes = 5, now = Date.now()) {
  const interval = Number(spacingMinutes)
  const first = new Date(start).getTime()
  if (calls.some(c => c.when_ms === undefined) && !Number.isFinite(first)) throw new Error('Choose the first call date and time.')
  if (!Number.isFinite(interval) || interval < 1 || interval > 1440) throw new Error('Choose an interval of 1–1440 minutes.')
  return calls.map((call, index) => validateImportedCall({ ...call,
    when_ms: call.when_ms ?? first + index * interval * 60000 }, index, now))
}

export function installStudyCalls(win, $) {
  const client = createCallClient(win)
  // Public programmatic API for custom study flows.
  win.cupitorCallRpc = (op, payload) => client.rpc(op, payload)
  let snapshot = win.__cupitorCalls || { calls: [] }
  let $dialog = null
  let permitted = false
  let voiceAvailable = false
  let batchAvailable = false
  let editingAvailable = false
  let pendingControls = false
  let imported = []
  let importedIndex = -1
  let editingId = null
  let batchScheduled = false
  let batchBusy = false
  let renderAlternatives = () => {}
  let pendingLimit = 50
  let settingsAvailable = false
  let globalPending = 0
  let pendingShown = 50
  let importShown = 50
  let voiceSelection = false
  let voices = []
  let voicesLoaded = false
  let voicesBusy = false
  let defaultVoice = ''
  let defaultRate = 1
  let currentView = 'list'
  const viewTrail = []
  const active = new Set(['scheduled', 'disabled', 'ringing', 'answered'])
  const errorMessages = {
    permission_denied: 'Enable study-call notifications first.',
    too_many_calls: 'The pending call limit has been reached. Increase it in Settings or remove pending calls.',
    busy: 'Audio is busy. Finish the active call or playback first.',
    speech_unavailable: 'This voice is unavailable. Check Android speech settings or choose another voice.',
    bad_time: 'Choose a future date and time before enabling this call.',
    not_scheduled: 'This call has already started or finished. Refresh the pending list.',
    timeout: 'Cupitor did not reply. Refresh the call history before trying again.',
  }
  const status = (text, error = false) => $dialog?.find('[data-call-status]').text(text).toggleClass('study-call-error', error)
  const reportError = error => status(errorMessages[error.message] || error.message, true)

  function showView(view, remember = false) {
    if (view === 'list') viewTrail.length = 0
    else if (remember && view !== currentView) viewTrail.push(currentView)
    else if (!remember && viewTrail.includes(view)) viewTrail.splice(viewTrail.lastIndexOf(view))
    currentView = view
    if (voiceSelection && view !== 'settings') client.rpc('stopVoicePreview').catch(() => {})
    if (voiceSelection && ['settings', 'editor'].includes(view)) loadVoices()
    status('')
    $dialog.find('[data-call-view]').hide().filter(`[data-call-view=${view}]`).show()
    const titles = { list: 'Pending calls', import: 'Import calls', history: 'Call history', settings: 'Settings', editor: editingId ? 'Edit scheduled call' : importedIndex >= 0 ? 'Edit imported call' : 'Add call' }
    const descriptions = { list: 'Your questions, ready for voice practice.', import: 'Choose a file, review your questions, then schedule.', history: 'Your latest 100 finished calls.', settings: 'Control the size of your call list.', editor: 'Set the question and the answer you want to practice.' }
    $dialog.find('[data-call-view-title]').text(titles[view])
    $dialog.find('[data-call-view-description]').text(descriptions[view])
    const parent = viewTrail[viewTrail.length - 1] || (view === 'editor' && importedIndex >= 0 ? 'import' : 'list')
    const backLabels = { list: 'pending calls', import: 'import review', history: 'call history', settings: 'settings' }
    $dialog.find('[data-call-back]').text(`← Back to ${backLabels[parent] || 'pending calls'}`)
    $dialog.find('[data-call-back-bar]').toggle(view !== 'list')
    $dialog.find('[data-call-nav]').toggle(view !== 'editor')
    $dialog.find('[data-call-history-toggle]').attr('aria-expanded', String(view === 'history'))
    $dialog.find('[data-call-history]').toggle(view === 'history')
    const draft = importedIndex >= 0 && !editingId
    $dialog.find('[data-call-import-save]').toggle(draft)
    $dialog.find('[data-call-submit]').toggle(!draft)
    if (editingId) $dialog.find('[data-call-submit=now]').hide()
    $dialog.scrollTop(0)
    $(win).trigger('resize')
  }

  function goBack() {
    const parent = viewTrail.pop() || (currentView === 'editor' && importedIndex >= 0 ? 'import' : 'list')
    // Back leaves the editor without submitting or saving an unfinished draft.
    if (currentView === 'editor') { editingId = null; importedIndex = -1 }
    showView(parent)
  }

  function renderHistory() {
    if (!$dialog) return
    const $history = $dialog.find('[data-call-history-rows]').empty()
    const $pending = $dialog.find('[data-call-pending]').empty()
    const all = Array.isArray(snapshot.calls) ? snapshot.calls : []
    const pending = all.filter(c => active.has(c.status)).sort((a, b) => a.when_ms - b.when_ms)
    const query = String($dialog.find('[data-call-search]').val() || '').toLocaleLowerCase().trim()
    const matches = pending.filter(call => !query || `${call.title} ${call.question}`.toLocaleLowerCase().includes(query))
    $dialog.find('[data-call-pending-count]').text(`${pending.length} pending in this profile`)
    $dialog.find('[data-call-capacity]').text(`Limit: ${pendingLimit.toLocaleString()} across all profiles`)
    $dialog.find('[data-call-search-wrap]').toggle(pending.length > 5 || !!query)
    $dialog.find('[data-call-pending-more]').toggle(matches.length > pendingShown).text(`Show more (${Math.max(0, matches.length - pendingShown)} remaining)`)
    const history = all.filter(c => !active.has(c.status)).sort((a, b) =>
      (b.finished_at || b.created_at || 0) - (a.finished_at || a.created_at || 0)).slice(0, 100)
    $dialog.find('[data-call-history-count]').text(`History (${history.length})`)
    if (!history.length) $('<p>').text('No calls yet.').appendTo($history)
    if (!matches.length) $('<p class="study-call-empty">').text(query ? 'No matching calls.' : 'No pending calls. Add a question or import a JSON file to get started.').appendTo($pending)
    for (const call of [...matches.slice(0, pendingShown), ...history]) {
      const $row = $('<div class="study-call-history-row">').appendTo(active.has(call.status) ? $pending : $history)
      $row.attr('data-call-id', call.id)
      $('<strong class="study-call-row-title">').text(call.title).appendTo($row)
      $('<span class="study-call-badge">').text(call.status === 'disabled' ? 'Disabled' : call.status === 'scheduled' ? 'Scheduled' : call.status).appendTo($row)
      if (active.has(call.status)) $('<p>').text(call.question).appendTo($row)
      $('<div class="study-call-meta">').text(`${new Date(call.when_ms).toLocaleString()} · ${call.response_type === 'text' ? 'Free response' : 'Multiple choice'}`).appendTo($row)
      if (call.choice != null) $('<div>').text(`Answer: ${call.choice}`).appendTo($row)
      else if (call.answer) $('<div>').text(`Answer: ${call.answer}`).appendTo($row)
      if (call.spoken_response) $('<div>').text(`Heard: ${call.spoken_response}`).appendTo($row)
      if (call.correct === true) $('<div>').text('Correct answer').appendTo($row)
      if (Array.isArray(call.attempts) && call.attempts.length) {
        const $attempts = $('<details>').appendTo($row)
        $('<summary>').text(`Attempts (${call.attempts.length})`).appendTo($attempts)
        call.attempts.forEach((attempt, index) => {
          const outcome = attempt.correct === true ? 'Correct' : attempt.reason ? 'Not understood' : attempt.correct === false ? 'Incorrect' : 'Saved'
          $('<div>').text(`${index + 1}. ${attempt.answer || 'No answer heard'} — ${outcome}`).appendTo($attempts)
        })
      }
      if (['scheduled', 'disabled'].includes(call.status) && editingAvailable) {
        $('<button type="button" class="btn">').text('Edit call').appendTo($row).on('click', () => {
          try { saveImported(); } catch (e) { reportError(e); return }
          importedIndex = -1
          $dialog.find('[data-call-import-select]').val('')
          loadQuestion(call)
          editingId = call.id
          $dialog.find('[data-call-submit=now]').hide()
          $dialog.find('[data-call-submit=later]').text('Save scheduled call')
          $dialog.find('[data-call-cancel-edit]').show()
          showView('editor', true); status('Editing scheduled call.')
        })
      }
      if (['scheduled', 'disabled'].includes(call.status) && pendingControls) {
        const action = (label, op, payload) => $('<button type="button" class="btn">').text(label).appendTo($row).on('click', async function () {
          this.disabled = true
          try {
            await client.rpc(op, { id: call.id, ...payload }); await refresh()
            if (op === 'remove' && editingId === call.id) { editingId = null; showView('list') }
            status(op === 'remove' ? 'Call removed.' : payload.enabled ? 'Call enabled.' : 'Call disabled.')
          } catch (e) { reportError(e); this.disabled = false }
        })
        action(call.status === 'disabled' ? 'Enable' : 'Disable', 'setEnabled', { enabled: call.status === 'disabled' })
        action('Remove', 'remove', {}).addClass('study-call-danger')
      }
      if (active.has(call.status) && (!pendingControls || !['scheduled', 'disabled'].includes(call.status))) {
        $('<button type="button" class="btn">').text('Cancel call').appendTo($row).on('click', async function () {
          this.disabled = true
          try { await client.rpc('cancel', { id: call.id }); await refresh() }
          catch (e) { reportError(e); this.disabled = false }
        })
      }
    }
  }

  function renderSources() {
    if (!$dialog) return
    const $select = $dialog.find('[data-call-source]')
    // Preserve a partially edited question when new notification state arrives.
    const current = $select.val()
    $select.empty().append($('<option>').val('').text('Write your own question'))
    const lists = win.__cupitorNotifLists?.lists || []
    for (const list of lists) for (const item of list.items || []) {
      $('<option>').val(JSON.stringify([list.external_key, item.external_id]))
        .text(`${list.name}: ${item.title}`).data('item', item).appendTo($select)
    }
    $select.val(current || '')
  }

  async function refresh() {
    if (!client.available() || !$dialog) return
    const caps = await client.rpc('getCapabilities')
    const enabled = caps.supported === true
    voiceAvailable = caps.speech_input === true
    batchAvailable = caps.batch_schedule === true
    editingAvailable = caps.edit_scheduled === true
    pendingControls = caps.pending_controls === true
    settingsAvailable = caps.settings === true
    voiceSelection = caps.voice_selection === true
    defaultVoice = typeof caps.voice_name === 'string' ? caps.voice_name : ''
    defaultRate = typeof caps.speech_rate === 'number' ? Number(caps.speech_rate.toFixed(2)) : 1
    selectValue('[data-call-default-voice]', defaultVoice, defaultVoice || 'Device default')
    selectValue('[data-call-default-rate]', String(defaultRate), `${defaultRate}×`)
    $dialog.find('[data-call-voice-name], [data-call-speech-rate], [data-call-default-voice], [data-call-default-rate], [data-call-preview-voice], [data-call-preview-editor], [data-call-stop-preview], [data-call-reload-voices], [data-call-manage-voices]').prop('disabled', !voiceSelection)
    $dialog.find('[data-call-voices-note]').text(voiceSelection ? 'Choose an available Android text-to-speech voice. Other question languages keep their device voice.' : 'Update the Cupitor app to choose a speaking voice.')
    pendingLimit = Number.isInteger(caps.pending_limit) ? caps.pending_limit : 50
    globalPending = Number.isInteger(caps.pending_count) ? caps.pending_count : 0
    $dialog.find('[data-call-limit]').val(pendingLimit).attr('max', caps.max_pending_limit || MAX_CALL_IMPORT)
    $dialog.find('[data-call-save-settings], [data-call-limit]').prop('disabled', !settingsAvailable)
    $dialog.find('[data-call-limit-note]').text(settingsAvailable
      ? `${globalPending.toLocaleString()} pending across all profiles. Lowering the limit keeps existing questions and only stops new additions.`
      : 'Update the Cupitor app to change the call limit.')
    $dialog.find('[data-call-import-help]').text(`JSON file · up to 1 MB · up to ${pendingLimit.toLocaleString()} questions. Change the limit in Settings.`)
    $dialog.find('[data-call-voice]').prop('disabled', !voiceAvailable)
    $dialog.find('[data-call-voice-note]').text(voiceAvailable
      ? 'Say your answer after the question. Microphone permission is requested when needed.'
      : 'Speech recognition is unavailable on this device. You can answer on screen.')
    permitted = enabled && caps.permission === 'granted'
    $dialog.find('[data-call-submit]').prop('disabled', !permitted)
    $dialog.find('[data-call-submit=now]').prop('disabled', !permitted || !$dialog.find('[data-call-enabled]').is(':checked'))
    $dialog.find('[data-call-permission]').toggle(enabled && caps.permission !== 'granted')
    $dialog.find('[data-call-fullscreen]').toggle(enabled && !caps.full_screen)
    $dialog.find('[data-call-exact]').toggle(enabled && !caps.exact_alarms)
    $dialog.find('[data-call-capabilities]').text(!enabled ? 'Study calls need an updated Cupitor Android app.' :
      caps.permission !== 'granted' ? 'Enable notifications to let Cupitor ring.' :
        'Cupitor rings for up to 45 seconds. Answer to hear the question, then speak or answer on screen.')
    const data = await client.rpc('getCalls')
    if (Array.isArray(data?.calls)) { snapshot = data; renderHistory() }
    renderImported()
  }

  function readForm(includeTime = true) {
    const value = key => $dialog.find(`[data-call-${key}]`).val()
    if (value('type') === 'choice' && value('choices').split(/\r?\n/).some(s => !s.trim())) throw new Error('Fill in or remove each alternative.')
    return { ...callPayload({ title: value('title'), question: value('question'),
      choices: value('choices'), language: value('language'), when: includeTime ? value('when') : null,
      responseType: value('type'), correctChoice: value('correct'), acceptedAnswers: value('accepted'),
      maxRetries: value('retries'), matchThreshold: value('match'),
      voiceResponse: $dialog.find('[data-call-voice]').is(':checked'),
      voiceName: value('voice-name') === '__default__' ? undefined : value('voice-name'),
      speechRate: value('speech-rate') === '__default__' ? undefined : Number(value('speech-rate')) }), enabled: $dialog.find('[data-call-enabled]').is(':checked') }
  }
  function localTime(ms) {
    const date = new Date(ms)
    return new Date(date - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16)
  }
  function loadQuestion(call) {
    editingId = null
    $dialog.find('[data-call-submit=now]').show()
    $dialog.find('[data-call-submit=later]').text('Schedule call')
    $dialog.find('[data-call-cancel-edit]').hide()
    const value = (key, text) => $dialog.find(`[data-call-${key}]`).val(text)
    value('title', call.title); value('question', call.question)
    value('type', call.response_type || 'choice'); value('choices', (call.choices || []).join('\n'))
    $dialog.find('[data-call-choices]').trigger('input')
    value('correct', call.correct_choice_index == null ? '' : String(call.correct_choice_index))
    value('accepted', (call.accepted_answers || []).join('\n'))
    value('language', call.language || 'sv-SE'); value('retries', call.max_retries ?? 3)
    selectValue('[data-call-voice-name]', call.voice_name ?? '__default__', call.voice_name || 'Device default for this language')
    selectValue('[data-call-speech-rate]', call.speech_rate == null ? '__default__' : String(call.speech_rate), `${call.speech_rate}×`)
    renderVoices()
    const threshold = String(call.match_threshold ?? 0.8)
    const $match = $dialog.find('[data-call-match]')
    if (!$match.find('option').toArray().some(option => option.value === threshold)) $('<option>').val(threshold).text(`Custom tolerance (${threshold})`).appendTo($match)
    value('match', threshold)
    value('when', call.when_ms ? localTime(call.when_ms) : '')
    $dialog.find('[data-call-voice]').prop('checked', call.voice_response !== false)
    $dialog.find('[data-call-enabled]').prop('checked', call.enabled !== false && call.status !== 'disabled').trigger('change')
    $dialog.find('[data-call-type]').trigger('change')
    renderAlternatives()
  }
  function saveImported() {
    if (importedIndex < 0 || editingId) return
    imported[importedIndex] = readForm()
    batchScheduled = false
  }
  function renderImported() {
    if (!$dialog) return
    $dialog.find('[data-call-import-fields]').toggle(imported.length > 0)
    const $drafts = $dialog.find('[data-call-import-drafts]').empty()
    $dialog.find('[data-call-import-count]').text(`${imported.length} questions to review`)
    $dialog.find('[data-call-import-more]').toggle(imported.length > importShown).text(`Show more (${Math.max(0, imported.length - importShown)} remaining)`)
    imported.slice(0, importShown).forEach((call, i) => {
      const $row = $('<div class="study-call-history-row">').appendTo($drafts)
      const $label = $('<label class="study-call-inline">').appendTo($row)
      $('<input type="checkbox">').prop('checked', call.enabled !== false).attr('aria-label', `Enable imported call ${i + 1}`).appendTo($label).on('change', function () { call.enabled = this.checked; batchScheduled = false; renderImported() })
      $('<strong>').text(`${i + 1}. ${call.title}`).appendTo($label)
      $('<p>').text(call.question).appendTo($row)
      $('<span class="study-call-meta">').text(call.response_type === 'text' ? 'Free response' : `${call.choices.length} alternatives`).appendTo($row)
      $('<button type="button" class="btn">').text('Edit').appendTo($row).on('click', () => {
        importedIndex = i; loadQuestion(call); renderImported(); showView('editor', true)
      })
      $('<button type="button" class="btn">').text('Remove').addClass('study-call-danger').appendTo($row).on('click', () => {
        imported.splice(i, 1); importedIndex = -1; batchScheduled = false; renderImported()
      })
    })
    const $select = $dialog.find('[data-call-import-select]').empty()
    $('<option>').val('').text('Choose an imported call to edit').appendTo($select)
    imported.forEach((call, i) => $('<option>').val(String(i)).text(`${i + 1}. ${call.title}`).appendTo($select))
    $select.val(importedIndex < 0 ? '' : String(importedIndex))
    $dialog.find('[data-call-import-schedule]').prop('disabled', !permitted || !batchAvailable || batchScheduled || batchBusy).text(batchScheduled ? 'Added to pending calls' : `Add ${imported.length} calls to pending list`)
    const $preview = $dialog.find('[data-call-import-preview]').empty()
    if (!imported.length) return
    try {
      const planned = scheduleImportedCalls(imported, $dialog.find('[data-call-import-start]').val(), $dialog.find('[data-call-import-spacing]').val())
      planned.slice(0, importShown).forEach((call, i) => $('<div>').text(`${i + 1}. ${new Date(call.when_ms).toLocaleString()} — ${call.title}${call.enabled === false ? ' (disabled)' : ''}`).appendTo($preview))
    } catch (_) { $('<p>').text('Set the first call time to preview calls without their own date.').appendTo($preview) }
    if (imported.length > importShown) $('<p>').text(`Showing the first ${importShown} times.`).appendTo($preview)
    if (!batchAvailable) $('<p>').text('Scheduling a whole file needs an updated Cupitor app. Individual calls can still be loaded and edited.').appendTo($preview)
  }
  function selectValue(selector, value, label) {
    const $select = $dialog.find(selector)
    if (!$select.find('option').toArray().some(option => option.value === value)) $('<option>').val(value).text(label).appendTo($select)
    $select.val(value)
  }
  function renderVoices() {
    if (!$dialog) return
    for (const selector of ['[data-call-default-voice]', '[data-call-voice-name]']) {
      const $select = $dialog.find(selector), previous = $select.val()
      $select.empty()
      if (selector.includes('voice-name')) $('<option>').val('__default__').text('Use Settings voice').appendTo($select)
      $('<option>').val('').text('Device default for this language').appendTo($select)
      const language = String($dialog.find('[data-call-language]').val() || 'sv-SE').split('-')[0].toLowerCase()
      voices.filter(voice => !selector.includes('voice-name') || voice.language.split('-')[0].toLowerCase() === language).forEach(voice => {
        $('<option>').val(voice.name).text(`${voice.label || voice.name}${voice.network ? ' (online)' : ''}`).appendTo($select)
      })
      selectValue(selector, previous ?? (selector.includes('voice-name') ? '__default__' : defaultVoice), previous ? `Saved voice: ${previous}` : 'Device default for this language')
    }
  }
  async function loadVoices(force = false) {
    if (!voiceSelection || voicesBusy || (voicesLoaded && !force)) return
    voicesBusy = true
    $dialog.find('[data-call-voices-note]').text('Loading Android voices…')
    try {
      const data = await client.rpc('getVoices')
      voices = (data.voices || []).filter(voice => typeof voice.name === 'string' && typeof voice.language === 'string')
      voicesLoaded = true; renderVoices()
      $dialog.find('[data-call-voices-note]').text(voices.length ? `${voices.length} available voices. A selected voice is used for questions in its language; other languages keep the device default.` : 'No voices found. Install a voice in Android speech settings, then refresh voices.')
    } catch (e) { $dialog.find('[data-call-voices-note]').text('Could not load voices. Use Device default or open Android speech settings.') }
    finally { voicesBusy = false }
  }
  async function previewVoice(editor = false) {
    let name = $dialog.find(editor ? '[data-call-voice-name]' : '[data-call-default-voice]').val()
    let rate = $dialog.find(editor ? '[data-call-speech-rate]' : '[data-call-default-rate]').val()
    if (name === '__default__') name = defaultVoice
    if (rate === '__default__') rate = defaultRate
    const chosen = voices.find(voice => voice.name === name)
    const language = editor ? $dialog.find('[data-call-language]').val() : chosen?.language || $dialog.find('[data-call-preview-language]').val()
    try { await client.rpc('previewVoice', { voice_name: name || '', speech_rate: Number(rate), language }); status('Voice preview playing.') }
    catch (e) { reportError(e) }
  }

  function download(name, data) {
    const url = win.URL.createObjectURL(new win.Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }))
    const link = win.document.createElement('a'); link.href = url; link.download = name; link.click()
    win.setTimeout(() => win.URL.revokeObjectURL(url), 1000)
  }
  async function submit(immediate) {
    const $buttons = $dialog.find('[data-call-submit]').prop('disabled', true)
    let saved = false
    try {
      saveImported()
      const payload = readForm(!immediate)
      if (!immediate && !payload.when_ms) throw new Error('Choose a date and time.')
      if (!voiceAvailable) payload.voice_response = false
      const op = editingId ? 'update' : immediate ? 'callNow' : 'schedule'
      await client.rpc(op, { ...payload, ...(editingId ? { id: editingId } : {}) })
      saved = true
      editingId = null
      $dialog.find('[data-call-submit=now]').show()
      $dialog.find('[data-call-submit=later]').text('Schedule call')
      $dialog.find('[data-call-cancel-edit]').hide()
      importedIndex = -1; showView('list')
      status(immediate ? 'Calling…' : 'Call saved.')
      await refresh()
    } catch (e) {
      status(saved ? 'Call saved. Reopen this panel to refresh its status.' : (errorMessages[e.message] || e.message), !saved)
    } finally { $buttons.prop('disabled', !permitted); $dialog.find('[data-call-enabled]').trigger('change'); renderImported() }
  }

  function open() {
    if ($dialog) { showView('list'); $dialog.find('[data-call-history]').hide(); $dialog.find('[data-call-history-toggle]').attr('aria-expanded', 'false'); $dialog.dialog('open'); refresh().catch(e => reportError(e)); return }
    $dialog = $('<div id="studyCallsDialog" class="study-calls-dialog">').appendTo('body').html(`
      <div class="study-call-navigation" data-call-back-bar style="display:none;"><button type="button" class="btn" data-call-back data-call-back-top>← Back to pending calls</button></div>
      <div class="study-call-heading"><span class="study-call-phone" aria-hidden="true">☎</span><div><h2 data-call-view-title>Pending calls</h2><p data-call-view-description>Your questions, ready for voice practice.</p></div></div>
      <div class="study-call-nav" data-call-nav>
        <button type="button" class="btn" data-call-history-toggle aria-expanded="false" aria-controls="studyCallHistory"><span data-call-history-count>History</span></button>
        <button type="button" class="btn" data-call-open-settings>Settings</button>
        <button type="button" class="btn" data-call-refresh>Refresh</button>
      </div>
      <p class="study-call-info" data-call-capabilities></p>
      <div class="study-call-permissions">
        <button type="button" class="btn" data-call-permission>Enable notifications</button>
        <button type="button" class="btn" data-call-fullscreen>Allow full-screen ringing</button>
        <button type="button" class="btn" data-call-exact>Allow precise timing</button>
      </div>
      <div data-call-view="list">
        <div class="study-call-actions study-call-main-actions"><button type="button" class="btn btn-primary" data-call-add>+ Add call</button><button type="button" class="btn" data-call-open-import>Import file</button></div>
        <div class="study-call-list-caption"><strong data-call-pending-count></strong><span data-call-capacity></span></div>
        <label data-call-search-wrap style="display:none;">Find a question<input type="search" placeholder="Search questions" data-call-search></label>
        <div data-call-pending></div><button type="button" class="btn" data-call-pending-more style="display:none;">Show more</button>
      </div>
      <div data-call-view="history" style="display:none;">
        <div id="studyCallHistory" data-call-history style="display:none;"><div data-call-history-rows></div></div>
        <button type="button" class="btn" data-call-back>Back to pending calls</button>
      </div>
      <div data-call-view="settings" style="display:none;">
        <section class="study-call-section"><h3>Call list capacity</h3>
          <label>Maximum pending calls<input type="number" min="1" max="5000" step="1" value="50" data-call-limit></label>
          <p class="study-call-hint">Choose 1–5,000 calls. This includes disabled calls and applies across all profiles. Default: 50.</p>
          <p class="study-call-hint" data-call-limit-note></p>
          <p class="study-call-hint">Your whole list is kept. Upcoming calls are scheduled automatically as the queue moves forward.</p>
        </section>
        <section class="study-call-section"><h3>Speaking voice</h3>
          <label>Default voice<select data-call-default-voice><option value="">Device default for this language</option></select></label>
          <label>Speaking speed<select data-call-default-rate><option value="0.5">0.5× — very slow</option><option value="0.75">0.75× — slower</option><option value="1" selected>1× — normal</option><option value="1.25">1.25× — faster</option><option value="1.5">1.5× — very fast</option></select></label>
          <label>Preview language<input data-call-preview-language value="sv-SE" placeholder="sv-SE or en-GB"></label>
          <p class="study-call-hint" data-call-voices-note></p>
          <div class="study-call-actions"><button type="button" class="btn" data-call-preview-voice>▶ Preview voice</button><button type="button" class="btn" data-call-stop-preview>Stop</button><button type="button" class="btn" data-call-reload-voices>Refresh voices</button><button type="button" class="btn" data-call-manage-voices>Android speech settings</button></div>
        </section>
        <div class="study-call-actions"><button type="button" class="btn btn-primary" data-call-save-settings>Save settings</button><button type="button" class="btn" data-call-back>Back to pending calls</button></div>
      </div>
      <div data-call-view="import" style="display:none;">
        <div class="study-call-upload"><strong>Import your questions</strong><p class="study-call-hint" data-call-import-help>JSON file · up to 1 MB</p>
          <input type="file" accept=".json,application/json,text/plain" data-call-import-file hidden>
          <button type="button" class="btn btn-primary" data-call-choose-file>Choose JSON file</button>
          <p class="study-call-file-name" data-call-import-name>No file selected</p>
        </div>
        <details class="study-call-settings"><summary>Or paste JSON</summary><label>JSON content<textarea data-call-import-paste rows="5" placeholder="Paste the complete JSON document here"></textarea></label><button type="button" class="btn" data-call-import-paste-submit>Import pasted JSON</button></details>
        <div class="study-call-actions"><button type="button" class="btn" data-call-import-load-example>Load example</button><button type="button" class="btn" data-call-import-example>Download example JSON</button></div>
        <div data-call-import-fields style="display:none;">
          <div class="study-call-section-title"><h3 data-call-import-count></h3><button type="button" class="btn" data-call-import-export>Export edited calls</button></div>
          <div data-call-import-drafts></div><button type="button" class="btn" data-call-import-more style="display:none;">Show more</button>
          <select data-call-import-select hidden aria-label="Imported call"></select>
          <section class="study-call-section"><h3>When to call</h3>
            <div class="study-call-grid"><label>First call time<input type="datetime-local" data-call-import-start></label><label>Minutes between calls<input type="number" min="1" max="1440" value="5" data-call-import-spacing></label></div>
            <p class="study-call-hint">Calls with their own date keep it. Other calls use the first time and interval.</p>
            <details><summary>Preview call times</summary><div data-call-import-preview></div></details>
          </section>
          <button type="button" class="btn btn-primary study-call-wide" data-call-import-schedule>Add imported calls to pending list</button>
        </div>
        <button type="button" class="btn study-call-back" data-call-back>Back to pending calls</button>
      </div>
      <div data-call-view="editor" style="display:none;">
        <section class="study-call-section"><h3>Question</h3>
          <label>Call title<input data-call-title maxlength="120" value="Study question" placeholder="e.g. Swedish vocabulary"></label>
          <label>Read aloud<textarea data-call-question rows="3" maxlength="4000" placeholder="What would you like Cupitor to ask?"></textarea></label>
          <details><summary>Use text from study reminders</summary><label>Reminder<select data-call-source></select></label></details>
        </section>
        <section class="study-call-section"><h3>Answer</h3>
          <label>Answer type<select data-call-type><option value="choice">Multiple choice</option><option value="text">Free response</option></select></label>
          <div data-call-choice-fields><p class="study-call-hint">Select the correct answer using its circle.</p><div data-call-alternatives></div>
            <button type="button" class="btn" data-call-alternative-add>+ Add alternative</button>
            <textarea data-call-choices hidden>Yes\nNo</textarea><select data-call-correct hidden aria-label="Correct alternative"></select>
          </div>
          <div data-call-text-fields style="display:none;"><label>Accepted answers<textarea data-call-accepted rows="3" placeholder="One correct answer or phrasing per line"></textarea></label><p class="study-call-hint">One answer per line. Small speech-to-text errors are tolerated.</p></div>
        </section>
        <section class="study-call-section"><h3>When to call</h3><label>Date and time<input type="datetime-local" data-call-when></label><label class="study-call-inline"><input type="checkbox" checked data-call-enabled>Enabled</label></section>
        <details class="study-call-settings"><summary>Voice and answer settings</summary>
          <label><input type="checkbox" checked data-call-voice>Allow spoken answers</label><p class="study-call-hint" data-call-voice-note></p>
          <label>Speech language<input data-call-language value="sv-SE" placeholder="sv-SE or en-GB"></label>
          <label>Speaking voice<select data-call-voice-name><option value="__default__">Use Settings voice</option><option value="">Device default for this language</option></select></label>
          <label>Speaking speed<select data-call-speech-rate><option value="__default__">Use Settings speed</option><option value="0.5">0.5×</option><option value="0.75">0.75×</option><option value="1">1× — normal</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option></select></label>
          <button type="button" class="btn" data-call-preview-editor>▶ Preview voice</button>
          <label>Retries after first attempt<input type="number" min="0" max="10" step="1" value="3" data-call-retries></label><p class="study-call-hint">Stops as soon as the answer is correct. Incorrect or unclear answers retry automatically.</p>
          <label>Answer matching<select data-call-match><option value="0.8">Fuzzy — tolerate speech errors</option><option value="0.9">Stricter</option><option value="1">Exact after normalization</option></select></label>
        </details>
        <div class="study-call-actions study-call-editor-actions">
          <button type="button" class="btn btn-primary" data-call-submit="later">Schedule call</button><button type="button" class="btn" data-call-submit="now">Call me now</button>
          <button type="button" class="btn" data-call-cancel-edit hidden>Cancel editing</button>
          <button type="button" class="btn btn-primary" data-call-import-save style="display:none;">Save imported call</button><button type="button" class="btn" data-call-editor-cancel>Cancel</button>
        </div>
      </div>
      <p role="status" aria-live="polite" data-call-status></p>
    `)
    $dialog.dialog({ title: 'Study calls', dialogClass: 'study-call-window cupitor-panel-window', width: Math.min(680, win.innerWidth - 24), modal: true, autoOpen: true })
    $dialog.closest('.ui-dialog').find('.ui-dialog-titlebar-close').empty().text('×').attr('aria-label', 'Close study calls')
    $dialog.on('change', '[data-call-enabled]', function () {
      $dialog.find('[data-call-submit=now]').prop('disabled', !permitted || !this.checked)
    })
    $dialog.on('click', '[data-call-add]', () => {
      try { saveImported() } catch (e) { reportError(e); return }
      importedIndex = -1
      loadQuestion({ title: 'Study question', question: '', response_type: 'choice', choices: ['Yes', 'No'] })
      renderImported(); showView('editor', true); $dialog.find('[data-call-question]').trigger('focus')
      status('Enter the question, answer and date, then choose Schedule call.')
    })
    $dialog.on('click', '[data-call-open-import]', () => { importedIndex = -1; showView('import', true) })
    $dialog.on('click', '[data-call-open-settings]', () => { showView('settings', true); refresh().then(() => loadVoices()).catch(reportError) })
    $dialog.on('click', '[data-call-save-settings]', async function () {
      const limit = Number($dialog.find('[data-call-limit]').val())
      if (!Number.isInteger(limit) || limit < 1 || limit > MAX_CALL_IMPORT) { status('Choose a whole number from 1 to 5,000.', true); return }
      this.disabled = true
      try { await client.rpc('setSettings', { pending_limit: limit, ...(voiceSelection ? { voice_name: $dialog.find('[data-call-default-voice]').val(), speech_rate: Number($dialog.find('[data-call-default-rate]').val()) } : {}) }); await refresh(); status('Settings saved.') }
      catch (e) { reportError(e) }
      finally { this.disabled = !settingsAvailable }
    })
    $dialog.on('click', '[data-call-preview-voice]', () => previewVoice())
    $dialog.on('click', '[data-call-preview-editor]', () => previewVoice(true))
    $dialog.on('click', '[data-call-stop-preview]', () => client.rpc('stopVoicePreview').catch(reportError))
    $dialog.on('click', '[data-call-reload-voices]', () => loadVoices(true))
    $dialog.on('click', '[data-call-manage-voices]', () => client.rpc('openVoiceSettings').catch(reportError))
    $dialog.on('change', '[data-call-language]', renderVoices)
    $dialog.on('dialogclose', () => { if (voiceSelection) client.rpc('stopVoicePreview').catch(() => {}) })
    $dialog.on('input', '[data-call-search]', () => { pendingShown = 50; renderHistory() })
    $dialog.on('click', '[data-call-pending-more]', () => { pendingShown += 50; renderHistory() })
    $dialog.on('click', '[data-call-import-more]', () => { importShown += 50; renderImported() })
    $dialog.on('click', '[data-call-choose-file]', () => $dialog.find('[data-call-import-file]')[0].click())
    $dialog.on('click', '[data-call-back], [data-call-editor-cancel]', goBack)
    $dialog.on('click', '[data-call-history-toggle]', function () {
      if (currentView === 'history') goBack()
      else showView('history', true)
    })
    $dialog.on('click', '[data-call-cancel-edit]', () => {
      editingId = null; $dialog.find('[data-call-submit=now]').show()
      $dialog.find('[data-call-submit=later]').text('Schedule call'); $dialog.find('[data-call-cancel-edit]').hide()
      status('Editing cancelled.')
    })
    function importText(text, name) {
      const calls = parseCallImport(text, Date.now(), pendingLimit)
      imported = calls; importedIndex = -1; importShown = 50; batchScheduled = false
      $dialog.find('[data-call-import-name]').text(name)
      renderImported(); showView('import'); status(`Imported ${calls.length} calls. Review them before adding to pending.`)
    }
    $dialog.on('click', '[data-call-import-load-example]', () => { try { importText(JSON.stringify(CALL_IMPORT_EXAMPLE), 'Example questions') } catch (e) { reportError(e) } })
    $dialog.on('click', '[data-call-import-example]', () => download('study-calls-example.json', CALL_IMPORT_EXAMPLE))
    $dialog.on('click', '[data-call-import-paste-submit]', () => { try { importText($dialog.find('[data-call-import-paste]').val(), 'Pasted JSON') } catch (e) { reportError(e) } })
    $dialog.on('change', '[data-call-import-file]', async function () {
      const file = this.files?.[0]
      if (!file) return
      const $choose = $dialog.find('[data-call-choose-file]').prop('disabled', true).text('Reading file…')
      try {
        if (file.size > 1024 * 1024) throw new Error('Choose a JSON file smaller than 1 MB.')
        importText(await file.text(), file.name || 'Selected JSON file')
      } catch (e) { reportError(e) }
      finally { this.value = ''; $choose.prop('disabled', false).text('Choose JSON file') }
    })
    $dialog.on('change', '[data-call-import-select]', function () {
      const next = this.value
      try { saveImported() } catch (e) { this.value = String(importedIndex); reportError(e); return }
      importedIndex = next === '' ? -1 : Number(next)
      if (importedIndex >= 0) { loadQuestion(imported[importedIndex]); showView('editor') }
      renderImported()
    })
    $dialog.on('click', '[data-call-import-save]', () => {
      try { saveImported(); importedIndex = -1; renderImported(); showView('import'); status('Changes saved to the imported call.') } catch (e) { reportError(e) }
    })
    $dialog.on('click', '[data-call-import-export]', () => {
      try { saveImported(); download('study-calls-edited.json', { version: 1, calls: imported }); renderImported() } catch (e) { reportError(e) }
    })
    $dialog.on('input change', '[data-call-import-start], [data-call-import-spacing]', () => { batchScheduled = false; renderImported() })
    $dialog.on('click', '[data-call-import-schedule]', async function () {
      if (batchBusy || batchScheduled || !permitted || !batchAvailable) return
      batchBusy = true
      this.disabled = true
      try {
        saveImported()
        const calls = scheduleImportedCalls(imported, $dialog.find('[data-call-import-start]').val(), $dialog.find('[data-call-import-spacing]').val())
        if (!voiceAvailable) calls.forEach(c => { c.voice_response = false })
        await client.rpc('scheduleBatch', { calls })
        batchScheduled = true; importedIndex = -1; showView('list'); status(`Added ${calls.length} calls to the pending list.`); await refresh()
      } catch (e) { reportError(e) }
      finally { batchBusy = false; renderImported() }
    })
    $dialog.on('click', '[data-call-submit]', function () { submit(this.dataset.callSubmit === 'now') })
    const request = op => client.rpc(op).then(refresh).catch(e => reportError(e))
    $dialog.on('click', '[data-call-permission]', () => request('requestPermission'))
    $dialog.on('click', '[data-call-fullscreen]', () => request('openFullScreenSettings'))
    $dialog.on('click', '[data-call-exact]', () => request('openAlarmSettings'))
    $dialog.on('click', '[data-call-refresh]', () => refresh().catch(e => reportError(e)))
    const updateCorrectChoices = () => {
      const $correct = $dialog.find('[data-call-correct]')
      const previous = $correct.find('option:selected').data('label')
      $correct.empty().append($('<option>').val('').text('Choose the correct alternative'))
      const labels = $dialog.find('[data-call-choices]').val().split(/\r?\n/).map(s => s.trim())
      labels.forEach((label, index) => $('<option>').val(String(index)).text(`${index + 1}. ${label}`).data('label', label).appendTo($correct))
      if (previous && labels.filter(label => label === previous).length === 1) $correct.val(String(labels.indexOf(previous)))
    }
    renderAlternatives = function () {
      const labels = $dialog.find('[data-call-choices]').val().split(/\r?\n/)
      const selected = () => Number($dialog.find('[data-call-correct]').val() || -1)
      const correct = selected()
      const $rows = $dialog.find('[data-call-alternatives]').empty()
      labels.forEach((label, i) => {
        const $row = $('<div class="study-call-alternative">').appendTo($rows)
        $('<input type="radio" name="study-call-correct">').prop('checked', i === correct).attr('aria-label', `Alternative ${i + 1} is correct`).appendTo($row).on('change', () => $dialog.find('[data-call-correct]').val(String(i)))
        $('<input type="text" maxlength="200">').val(label).attr('aria-label', `Alternative ${i + 1}`).appendTo($row).on('input', function () {
          const current = selected()
          labels[i] = this.value
          $dialog.find('[data-call-choices]').val(labels.join('\n')); updateCorrectChoices()
          $dialog.find('[data-call-correct]').val(current >= 0 ? String(current) : '')
        })
        $('<button type="button" class="btn">').text('Remove').attr('aria-label', `Remove alternative ${i + 1}`).prop('disabled', labels.length <= 2).appendTo($row).on('click', () => {
          const correct = selected()
          labels.splice(i, 1); $dialog.find('[data-call-choices]').val(labels.join('\n')); updateCorrectChoices()
          $dialog.find('[data-call-correct]').val(correct === i ? '' : String(correct > i ? correct - 1 : correct)); renderAlternatives()
        })
      })
      $dialog.find('[data-call-alternative-add]').prop('disabled', labels.length >= 9)
    }
    $dialog.on('click', '[data-call-alternative-add]', () => {
      $dialog.find('[data-call-choices]').val($dialog.find('[data-call-choices]').val() + '\n'); updateCorrectChoices(); renderAlternatives()
    })
    $dialog.on('input', '[data-call-choices]', () => { updateCorrectChoices(); renderAlternatives() })
    $dialog.on('change', '[data-call-correct]', renderAlternatives)
    $dialog.on('change', '[data-call-type]', function () {
      const choice = this.value === 'choice'
      $dialog.find('[data-call-choice-fields]').toggle(choice)
      $dialog.find('[data-call-text-fields]').toggle(!choice)
    })
    updateCorrectChoices(); renderAlternatives()
    $dialog.on('change', '[data-call-source]', function () {
      const item = $(this).find('option:selected').data('item')
      if (!item) return
      $dialog.find('[data-call-title]').val(item.title.slice(0, 120))
      $dialog.find('[data-call-question]').val([item.title, item.body].filter(Boolean).join('\n'))
    })
    renderSources(); renderHistory(); renderImported()
    refresh().catch(e => reportError(e))
  }

  win.addEventListener('cupitorCalls', e => {
    if (!e.detail || !Array.isArray(e.detail.calls)) return
    snapshot = e.detail
    win.__cupitorCalls = snapshot
    renderHistory()
  })
  win.addEventListener('cupitorNotifLists', renderSources)
  win.addEventListener('cupitorAppLifecycle', e => {
    if (e.detail?.isForeground && $dialog?.is(':visible')) refresh().catch(() => {})
  })
  win._openStudyCalls = open
  const ready = () => $('#studyCallsBtn').toggle(client.available()).on('click', open)
  if (win.document.readyState === 'loading') $(ready); else ready()
  return { client, open }
}
