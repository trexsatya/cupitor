export const DEFAULT_PRACTICE_SPEEDS = [1, 0.75, 0.5]

// The order is the order in which the speed button cycles. Decimal points
// distinguish each rate; commas, semicolons or spaces separate the rates.
export function parsePracticeSpeeds(value) {
  const raw = Array.isArray(value) ? value : String(value || '').trim().split(/[\s,;]+/)
  const speeds = raw.map(v => Number(v))
  if (!speeds.length || speeds.some(v => !Number.isFinite(v) || v < 0.1 || v > 4)) return null
  return [...new Set(speeds)]
}
export function practiceSpeeds(value) {
  return parsePracticeSpeeds(value) || [...DEFAULT_PRACTICE_SPEEDS]
}
export function nextPracticeSpeed(current, speeds) {
  const options = practiceSpeeds(speeds)
  return options[(options.indexOf(Number(current)) + 1) % options.length]
}
export function supportedPracticeSpeed(requested, available) {
  const options = Array.isArray(available) ? available.filter(v => Number.isFinite(v) && v > 0) : []
  if (!options.length) return requested
  return options.reduce((best, rate) => Math.abs(rate - requested) < Math.abs(best - requested) ? rate : best)
}
