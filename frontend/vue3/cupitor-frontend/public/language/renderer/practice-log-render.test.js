/** @jest-environment jsdom */
import { buildPracticeLogPlanVM, buildPracticeLogHistoryVM } from './practice-log-render-vm'
import {
  renderPracticeLogPlan, renderPracticeLogHistory,
  openPracticeLogGoalEditor, openPracticeLogProgressEditor, openPracticeLogWeekNoteEditor,
} from './practice-log-render'

const vm = (isNext = false) => buildPracticeLogPlanVM(['Reading', 'Writing'], {
  Reading: { goal: 'Read Ordens värld', unit: 'pages', target: 30, progress: 12, status: 'in_progress' },
  Writing: { goal: 'Write a reflection', progress: 40, status: 'in_progress' },
}, '2026-W46', isNext)

function makeDialog() {
  const dialog = document.createElement('dialog')
  dialog.showModal = () => { dialog.open = true }
  dialog.close = () => { dialog.open = false }
  return dialog
}

test('current goals expose edit and update actions, while next week is for planning', () => {
  const mount = document.createElement('div')
  const date = document.createElement('div')
  const editGoal = jest.fn()
  const update = jest.fn()
  const current = vm()
  renderPracticeLogPlan(current, mount, { editGoal, update }, date)
  expect(date.textContent).toContain('9–15 Nov')
  expect(mount.textContent).toContain('12 / 30 pages')
  expect(mount.textContent).toContain('40%')
  expect(mount.querySelector('textarea')).toBeNull()
  mount.querySelector('[aria-label="Edit Reading goal"]').click()
  expect(editGoal).toHaveBeenCalledWith(current.items[0])
  mount.querySelector('[aria-label="Update Writing progress"]').click()
  expect(update).toHaveBeenCalledWith(current.items[1])

  renderPracticeLogPlan(vm(true), mount, { editGoal, update }, date)
  expect(mount.querySelector('.practice-log-update')).toBeNull()
  expect(mount.textContent).toContain('Read Ordens värld')
})

test('goal editor has one text field, retaining legacy notes in the draft', () => {
  const dialog = makeDialog()
  const save = jest.fn()
  openPracticeLogGoalEditor(dialog, {
    name: 'Writing', goal: 'Write a reflection', notes: 'Use the interview.',
  }, '2026-W46', save)
  const textarea = dialog.querySelector('textarea')
  expect(textarea.value).toBe('Write a reflection\n\nUse the interview.')
  expect(dialog.querySelector('input').disabled).toBe(true)
  const unit = dialog.querySelector('select')
  expect(unit.selectedOptions[0].textContent).toBe('No target unit')
  unit.value = 'sessions'
  unit.dispatchEvent(new Event('change'))
  expect(dialog.querySelector('input').disabled).toBe(false)
  dialog.querySelector('form').dispatchEvent(new Event('submit'))
  expect(save).toHaveBeenCalledWith({ goal: textarea.value, unit: 'sessions', target: 1 })
})

test('week overview displays the note and opens its own multiline editor', () => {
  const overview = document.createElement('div')
  const dialog = makeDialog()
  const save = jest.fn()
  const current = { ...vm(), note: 'First line\nSecond line' }
  const editWeekNote = () => openPracticeLogWeekNoteEditor(dialog, current.weekLabel, current.note, save)
  renderPracticeLogPlan(current, document.createElement('div'), { editWeekNote }, overview)
  expect(overview.querySelector('.practice-log-week-note p').textContent).toBe(current.note)
  overview.querySelector('[aria-label="Edit week note"]').click()
  const textarea = dialog.querySelector('[aria-label="Week note"]')
  expect(textarea.value).toBe(current.note)
  textarea.value = '  '
  dialog.querySelector('form').dispatchEvent(new Event('submit'))
  expect(save).toHaveBeenCalledWith('')
  expect(dialog.open).toBe(false)
})

test('unitless updates use the percentage slider and counted updates use the stepper', () => {
  const dialog = makeDialog()
  const save = jest.fn()
  openPracticeLogProgressEditor(dialog, vm().items[1], save)
  const slider = dialog.querySelector('input[type="range"]')
  expect(slider.value).toBe('40')
  slider.value = '60'
  slider.dispatchEvent(new Event('input'))
  expect(dialog.querySelector('output').value).toBe('60%')
  dialog.querySelector('form').dispatchEvent(new Event('submit'))
  expect(save).toHaveBeenCalledWith(60)

  openPracticeLogProgressEditor(dialog, vm().items[0], save)
  dialog.querySelector('[aria-label="Add 5 pages"]').click()
  expect(dialog.querySelector('input[type="number"]').value).toBe('17')
  dialog.querySelector('form').dispatchEvent(new Event('submit'))
  expect(save).toHaveBeenLastCalledWith(17)
})

test('history expands the latest week and keeps older weeks collapsible', () => {
  const mount = document.createElement('div')
  const history = buildPracticeLogHistoryVM({ weeks: {
    '2026-W44': { Reading: { status: 'done', notes: 'Read a novel' } },
    '2026-W45': { Writing: { goal: 'Write', progress: 70, status: 'in_progress' } },
  } }, '2026-W46')
  renderPracticeLogHistory(history, mount)
  const [latest, older] = mount.querySelectorAll('[data-week]')
  expect(latest.open).toBe(true)
  expect(latest.textContent).toContain('70%')
  expect(older.open).toBe(false)
  expect(older.querySelector('.practice-log-archived-notes').textContent).toContain('Read a novel')
  latest.open = false
  older.open = true
  renderPracticeLogHistory(history, mount)
  expect(mount.querySelector('[data-week="2026-W44"]').open).toBe(true)
})
