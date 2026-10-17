import { createAppLifecycleClock } from './app-lifecycle'

function setup(bridge) {
  let time = 0
  const handlers = new Set()
  const target = {
    addEventListener: jest.fn((name, handler) => handlers.add(handler)),
    removeEventListener: jest.fn((name, handler) => handlers.delete(handler)),
  }
  const emit = detail => handlers.forEach(handler => handler({ detail }))
  if (bridge) target.AppLifecycleBridge = { postMessage: message => bridge(message, emit) }
  const clock = createAppLifecycleClock(target, { now: () => time })
  return { clock, emit, target, advance: ms => { time += ms } }
}

test('requests the current state after registering, including a synchronous background response', () => {
  const bridge = jest.fn((message, emit) => { emit({ isForeground: false }) })
  const { clock, advance } = setup(bridge)
  expect(bridge).toHaveBeenCalledWith('getState', expect.any(Function))
  expect(clock.isForeground()).toBe(false)
  advance(60000)
  expect(clock.now()).toBe(0)
})

test('excludes suspended background time without needing any timer ticks', () => {
  const { clock, advance, emit } = setup()
  advance(5000)
  emit({ isForeground: false })
  advance(120000)
  emit({ isForeground: true })
  expect(clock.now()).toBe(5000)
  advance(15000)
  expect(clock.now()).toBe(20000)
})

test('repeated lifecycle events and cycles preserve foreground elapsed time', () => {
  const { clock, advance, emit } = setup()
  advance(1000)
  emit({ isForeground: false })
  advance(30000)
  emit({ isForeground: false })
  advance(30000)
  expect(clock.now()).toBe(1000)
  emit({ isForeground: true })
  advance(500)
  emit({ isForeground: true })
  emit({ isForeground: false })
  advance(60000)
  emit({ isForeground: true })
  expect(clock.now()).toBe(1500)
})

test('browsers without the bridge advance normally and malformed events are ignored', () => {
  const { clock, advance, emit, target } = setup()
  emit(undefined)
  emit({})
  emit({ isForeground: 'false' })
  advance(20000)
  expect(clock.isForeground()).toBe(true)
  expect(clock.now()).toBe(20000)
  clock.dispose()
  expect(target.removeEventListener).toHaveBeenCalledWith('cupitorAppLifecycle', expect.any(Function))
})

test('a bridge error cannot prevent Player initialization', () => {
  const { clock, advance } = setup(() => { throw new Error('old host') })
  advance(1000)
  expect(clock.now()).toBe(1000)
})
