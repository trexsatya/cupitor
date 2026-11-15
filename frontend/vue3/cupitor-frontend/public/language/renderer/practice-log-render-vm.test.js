import { statusInfo, buildPracticeLogPlanVM, buildPracticeLogHistoryVM } from './practice-log-render-vm'

test('recognizes saved statuses and falls back to Not started', () => {
  expect(statusInfo('done').label).toBe('Done')
  expect(statusInfo('skipped').label).toBe('Skipped')
  expect(statusInfo('invalid').value).toBe('not_started')
})

test('shows planned activities in catalog order and offers unused activities for new goals', () => {
  const vm = buildPracticeLogPlanVM(['Reading', 'Writing', 'Listening'], {
    Reading: { status: 'not_started', goal: 'Read', unit: 'pages', target: 30, progress: 0 },
    Writing: { status: 'done', notes: 'wrote a journal' },
    Listening: { status: 'not_started', notes: '' },
    Grammar: { goal: 'Practice word order', unit: '', progress: 40, status: 'in_progress' },
  }, '2026-W24')
  expect(vm.items.map(item => item.name)).toEqual(['Reading', 'Writing', 'Grammar'])
  expect(vm.available).toEqual(['Listening'])
  expect(vm.done).toBe(1)
  expect(vm.items.map(item => item.measure.label)).toEqual(['0 / 30 pages', '', '40%'])
  expect(vm.items[1].notes).toBe('wrote a journal')
})

test('history shows meaningful past weeks in reverse order and keeps legacy notes', () => {
  const vm = buildPracticeLogHistoryVM({
    historyRetainWeeks: 2,
    weeks: {
      '2026-W21': { Reading: { status: 'done' } },
      '2026-W22': { Reading: { status: 'done', notes: '  spent 1h on a novel  ' } },
      '2026-W23': { Writing: { status: 'in_progress', goal: 'Write', progress: 70 } },
      '2026-W24': { Writing: { status: 'not_started', notes: '' } },
      '2026-W25': { Listening: { goal: 'Current goal' } },
      '2026-W26': { Listening: { goal: 'Next goal' } },
    },
  }, '2026-W25')
  expect(vm.weeks.map(week => week.label)).toEqual(['2026-W23', '2026-W22'])
  expect(vm.weeks[0].items[0].measure.label).toBe('70%')
  expect(vm.weeks[1].items[0].notes).toBe('spent 1h on a novel')
  expect(vm.weeks[1].done).toBe(1)
})

test('history is empty before any past week has content', () => {
  expect(buildPracticeLogHistoryVM(null).state).toBe('empty')
  expect(buildPracticeLogHistoryVM({ weeks: { '2026-W24': {} } }).state).toBe('empty')
})
