export const DEFAULT_STUDY_TIMEOUT_MINUTES = 30

export function studyTimeoutMinutes(value) {
  const minutes = value == null || value === '' ? NaN : Number(value)
  return Number.isInteger(minutes) && minutes >= 0 && minutes <= 1440
    ? minutes : DEFAULT_STUDY_TIMEOUT_MINUTES
}

export function createStudySessionTimeout(onExpire) {
  let deadline = null
  let timer = null
  let expired = false

  function cancel() {
    clearTimeout(timer)
    timer = null
    deadline = null
    expired = false
  }

  function check() {
    if (deadline == null) return
    clearTimeout(timer)
    const remaining = deadline - Date.now()
    if (remaining > 0) {
      timer = setTimeout(check, remaining)
      return
    }
    // Practice can be finishing a recording at the deadline. Wait for the
    // recorder to settle before pausing the underlying clip.
    if (onExpire() === false) {
      timer = setTimeout(check, 1000)
    } else {
      cancel()
      expired = true
    }
  }

  function start(value) {
    cancel()
    const minutes = studyTimeoutMinutes(value)
    if (!minutes) return
    deadline = Date.now() + minutes * 60000
    check()
  }

  return {
    start,
    cancel,
    check,
    get expired() { return expired },
    ensure(value) {
      if (deadline == null) start(value)
    },
  }
}
