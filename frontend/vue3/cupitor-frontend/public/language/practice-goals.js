import { createCallClient } from './study-calls.js'

export function practiceDate(date = new Date()) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map(value => String(value).padStart(2, '0')).join('-')
}

export function mountPracticeGoals({ $, root, data, save, language, target }) {
  const client = createCallClient(window)
  const goals = () => data().goals ?? {}
  const schedule = () => data().reminders ?? { enabled: false, slots: [] }
  const panel = $(root)
  let category = '', completed = false, listing = false
  const button = (text, action, primary = false) => $('<button>', {
    type: 'button', class: primary ? 'btn btn-primary' : 'lang-tool-btn', text,
  }).on('click', action)
  const status = $('<p>', { role: 'status', class: 'practice-goal-status' })

  async function sync() {
    if (!client.available() || !data().reminders) return
    const active = Object.values(goals()).filter(goal => !goal.completed)
    await client.rpc('setPracticeReminders', {
      language, ...schedule(),
      goals: active.map(goal => ({
        id: goal.id,
        title: goal.title,
        last_update: (goal.updates || []).map(update => update.date).sort().at(-1) || '',
      })),
    })
  }

  function persist() {
    save()
    sync().catch(() => status.text('Could not sync reminders to Study Calls. Open Reminders to retry.'))
  }

  function edit(goal, updating = false) {
    listing = false
    const form = $('<form>', { class: 'practice-goal-form' })
    const field = (label, input) => $('<label>').text(label).append(input).appendTo(form)
    const title = $('<input>', { required: true, maxlength: 120 }).val(goal?.title || '')
    const name = $('<input>', { required: true, maxlength: 60, list: 'practiceGoalCategories' }).val(goal?.category || '')
    const amount = $('<input>', { type: 'number', min: updating ? 0 : 0.01, step: 'any' })
    const unit = $('<input>', { maxlength: 30, placeholder: 'e.g. sessions' }).val(goal?.unit || '')
    const deadline = $('<input>', { type: 'date' }).val(goal?.deadline || '')
    const note = $('<textarea>', { rows: 4, maxlength: 4000, required: updating && !goal?.target })
    if (updating) {
      $('<h3>').text(goal.title).appendTo(form)
      if (goal.target) field('Amount practised (' + (goal.unit || 'units') + ')', amount)
      field('Progress note', note)
    } else {
      field('Goal', title)
      field('Category', name)
      const options = $('<datalist>', { id: 'practiceGoalCategories' }).appendTo(form)
      categories().forEach(value => $('<option>').val(value).appendTo(options))
      field('Numeric target (optional)', amount.val(goal?.target || ''))
      field('Unit (optional)', unit)
      field('Deadline (optional)', deadline)
    }
    $('<button>', { type: 'submit', class: 'btn btn-primary', text: updating ? 'Save update' : 'Save goal' }).appendTo(form)
    button('Cancel', render).appendTo(form)
    form.on('submit', event => {
      event.preventDefault()
      const now = Date.now()
      if (goal) goal = goals()[goal.id] || goal
      if (updating) {
        const text = note.val().trim(), value = Number(amount.val()) || 0
        if (!text && !value) { status.text('Enter a progress note or amount.'); return }
        goal.updates.push({ id: crypto.randomUUID(), date: practiceDate(), text, amount: value })
        goal.updatedAt = now
      } else {
        const goalTitle = title.val().trim(), categoryName = name.val().trim()
        if (!goalTitle || !categoryName) { status.text('Enter a goal and category.'); return }
        const id = goal?.id || crypto.randomUUID()
        data().goals ??= {}
        data().goals[id] = {
          ...goal, id, title: goalTitle, category: categoryName, updatedAt: now,
          target: Number(amount.val()) || null, unit: unit.val().trim(), deadline: deadline.val(),
          updates: goal?.updates || [], completed: goal?.completed || false,
        }
        category = ''
      }
      persist()
      render()
    })
    panel.empty().append(form, status)
    form.find(':input').first().trigger('focus')
  }

  function categories() {
    return [...new Set([...data().customItems, ...Object.values(goals()).map(goal => goal.category)])].sort()
  }

  function reminders() {
    listing = false
    const config = schedule()
    const form = $('<form>', { class: 'practice-goal-form' })
    $('<h3>').text('Study Call reminders').appendTo(form)
    if (!client.available()) {
      $('<p>').text('Practice Log reminders are available in the Cupitor Android app.').appendTo(form)
      panel.empty().append(form, button('Back to goals', render))
      return
    }
    const enabled = $('<input>', { type: 'checkbox' }).prop('checked', config.enabled)
    $('<label>', { class: 'practice-reminder-toggle' }).append(enabled, ' Enable reminders').appendTo(form)
    const slots = $('<div>').appendTo(form)
    function row(slot = { time: '18:00', days: [1, 2, 3, 4, 5, 6, 7] }) {
      const item = $('<fieldset>', { class: 'practice-reminder-slot' }).appendTo(slots)
      $('<legend>').text('Reminder time').appendTo(item)
      $('<input>', { type: 'time', required: true, 'aria-label': 'Reminder time' }).val(slot.time).appendTo(item)
      const days = $('<div>', { class: 'practice-reminder-days' }).appendTo(item)
      ;['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((day, i) => {
        $('<label>').append($('<input>', { type: 'checkbox', value: i + 1 })
          .prop('checked', slot.days.includes(i + 1)), day).appendTo(days)
      })
      button('Remove', () => item.remove()).appendTo(item)
    }
    config.slots.forEach(slot => row(slot))
    button('Add a time', () => row()).appendTo(form)
    const submit = $('<button>', { type: 'submit', class: 'btn btn-primary', text: 'Save reminders' }).appendTo(form)
    button('Cancel', render).appendTo(form)
    form.on('submit', async event => {
      event.preventDefault()
      const entries = slots.find('fieldset').map((_, item) => ({
        time: $(item).find('[type=time]').val(),
        days: $(item).find(':checked').map((__, input) => Number(input.value)).get(),
      })).get()
      if ((enabled.prop('checked') && !entries.length) || entries.some(slot => !slot.days.length)) {
        status.text('Add a time and select at least one weekday for each reminder.')
        return
      }
      submit.prop('disabled', true)
      try {
        if (enabled.prop('checked')) {
          const caps = await client.rpc('getCapabilities')
          if (!caps.practice_reminders) throw new Error('Update the Cupitor Android app to enable Practice Log reminders.')
          const permission = await client.rpc('requestPermission')
          if (permission.permission !== 'granted') throw new Error('Allow notifications in Android to receive reminders.')
        }
        const old = data().reminders
        data().reminders = { enabled: enabled.prop('checked'), slots: entries, updatedAt: Date.now() }
        try { await sync() } catch (error) { data().reminders = old; throw error }
        save()
        status.text('Reminders saved.')
        render()
      } catch (error) { status.text('Could not save reminders. ' + error.message) }
      finally { submit.prop('disabled', false) }
    })
    panel.empty().append(form, status.empty())
  }

  function render() {
    listing = true
    panel.empty()
    const header = $('<div>', { class: 'practice-goal-toolbar' }).appendTo(panel)
    button('Reminders', reminders).appendTo(header)
    button('+ New goal', () => edit(null), true).appendTo(header)
    const filters = $('<div>', { class: 'practice-goal-toolbar' }).appendTo(panel)
    button('Active', () => { completed = false; render() }, !completed).attr('aria-pressed', !completed).appendTo(filters)
    button('Completed', () => { completed = true; render() }, completed).attr('aria-pressed', completed).appendTo(filters)
    const select = $('<select>', { 'aria-label': 'Filter by category' }).appendTo(filters)
    $('<option>', { value: '', text: 'All categories' }).appendTo(select)
    categories().forEach(value => $('<option>', { value, text: value }).appendTo(select))
    select.val(category).on('change', () => { category = select.val(); render() })
    const visible = Object.values(goals()).filter(goal => goal.completed === completed && (!category || category === goal.category))
    if (!visible.length) $('<p>').text(completed ? 'No completed goals.' : 'No active goals in this view.').appendTo(panel)
    visible.forEach(goal => {
      const card = $('<article>', { class: 'practice-goal-card' }).appendTo(panel)
      $('<h3>').text(goal.title).appendTo(card)
      $('<span>', { class: 'practice-goal-category' }).text(goal.category).appendTo(card)
      if (goal.deadline) $('<span>').text(' · Due ' + goal.deadline).appendTo(card)
      const progress = goal.updates.reduce((sum, update) => sum + (update.amount || 0), 0)
      if (goal.target) {
        $('<p>').text(progress + ' of ' + goal.target + ' ' + (goal.unit || 'units')).appendTo(card)
        $('<progress>', { value: Math.min(progress, goal.target), max: goal.target, 'aria-label': goal.title + ' progress' }).appendTo(card)
      } else if (goal.updates.length) {
        $('<p>').text(goal.updates.at(-1).text).appendTo(card)
      }
      const actions = $('<div>', { class: 'practice-goal-toolbar' }).appendTo(card)
      if (!goal.completed) button('Update progress', () => edit(goal, true), true).appendTo(actions)
      button('Edit goal', () => edit(goal)).appendTo(actions)
      button(goal.completed ? 'Reopen' : 'Mark complete', () => {
        goal.completed = !goal.completed
        goal.updatedAt = Date.now()
        persist()
        render()
      }).appendTo(actions)
      if (goal.updates.length) {
        const history = $('<details>').appendTo(card)
        $('<summary>').text('Progress history').appendTo(history)
        goal.updates.slice().reverse().forEach(update =>
          $('<p>').text([update.date, update.amount ? '+' + update.amount : '', update.text].filter(Boolean).join(' · ')).appendTo(history))
      }
    })
    panel.append(status)
  }

  render()
  if (target && goals()[target] && !goals()[target].completed) edit(goals()[target], true)
  return { sync, refresh: () => { if (listing) render() }, dispose: () => client.dispose() }
}
