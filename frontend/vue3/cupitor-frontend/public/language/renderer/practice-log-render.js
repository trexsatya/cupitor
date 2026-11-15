import { PRACTICE_LOG_UNITS, practiceWeekTitle } from '../practice-log.js'

function element(tag, classes = '', ...children) {
  const node = document.createElement(tag)
  if (classes) node.className = classes
  node.append(...children)
  return node
}

function button(text, className, handler, label) {
  const node = element('button', className, text)
  node.type = 'button'
  if (label) node.setAttribute('aria-label', label)
  node.addEventListener('click', handler)
  return node
}

function icon(name, className = '') {
  const node = element('i', `fas fa-${name} ${className}`)
  node.setAttribute('aria-hidden', 'true')
  return node
}

const activityIcons = new Map(Object.entries({
  Reading: 'book-open', Writing: 'pen', Listening: 'headphones',
  Speaking: 'microphone', Vocabulary: 'list-ul', Grammar: 'font',
}))

function activityIcon(name) {
  return element('span', 'practice-log-activity-icon', icon(activityIcons.get(name) || 'clipboard'))
}

function status(item) {
  return element('span', `pl-status ${item.statusCls}`, item.statusLabel)
}

function completion(done, total) {
  return `${done} of ${total} ${total === 1 ? 'goal' : 'goals'} complete`
}

function bar(item) {
  const progress = element('progress', 'practice-log-progress')
  progress.max = 100
  progress.value = item.measure.percent
  progress.setAttribute('aria-label', `${item.name} progress`)
  return progress
}

export function renderPracticeLogPlan(vm, mount, callbacks, weekLabelEl = null) {
  if (weekLabelEl) {
    const { range, week, year } = vm.dates
    weekLabelEl.replaceChildren(element('div', 'practice-log-date',
      element('h2', '', range), element('span', '', `Week ${week} · ${year}`)))
    if (!vm.isNext && vm.items.length) {
      weekLabelEl.append(element('p', 'practice-log-summary', icon('check-circle'), completion(vm.done, vm.items.length)))
    }
  }
  const cards = vm.items.map(item => {
    const name = element('h3', 'practice-log-item-name', item.name)
    const header = element('div', 'practice-log-item-header', activityIcon(item.name), name)
    if (!vm.isNext) header.append(status(item))
    const goal = button('', 'practice-log-item-goal', () => callbacks.editGoal(item), `Edit ${item.name} goal`)
    goal.append(element('span', '', item.goal || item.notes || 'Set a goal'), icon('pen'))
    const card = element('article', 'practice-log-item', header, goal)
    card.dataset.itemName = item.name
    if (!vm.isNext) {
      const measure = element('div', 'practice-log-measure')
      if (item.measure.label) measure.append(element('strong', '', item.measure.label),
        item.measure.unit ? '' : ' complete')
      if (item.measure.percent !== null) measure.append(bar(item))
      card.append(element('div', 'practice-log-progress-row', measure,
        button('Update', 'practice-log-update', () => callbacks.update(item), `Update ${item.name} progress`)))
    }
    return card
  })
  mount.replaceChildren(...cards)
  if (!cards.length) mount.append(element('p', 'practice-log-empty', 'No goals set for this week.'))
}

export function renderPracticeLogHistory(vm, mount) {
  if (!mount) return
  const openWeeks = new Set([...mount.querySelectorAll('details[open][data-week]')].map(week => week.dataset.week))
  const firstRender = !mount.querySelector('details[data-week]')
  mount.replaceChildren()
  if (!vm.weeks.length) {
    mount.append(element('p', 'practice-log-empty', 'No history yet. Previous weeks appear here once you’ve set a goal or logged progress.'))
    return
  }
  let year
  vm.weeks.forEach((week, index) => {
    if (week.dates.year !== year) {
      year = week.dates.year
      if (year) mount.append(element('h2', 'practice-log-history-year', year))
    }
    const summary = element('summary', 'practice-log-history-week-header',
      element('strong', '', week.dates.range),
      element('span', 'practice-log-week-id', `Week ${week.dates.week}`),
      icon('chevron-down'),
      element('span', 'practice-log-summary', completion(week.done, week.items.length)))
    const group = element('details', 'practice-log-history-week', summary)
    group.dataset.week = week.label
    group.open = openWeeks.has(week.label) || (firstRender && index === 0)
    week.items.forEach(item => {
      const goal = element('div', 'practice-log-history-goal', element('h3', '', item.name))
      if (item.goal) goal.append(element('p', '', item.goal))
      if (item.notes && item.notes !== item.goal) {
        goal.append(element('details', 'practice-log-archived-notes',
          element('summary', '', 'Notes'), element('p', '', item.notes)))
      }
      const outcome = element('div', 'practice-log-history-progress')
      if (item.measure.label) outcome.append(element('strong', '', item.measure.label))
      outcome.append(status(item))
      group.append(element('article', 'practice-log-history-item', activityIcon(item.name), goal, outcome))
    })
    mount.append(group)
  })
}

function field(labelText, control) {
  control.setAttribute('aria-label', labelText)
  return element('label', 'practice-log-field', element('span', '', labelText), control)
}

function option(value, label) {
  const node = element('option', '', label)
  node.value = value
  return node
}

function numberInput(value, min) {
  const input = element('input')
  input.type = 'number'
  input.inputMode = 'numeric'
  input.step = '1'
  input.min = String(min)
  input.max = String(Number.MAX_SAFE_INTEGER)
  input.value = value
  return input
}

function stepper(input, min) {
  const adjust = delta => {
    input.value = String(Math.max(min, Math.min(Number.MAX_SAFE_INTEGER, (input.valueAsNumber || 0) + delta)))
    input.dispatchEvent(new Event('input'))
  }
  return element('div', 'practice-log-stepper',
    button('−', '', () => adjust(-1), 'Decrease by one'), input,
    button('+', '', () => adjust(1), 'Increase by one'))
}

function openEditor(dialog, title, context, controls, action, onSave, extra = null) {
  const heading = element('h2', '', title)
  heading.id = 'practiceLogEditorTitle'
  const form = element('form', '',
    element('div', 'practice-log-editor-header', heading,
      button('×', 'practice-log-ghost', () => dialog.close(), 'Close editor')),
    ...(context ? [context] : []), ...controls)
  const save = element('button', 'practice-log-primary', action)
  save.type = 'submit'
  form.append(save)
  if (extra) form.append(extra)
  form.addEventListener('submit', event => {
    event.preventDefault()
    const result = onSave()
    if (result !== false && dialog.contains(form)) dialog.close()
  })
  dialog.replaceChildren(form)
  if (!dialog.open) dialog.showModal()
  form.querySelector('[autofocus], input, textarea, select')?.focus()
}

function editorContext(item, weekLabel) {
  const detail = weekLabel ? practiceWeekTitle(weekLabel) : item.goal
  return element('p', 'practice-log-editor-context', activityIcon(item.name),
    element('span', '', element('strong', '', item.name), detail ? ` · ${detail}` : ''))
}

export function openPracticeLogGoalEditor(dialog, item, weekLabel, saveGoal, removeActivity, removeGoal) {
  const goal = element('textarea')
  goal.required = true
  goal.rows = 2
  goal.value = [...new Set([item.goal, item.notes].filter(Boolean))].join('\n\n')
  const unit = element('select', '', ...PRACTICE_LOG_UNITS.map(unit => option(unit.value, unit.label)))
  unit.value = item.measure?.unit || ''
  const target = numberInput(item.measure?.target ?? 1, 1)
  target.required = true
  target.setAttribute('aria-label', 'Target amount')
  const targetLabel = element('div', 'practice-log-field', element('span', '', 'Target amount'), stepper(target, 1))
  const hint = element('p', 'practice-log-summary', 'Track progress with a 0–100% slider.')
  const reset = element('p', 'practice-log-summary', 'Changing the unit resets progress for this goal.')
  function updateFields() {
    targetLabel.hidden = target.disabled = !unit.value
    hint.hidden = !!unit.value
    reset.hidden = !item.measure?.percent || unit.value === item.measure.unit
  }
  unit.addEventListener('change', updateFields)
  updateFields()
  const actions = element('div', 'practice-log-editor-actions')
  if (removeGoal) actions.append(button('Remove goal', 'practice-log-ghost', () => {
    if (removeGoal()) dialog.close()
  }))
  if (item.removable && removeActivity) actions.append(button('Remove activity', 'practice-log-ghost', () => {
    if (removeActivity(item.name)) dialog.close()
  }))
  openEditor(dialog, item.goal || item.notes ? 'Edit goal' : 'Set a goal', editorContext(item, weekLabel),
    [field('Goal', goal), field('Target unit', unit), targetLabel, hint, reset], 'Save goal', () => {
      if (!goal.value.trim()) {
        goal.setCustomValidity('Enter a goal.')
        goal.reportValidity()
        goal.addEventListener('input', () => goal.setCustomValidity(''), { once: true })
        return false
      }
      return saveGoal({ goal: goal.value, unit: unit.value, target: unit.value ? target.valueAsNumber : null })
    }, actions.childElementCount ? actions : null)
}

export function openPracticeLogProgressEditor(dialog, item, saveProgress) {
  const previous = item.measure.progress ?? item.measure.percent ?? 0
  const input = numberInput(previous, 0)
  const controls = []
  const previousText = item.measure.label || item.statusLabel
  if (item.measure.target) {
    const unit = PRACTICE_LOG_UNITS.find(unit => unit.value === item.measure.unit).label.toLowerCase()
    const label = unit.charAt(0).toUpperCase() + unit.slice(1) + ' completed this week'
    input.required = true
    input.setAttribute('aria-label', label)
    controls.push(
      element('div', 'practice-log-field', element('span', '', label),
        element('div', 'practice-log-quantity', stepper(input, 0), `of ${item.measure.target} ${item.measure.unitLabel}`)),
      element('div', 'practice-log-increments', ...[5, 10].map(amount =>
        button(`+${amount}`, 'practice-log-update', () => {
          input.value = String(Math.min(Number.MAX_SAFE_INTEGER, (input.valueAsNumber || 0) + amount))
        }, `Add ${amount} ${unit}`))))
  } else {
    input.type = 'range'
    input.max = '100'
    input.id = 'practiceLogProgressSlider'
    const value = element('output', '', `${previous}%`)
    value.setAttribute('for', input.id)
    const label = element('label', 'practice-log-slider-label', 'Progress this week')
    label.htmlFor = input.id
    const showValue = () => {
      const percent = `${input.value}%`
      value.value = percent
      input.setAttribute('aria-valuetext', percent)
    }
    input.addEventListener('input', showValue)
    showValue()
    controls.push(element('div', 'practice-log-slider-heading', label, value), input,
      element('div', 'practice-log-slider-scale', ...['0%', '50%', '100%'].map(text => element('span', '', text))))
  }
  controls.push(element('p', 'practice-log-summary', `Previously ${previousText}`))
  openEditor(dialog, 'Update progress', editorContext(item), controls, 'Save progress',
    () => saveProgress(input.valueAsNumber), item.status !== 'skipped'
      ? button('Skip this goal', 'practice-log-ghost', () => {
        if (saveProgress(previous, true) !== false) dialog.close()
      }) : null)
}

export function openPracticeLogActivityPicker(dialog, available, usedNames, choose) {
  const activity = element('select', '', ...available.map(name => option(name, name)),
    option('', 'New activity…'))
  const custom = element('input')
  custom.required = true
  custom.placeholder = 'e.g. Pronunciation'
  const customField = field('Activity name', custom)
  const updateFields = () => { customField.hidden = custom.disabled = !!activity.value }
  activity.addEventListener('change', updateFields)
  custom.addEventListener('input', () => custom.setCustomValidity(''))
  updateFields()
  openEditor(dialog, 'Add a goal', null, [field('Activity', activity), customField], 'Continue', () => {
    const name = activity.value || custom.value.trim()
    if (!name || (!activity.value && usedNames.includes(name))) {
      custom.setCustomValidity(name ? 'This activity already exists.' : 'Enter an activity name.')
      custom.reportValidity()
      return false
    }
    return choose(name)
  })
}
