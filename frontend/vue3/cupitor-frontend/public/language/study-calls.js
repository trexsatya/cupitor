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
  correctChoice, acceptedAnswers, maxRetries = 3, matchThreshold = 0.8, voiceResponse = true }, now = Date.now()) {
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
  if (when) {
    const timestamp = new Date(when).getTime()
    if (!Number.isFinite(timestamp) || timestamp <= now || timestamp > now + 366 * 86400000) {
      throw new Error('Choose a future time within the next year.')
    }
    result.when_ms = timestamp
  }
  return result
}

export function installStudyCalls(win, $) {
  const client = createCallClient(win)
  // Public programmatic API for custom study flows and playlist scripts.
  win.cupitorCallRpc = (op, payload) => client.rpc(op, payload)
  let snapshot = win.__cupitorCalls || { calls: [] }
  let $dialog = null
  let permitted = false
  let voiceAvailable = false
  const active = new Set(['scheduled', 'ringing', 'answered'])
  const errorMessages = {
    permission_denied: 'Enable study-call notifications first.',
    too_many_calls: 'There are already 50 pending calls. Cancel one first.',
    busy: 'A study call is already active.',
    timeout: 'Cupitor did not reply. Refresh the call history before trying again.',
  }
  const status = text => $dialog?.find('[data-call-status]').text(text)

  function renderHistory() {
    if (!$dialog) return
    const $history = $dialog.find('[data-call-history]').empty()
    const calls = Array.isArray(snapshot.calls) ? snapshot.calls.slice().sort((a, b) => b.created_at - a.created_at) : []
    if (!calls.length) $('<p>').text('No calls yet.').appendTo($history)
    for (const call of calls) {
      const $row = $('<div class="study-call-history-row">').appendTo($history)
      $('<strong>').text(call.title).appendTo($row)
      $('<div>').text(`${new Date(call.when_ms).toLocaleString()} · ${call.status}`).appendTo($row)
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
      if (active.has(call.status)) {
        $('<button type="button" class="btn">').text('Cancel call').appendTo($row).on('click', async function () {
          this.disabled = true
          try { await client.rpc('cancel', { id: call.id }); await refresh() }
          catch (e) { status(errorMessages[e.message] || e.message); this.disabled = false }
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
    $dialog.find('[data-call-voice]').prop('disabled', !voiceAvailable)
    $dialog.find('[data-call-voice-note]').text(voiceAvailable
      ? 'Say your answer after the question. Microphone permission is requested when needed.'
      : 'Speech recognition is unavailable on this device. You can answer on screen.')
    permitted = enabled && caps.permission === 'granted'
    $dialog.find('[data-call-submit]').prop('disabled', !permitted)
    $dialog.find('[data-call-permission]').toggle(enabled && caps.permission !== 'granted')
    $dialog.find('[data-call-fullscreen]').toggle(enabled && !caps.full_screen)
    $dialog.find('[data-call-exact]').toggle(enabled && !caps.exact_alarms)
    $dialog.find('[data-call-capabilities]').text(!enabled ? 'Study calls need an updated Cupitor Android app.' :
      caps.permission !== 'granted' ? 'Enable notifications to let Cupitor ring.' :
        'Cupitor rings for up to 45 seconds. Answer to hear the question, then speak or answer on screen.')
    await client.rpc('getCalls')
  }

  async function submit(immediate) {
    const $buttons = $dialog.find('[data-call-submit]').prop('disabled', true)
    let saved = false
    try {
      const value = key => $dialog.find(`[data-call-${key}]`).val()
      const when = immediate ? null : value('when')
      if (!immediate && !when) throw new Error('Choose a date and time.')
      const payload = callPayload({ title: value('title'), question: value('question'),
        choices: value('choices'), language: value('language'), when,
        responseType: value('type'), correctChoice: value('correct'), acceptedAnswers: value('accepted'),
        maxRetries: value('retries'), matchThreshold: value('match'),
        voiceResponse: voiceAvailable && $dialog.find('[data-call-voice]').is(':checked') })
      await client.rpc(immediate ? 'callNow' : 'schedule', payload)
      saved = true
      status(immediate ? 'Calling…' : 'Call scheduled.')
      await refresh()
    } catch (e) {
      status(saved ? 'Call saved. Reopen this panel to refresh its status.' : (errorMessages[e.message] || e.message))
    } finally { $buttons.prop('disabled', !permitted) }
  }

  function open() {
    if ($dialog) { $dialog.dialog('open'); refresh().catch(e => status(e.message)); return }
    $dialog = $('<div id="studyCallsDialog" class="study-calls-dialog">').appendTo('body').html(`
      <p data-call-capabilities></p>
      <div class="study-call-permissions">
        <button type="button" class="btn" data-call-permission>Enable notifications</button>
        <button type="button" class="btn" data-call-fullscreen>Allow full-screen ringing</button>
        <button type="button" class="btn" data-call-exact>Allow precise timing</button>
      </div>
      <label>From study reminders<select data-call-source></select></label>
      <label>Call title<input data-call-title maxlength="120" value="Study question"></label>
      <label>Question<textarea data-call-question rows="4" maxlength="4000"></textarea></label>
      <label>Answer type<select data-call-type><option value="choice">Multiple choice</option><option value="text">Free response</option></select></label>
      <div data-call-choice-fields>
        <label>Alternatives — one per line<textarea data-call-choices rows="4">Yes\nNo</textarea></label>
        <label>Correct alternative<select data-call-correct></select></label>
      </div>
      <div data-call-text-fields style="display:none;">
        <label>Accepted answers — one per line<textarea data-call-accepted rows="3" placeholder="Add accepted answers or phrasings"></textarea></label>
      </div>
      <label>Retries after first attempt<input type="number" min="0" max="10" step="1" value="3" data-call-retries></label>
      <p>Stops as soon as the answer is correct. Incorrect or unclear answers retry automatically.</p>
      <label>Answer matching<select data-call-match><option value="0.8">Tolerant of speech-to-text errors</option><option value="0.9">Stricter</option><option value="1">Exact</option></select></label>
      <label><input type="checkbox" checked data-call-voice>Allow spoken answers</label>
      <p data-call-voice-note></p>
      <label>Speech language<input data-call-language value="sv-SE" placeholder="sv-SE or en-GB"></label>
      <label>Date and time<input type="datetime-local" data-call-when></label>
      <div class="study-call-actions">
        <button type="button" class="btn" data-call-submit="now">Call me now</button>
        <button type="button" class="btn" data-call-submit="later">Schedule call</button>
        <button type="button" class="btn" data-call-refresh>Refresh</button>
      </div>
      <p role="status" aria-live="polite" data-call-status></p>
      <h3>Calls and answers</h3><div data-call-history></div>
    `)
    $dialog.dialog({ title: 'Study calls', width: Math.min(500, win.innerWidth - 30), modal: true, autoOpen: true })
    $dialog.on('click', '[data-call-submit]', function () { submit(this.dataset.callSubmit === 'now') })
    const request = op => client.rpc(op).then(refresh).catch(e => status(errorMessages[e.message] || e.message))
    $dialog.on('click', '[data-call-permission]', () => request('requestPermission'))
    $dialog.on('click', '[data-call-fullscreen]', () => request('openFullScreenSettings'))
    $dialog.on('click', '[data-call-exact]', () => request('openAlarmSettings'))
    $dialog.on('click', '[data-call-refresh]', () => refresh().catch(e => status(e.message)))
    const updateCorrectChoices = () => {
      const $correct = $dialog.find('[data-call-correct]')
      const previous = $correct.find('option:selected').data('label')
      $correct.empty().append($('<option>').val('').text('Choose the correct alternative'))
      const labels = $dialog.find('[data-call-choices]').val().split(/\r?\n/).map(s => s.trim()).filter(Boolean)
      labels.forEach((label, index) => $('<option>').val(String(index)).text(`${index + 1}. ${label}`).data('label', label).appendTo($correct))
      if (previous && labels.filter(label => label === previous).length === 1) $correct.val(String(labels.indexOf(previous)))
    }
    $dialog.on('input', '[data-call-choices]', updateCorrectChoices)
    $dialog.on('change', '[data-call-type]', function () {
      const choice = this.value === 'choice'
      $dialog.find('[data-call-choice-fields]').toggle(choice)
      $dialog.find('[data-call-text-fields]').toggle(!choice)
    })
    updateCorrectChoices()
    $dialog.on('change', '[data-call-source]', function () {
      const item = $(this).find('option:selected').data('item')
      if (!item) return
      $dialog.find('[data-call-title]').val(item.title.slice(0, 120))
      $dialog.find('[data-call-question]').val([item.title, item.body].filter(Boolean).join('\n'))
    })
    renderSources(); renderHistory()
    refresh().catch(e => status(errorMessages[e.message] || e.message))
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
  const ready = () => $('#studyCallsBtn').toggle(client.available()).on('click', open)
  if (win.document.readyState === 'loading') $(ready); else ready()
  return { client, open }
}
