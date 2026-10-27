// Practice cards must behave like ordinary selectable text on desktop.
// Only real touch input may start swipe navigation or double-tap revealing.
export function isPracticeTouchGesture(event) {
  return event?.pointerType === 'touch'
}

export function isPracticeTouchDoubleTap(event, coarsePointer = false) {
  const pointerType = event?.pointerType || ''
  if (pointerType) return pointerType === 'touch'
  // Some mobile engines dispatch a MouseEvent for synthesized double taps.
  return !!coarsePointer && event?.sourceCapabilities?.firesTouchEvents !== false
}
