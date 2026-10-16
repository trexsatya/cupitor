import { parsePracticeSpeeds, practiceSpeeds, nextPracticeSpeed, supportedPracticeSpeed } from './practice-speed.js'
test('preserves the order of custom cycles and accepts decimals', () => {
  expect(parsePracticeSpeeds('1,0.75,0.5')).toEqual([1, 0.75, 0.5])
  expect(parsePracticeSpeeds('0.7,0.5')).toEqual([0.7, 0.5])
  expect(parsePracticeSpeeds('0.7; 0.5 1')).toEqual([0.7, 0.5, 1])
  expect(parsePracticeSpeeds([1, 0.75, 1])).toEqual([1, 0.75])
})
test('clicking cycles exactly the chosen list and wraps around', () => {
  const options = [1, 0.75, 0.5]
  expect(nextPracticeSpeed(1, options)).toBe(0.75)
  expect(nextPracticeSpeed(0.75, options)).toBe(0.5)
  expect(nextPracticeSpeed(0.5, options)).toBe(1)
  expect(nextPracticeSpeed(1, [0.7, 0.5])).toBe(0.7)
  expect(nextPracticeSpeed(0.7, [0.7, 0.5])).toBe(0.5)
  expect(nextPracticeSpeed(0.5, [0.7, 0.5])).toBe(0.7)
})
test('invalid or empty cycles are rejected, stored invalid settings have defaults', () => {
  for (const input of ['', '0', '-1', 'NaN', '1,no', '0.01', '5', [], null]) expect(parsePracticeSpeeds(input)).toBeNull()
  expect(practiceSpeeds(null)).toEqual([1, 0.75, 0.5])
})
test('YouTube gets the closest available rate without changing the chosen cycle', () => {
  const options = [0.7, 0.5]
  expect(supportedPracticeSpeed(0.7, [0.25, 0.5, 0.75, 1])).toBe(0.75)
  expect(supportedPracticeSpeed(0.7, [])).toBe(0.7)
  expect(nextPracticeSpeed(0.7, options)).toBe(0.5)
  expect(options).toEqual([0.7, 0.5])
})
