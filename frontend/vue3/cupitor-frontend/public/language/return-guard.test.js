import { createReturnGuard } from "./return-guard";

// A player whose state the test sets, a manual clock and a timer queue.
function rig() {
  const env = { state: 2, paused: 0, t: 0, timers: [] };
  const guard = createReturnGuard({
    getState: () => env.state,
    pause: () => { env.paused++; if (!env.sticky) env.state = 2; },
    now: () => env.t,
    setTimer: (fn) => { env.timers.push(fn); return env.timers.length; },
    clearTimer: () => { env.timers = []; },
    windowMs: 3000,
    holdMs: 1000,
    pollMs: 150,
  });
  // Advance the clock and run what is due.
  env.step = (ms) => {
    env.t += ms;
    const due = env.timers;
    env.timers = [];
    due.forEach((fn) => fn());
  };
  return { env, guard };
}

describe("createReturnGuard", () => {
  test("a video paused when the app left is paused again when Android restarts it on return", () => {
    const { env, guard } = rig();
    guard.onHidden();
    guard.onVisible();
    env.state = 1; // the browser resumes it
    env.step(150);
    expect(env.paused).toBe(1);
  });

  test("a video that was paused while away (clip ended in the background) stays paused", () => {
    const { env, guard } = rig();
    env.state = 1;
    guard.onHidden();
    env.state = 2;
    guard.onStateChange(2);
    guard.onVisible();
    env.state = 1;
    env.step(150);
    expect(env.paused).toBe(1);
  });

  test("playback that carried on in the background is left alone", () => {
    const { env, guard } = rig();
    env.state = 1;
    guard.onHidden();
    guard.onVisible();
    env.step(150);
    expect(env.paused).toBe(0);
    expect(guard.armed).toBe(false);
  });

  test("an intended play (cancel) during the window is not fought", () => {
    const { env, guard } = rig();
    guard.onHidden();
    guard.onVisible();
    guard.cancel();
    env.state = 1;
    env.step(150);
    expect(env.paused).toBe(0);
  });

  test("a play after the window is not touched", () => {
    const { env, guard } = rig();
    guard.onHidden();
    guard.onVisible();
    for (let i = 0; i < 25; i++) env.step(150);
    env.state = 1;
    env.step(150);
    expect(env.paused).toBe(0);
    expect(guard.armed).toBe(false);
  });

  test("after holding a caught start for a moment, a tap on the player's own play button is not fought", () => {
    const { env, guard } = rig();
    guard.onHidden();
    guard.onVisible();
    env.state = 1;
    env.step(150); // caught and paused
    for (let i = 0; i < 8; i++) env.step(150); // hold runs out
    expect(guard.armed).toBe(false);
    env.state = 1; // the user presses play inside the player
    env.step(150);
    expect(env.paused).toBe(1);
  });

  test("a pause dropped while buffering is repeated during the hold", () => {
    const { env, guard } = rig();
    guard.onHidden();
    guard.onVisible();
    env.sticky = true;
    env.state = 3;
    env.step(150);
    env.step(150);
    env.step(150);
    expect(env.paused).toBeGreaterThanOrEqual(3);
  });

  test("a visible event without a hidden one first does nothing", () => {
    const { env, guard } = rig();
    guard.onVisible();
    env.state = 1;
    env.step(150);
    expect(env.paused).toBe(0);
  });
});
