import { buildPlaylistCallItems } from './playlist-calls'

const card = (id, source, target, extra) => ({ manual: true, id, source, target, ...extra })
const items = cards => ({ Manual: { Card: cards } })

test('playlist cards become full questions with real answer keys and notification identity', () => {
  const long = 'A long question '.repeat(20)
  const result = buildPlaylistCallItems('Words', items([
    card('one', `<b>${long}</b>`, 'ett svar\nmed flera rader'), card('off', 'disabled', 'x', { enabled: false }),
  ]))
  expect(result.items).toHaveLength(1)
  const item = result.items[0]
  expect(item.external_id).toBe('card:one')
  expect(item.title).toHaveLength(50)
  expect(item.payload.pl).toBe('Words')
  expect(item.payload.study_call).toMatchObject({ question: long.trim(), response_type: 'text',
    accepted_answers: ['ett svar\nmed flera rader'], max_retries: 3, match_threshold: 0.8, voice_response: true })
})

test('direction reverses paired cards; one-sided cards and words explicitly ask for repetition', () => {
  const result = buildPlaylistCallItems('Words', { ...items([card('pair', 'hej', 'hello'), card('one', 'ensam', '')]),
    uttryck: { form: [{ id: 'clip' }, { id: 'clip2' }] } }, { direction: 'target-source' })
  expect(result.items[0].payload.study_call).toMatchObject({ question: 'hello', accepted_answers: ['hej'] })
  expect(result.items[1].payload.study_call).toMatchObject({ question: 'Upprepa texten: ensam', accepted_answers: ['ensam'] })
  expect(result.items[2].external_id).toBe('w:uttryck|form')
  expect(result.items[2].payload.study_call.accepted_answers).toEqual(['uttryck'])
})

test('alternatives come from distinct playlist answers, with a stable correct index', () => {
  const data = items([card('a', 'katt', 'cat'), card('b', 'hund', 'dog'), card('c', 'kisse', 'Cat!')])
  const config = { response_type: 'choice', max_retries: 2, voice_response: false }
  const first = buildPlaylistCallItems('Animals', data, config)
  expect(first).toEqual(buildPlaylistCallItems('Animals', data, config))
  for (const item of first.items) {
    const q = item.payload.study_call
    expect(q.choices).toHaveLength(2)
    expect(q.choices[q.correct_choice_index].toLowerCase().replace('!', '')).toBe(item.external_id === 'card:b' ? 'dog' : 'cat')
    expect(q.max_retries).toBe(2)
    expect(q.voice_response).toBe(false)
  }
  expect(buildPlaylistCallItems('One', items([card('a', 'katt', 'cat')]), config).items).toEqual([])
})

test('invalid and oversized answers are counted as skipped, never truncated into a wrong key', () => {
  const result = buildPlaylistCallItems('Words', items([card('a', 'question', 'x'.repeat(501)), card('b', '', '')]))
  expect(result.items).toEqual([])
  expect(result.skipped).toHaveLength(1)
})


test('native snapshots retain choice mode and direction when local settings are absent', () => {
  const result = buildPlaylistCallItems('Animals', items([card('cat', 'katt', 'cat'), card('dog', 'hund', 'dog')]),
    { answer_type: 'choice', direction: 'target-source' })
  expect(result.items[0].payload.study_call).toMatchObject({ question: 'cat', response_type: 'choice' })
})
