// Translate an array of source strings, preserving order, via an injected
// async translateFn(text) → Promise<string>. Blank / whitespace-only lines are
// passed through untranslated (no call). A small concurrency cap keeps the host
// translation bridge from being flooded when a window has many lines.
//
// Pure orchestration: the actual bridge (window.TranslateRequest /
// window.__cupTranslated) lives in language.js and is injected here as
// translateFn, so this module stays unit-testable without a browser.
export async function translateLines(lines, translateFn, opts = {}) {
  const arr = lines || []
  const concurrency = Math.max(1, opts.concurrency || 4)
  const out = new Array(arr.length)
  let next = 0

  async function worker() {
    while (next < arr.length) {
      const i = next++
      const line = arr[i]
      if (line == null || !String(line).trim()) {
        out[i] = line
        continue
      }
      out[i] = await translateFn(line)
    }
  }

  const workers = []
  for (let w = 0; w < Math.min(concurrency, arr.length); w++) workers.push(worker())
  await Promise.all(workers)
  return out
}
