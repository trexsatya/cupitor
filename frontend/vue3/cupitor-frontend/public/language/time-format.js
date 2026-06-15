// Loose HH:MM:SS[,mmm] / HH:MM:SS[.mmm] parsing & formatting. Accepts
// "MM:SS", "HH:MM:SS", and either '.' or ',' as the millisecond separator
// — SRT files in the wild use both. Returns seconds (with sub-second
// precision when present).
//
// Returns 0 for malformed input rather than NaN — preserves the previous
// behaviour where downstream code assumed a number it could compare.
export function toSeconds(str) {
  str = str + ''
  let hour = 0, mins = 0, secs = 0, millis = 0
  if (str.split(/[,.]/).length === 2) {
    const splits = str.split(/[,.]/)
    str = splits[0]
    millis = splits[1]
  }
  const splits = str.split(':')
  if (splits.length === 2) {
    mins = splits[0]
    secs = splits[1]
  }
  if (splits.length === 3) {
    hour = splits[0]
    mins = splits[1]
    secs = splits[2]
  }
  return parseInt(hour) * 3600 + parseInt(mins) * 60 + parseInt(secs) + parseInt(millis) / 1000
}

// Format a numeric seconds value back into "HH:MM:SS" (millisecond-free).
// Used by labels/badges where sub-second precision would be visual clutter;
// for SRT entries themselves, srt-parser.js's srtTimeFromValue keeps ms.
export function fromSeconds(number) {
  const _pad = x => x.length < 2 ? '0' + x : x
  const hrs = Math.floor(number / 3600) + ''
  const mins = Math.floor((number % 3600) / 60) + ''
  const secs = Math.floor((number % 3600) % 60) + ''
  return `${_pad(hrs)}:${_pad(mins)}:${_pad(secs)}`
}
