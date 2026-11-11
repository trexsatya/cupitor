import { createCallClient } from './study-calls.js'

export function practiceDate(date = new Date()) {
  return [date.getFullYear(), date.getMonth() + 1, date.getDate()]
    .map(value => String(value).padStart(2, '0')).join('-')
}

export function mountPracticeReminders({ $, root, data, save, language, close }) {
  const client = createCallClient(window)
  const schedule = () => data().reminders ?? { enabled: false, slots: [] }
  const panel = $(root)
  const button = (text, action, primary = false) => $('<button>', {
    type: 'button', class: primary ? 'btn btn-primary' : 'lang-tool-btn', text,
  }).on('click', action)
  const status = $('<p>', { role: 'status', class: 'practice-goal-status' })

  async function sync() {
    if (!client.available() || !data().reminders) return
    await client.rpc('setPracticeReminders', {
      language, ...schedule(),
      goals: [{
        id: '00000000-0000-0000-0000-000000000000',
        title: 'your weekly practice log',
        last_update: data().lastWeeklyUpdate || '',
      }],
    })
  }

  function reminders() {
    const config = schedule()
    const form = $('<form>', { class: 'practice-goal-form' })
    $('<h3>').text('Study Call reminders').appendTo(form)
    if (!client.available()) {
      $('<p>').text('Practice Log reminders are available in the Cupitor Android app.').appendTo(form)
      panel.empty().append(form, button('Back to weekly log', close))
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
    button('Cancel', close).appendTo(form)
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
        close()
      } catch (error) { status.text('Could not save reminders. ' + error.message) }
      finally { submit.prop('disabled', false) }
    })
    panel.empty().append(form, status.empty())
  }

  return { open: reminders, sync, dispose: () => client.dispose() }
}
