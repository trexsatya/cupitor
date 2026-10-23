import { buildNotifItems } from './notif-bridge.js'
import { isManualItem } from './recordings-merge.js'
import { cardPlainText } from './card-html.js'
import { callPayload } from './study-calls.js'

export const playlistCallDefaults = {
  direction: 'source-target', response_type: 'text', language: 'sv-SE',
  max_retries: 3, match_threshold: 0.8, voice_response: true,
}

// Stable ids and ordering are the notification flow's ids and ordering.
// Full question/answer text lives in payload, separate from shade truncation.
export function buildPlaylistCallItems(name, items, settings = {}) {
  const config = { ...playlistCallDefaults, ...settings }
  const pairs = new Map()
  const plain = value => cardPlainText(value || '').trim()
  Object.entries(items || {}).forEach(([st, byWord]) => {
    Object.entries(byWord || {}).forEach(([word, entries]) => {
      let grouped = false
      entries.forEach(item => {
        if (!item || item.enabled === false) return
        if (!isManualItem(item)) { grouped = true; return }
        const source = plain(item.source), target = plain(item.target)
        const reverse = config.direction === 'target-source'
        const both = source && target
        const prompt = both ? (reverse ? target : source) : source || target
        const answer = both ? (reverse ? source : target) : prompt
        const question = both ? prompt : `${config.language.startsWith('sv') ? 'Upprepa texten' : 'Repeat the text'}: ${prompt}`
        const key = `card:${item.id || `${st}|${word}`}`
        if (!pairs.has(key)) pairs.set(key, { question, answer })
      })
      if (grouped) pairs.set(`w:${st}|${word}`, {
        question: `${config.language.startsWith('sv') ? 'Upprepa uttrycket' : 'Repeat the expression'}: ${st}`,
        answer: String(st).trim(),
      })
    })
  })
  const keyOf = s => s.normalize('NFKC').toLocaleLowerCase().replace(/[.!?\s]+/g, '')
  const answers = [...new Map([...pairs.values()].map(p => [keyOf(p.answer), p.answer])).values()]
    .map(s => s.replace(/\s+/g, ' ')).filter(s => s && s.length <= 200)
  const out = []
  const skipped = []
  for (const item of buildNotifItems(items)) {
    const pair = pairs.get(item.external_id)
    if (!pair) { skipped.push(item.title); continue }
    const hash = [...item.external_id].reduce((n, c) => (Math.imul(n, 31) + c.charCodeAt(0)) >>> 0, 0)
    const pool = answers.filter(a => keyOf(a) !== keyOf(pair.answer))
    if (pool.length) pool.push(...pool.splice(0, hash % pool.length))
    const choiceAnswer = pair.answer.replace(/\s+/g, ' ')
    const choices = [choiceAnswer, ...pool.slice(0, 3)]
    const index = hash % choices.length
    choices.splice(0, 1); choices.splice(index, 0, choiceAnswer)
    try {
      const payload = callPayload({ title: name.slice(0, 120), question: pair.question,
        choices: choices.join('\n'), language: config.language, responseType: config.response_type,
        correctChoice: index, acceptedAnswers: pair.answer.replace(/\s+/g, ' '), maxRetries: config.max_retries,
        matchThreshold: config.match_threshold, voiceResponse: config.voice_response })
      delete payload.title
      // A multiline card is one accepted answer, not several alternatives.
      if (payload.response_type === 'text') {
        if (!pair.answer || pair.answer.length > 500) throw new Error('answer_length')
        payload.accepted_answers = [pair.answer]
      }
      out.push({ ...item, payload: { pl: name, xid: item.external_id, study_call: payload } })
    } catch (_) { skipped.push(item.title) }
  }
  return { items: out, skipped }
}
