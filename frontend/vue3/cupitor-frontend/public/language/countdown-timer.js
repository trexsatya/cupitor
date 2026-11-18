const storageKey = 'cupitor.countdown-timer'
const defaultDuration = 15 * 60 * 1000
const maximumDuration = (999 * 60 + 59) * 1000
const get = id => document.getElementById('cupTimer' + id)
const dialog = get('Dialog')
const toggle = get('Toggle')
const minutes = get('Minutes')
const seconds = get('Seconds')
const readout = get('Readout')
const status = get('Status')
const action = get('Action')
const reset = get('Reset')
const alert = get('Alert')
const error = get('Error')
const presets = [...get('Presets').querySelectorAll('button')]
const menuStatus = get('MenuStatus')

let timer = { phase: 'ready', duration: defaultDuration }
let tick
try {
  const saved = JSON.parse(sessionStorage.getItem(storageKey))
  if (saved && Number.isInteger(saved.duration) && saved.duration > 0 &&
      saved.duration <= maximumDuration &&
      (saved.phase === 'ready' || saved.phase === 'finished' ||
       (saved.phase === 'running' && Number.isFinite(saved.deadline)) ||
       (saved.phase === 'paused' && saved.remaining > 0 && saved.remaining <= saved.duration))) {
    timer = saved
  }
} catch {}

function setTimer(next) {
  timer = next
  try { sessionStorage.setItem(storageKey, JSON.stringify(timer)) } catch {}
}

const formatPart = value => String(value).padStart(2, '0')
function showDuration() {
  const total = Math.floor(timer.duration / 1000)
  minutes.value = Math.floor(total / 60)
  seconds.value = formatPart(total % 60)
  updatePresets()
}

function updatePresets() {
  for (const preset of presets) {
    preset.setAttribute('aria-pressed', Number(preset.dataset.timerMinutes) === minutes.valueAsNumber &&
      seconds.valueAsNumber === 0)
  }
}

function render() {
  clearTimeout(tick)
  const remaining = timer.phase === 'running' ? Math.max(0, timer.deadline - Date.now()) :
    timer.phase === 'paused' ? timer.remaining : 0
  if (timer.phase === 'running' && !remaining) {
    setTimer({ phase: 'finished', duration: timer.duration })
    if (!dialog.open) {
      alert.hidden = false
      get('AlertText').textContent = 'Time’s up'
    }
  }
  const ready = timer.phase === 'ready'
  const running = timer.phase === 'running'
  const total = Math.ceil(remaining / 1000)
  const time = formatPart(Math.floor(total / 60)) + ':' + formatPart(total % 60)
  const label = { ready: '', running: 'Running', paused: 'Paused', finished: 'Time’s up' }[timer.phase]
  get('Fields').hidden = get('Presets').hidden = !ready
  readout.hidden = reset.hidden = ready
  readout.textContent = time
  if (status.textContent !== label) status.textContent = label
  action.textContent = { ready: 'Start', running: 'Pause', paused: 'Resume', finished: 'Start again' }[timer.phase]
  const summary = running ? time : timer.phase === 'paused' ? time + ' · Paused' : label
  menuStatus.textContent = summary
  toggle.title = summary ? 'Timer · ' + summary : 'Timer'
  toggle.toggleAttribute('data-timer-active', !ready)
  if (running) tick = setTimeout(render, (remaining - 1) % 1000 + 1)
}

get('Form').addEventListener('submit', event => {
  event.preventDefault()
  const { phase, deadline, duration, remaining } = timer
  if (phase === 'running') {
    const left = deadline - Date.now()
    if (left > 0) setTimer({ phase: 'paused', duration, remaining: left })
  } else if (phase === 'paused') {
    setTimer({ phase: 'running', duration, deadline: Date.now() + remaining })
  } else {
    const customDuration = (Number(minutes.value) * 60 + Number(seconds.value)) * 1000
    if (phase === 'ready' && (minutes.validity.badInput || seconds.validity.badInput ||
        !minutes.validity.valid || !seconds.validity.valid || customDuration <= 0)) {
      error.textContent = 'Enter a duration with 0–999 minutes and 0–59 seconds, at least one second total.'
      return
    }
    const length = phase === 'ready' ? customDuration : duration
    setTimer({ phase: 'running', duration: length, deadline: Date.now() + length })
  }
  render()
})

for (const field of [minutes, seconds]) {
  field.addEventListener('input', () => {
    error.textContent = ''
    updatePresets()
  })
}
for (const preset of presets) {
  preset.addEventListener('click', () => {
    minutes.value = preset.dataset.timerMinutes
    seconds.value = '00'
    error.textContent = ''
    updatePresets()
  })
}
reset.addEventListener('click', () => {
  setTimer({ phase: 'ready', duration: timer.duration })
  showDuration()
  render()
  action.focus()
})
toggle.addEventListener('click', () => {
  if (!dialog.open) dialog.showModal()
  alert.hidden = true
  render()
})
get('Close').addEventListener('click', () => dialog.close())
get('Dismiss').addEventListener('click', () => { alert.hidden = true })
document.addEventListener('visibilitychange', render)
window.addEventListener('pageshow', render)
showDuration()
render()
