// Jest global setup — polyfill APIs missing from the jsdom environment.
if (typeof globalThis.structuredClone === 'undefined') {
  globalThis.structuredClone = (obj) => JSON.parse(JSON.stringify(obj));
}
