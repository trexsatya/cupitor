// Swedish→target translation via the unofficial translate.googleapis.com endpoint
// (the same one the Cupitor Flutter app uses). No API key. Rate-limits, so callers
// throttle + retry and chunk their work. The provider is hidden behind
// translateText/translateBatch so a paid backend can drop in later.

const ENDPOINT = "https://translate.googleapis.com/translate_a/single";

export function buildTranslateUrl(text, from, to) {
  const params = new URLSearchParams({
    client: "gtx",
    sl: from,
    tl: to,
    dt: "t",
    q: text,
  });
  return `${ENDPOINT}?${params.toString()}`;
}

// The endpoint returns [ [ [translatedChunk, sourceChunk, ...], ... ], ... ].
// Concatenate the first element of each segment.
export function parseTranslateResponse(json) {
  if (!Array.isArray(json) || !Array.isArray(json[0])) return "";
  return json[0]
    .map((seg) => (Array.isArray(seg) ? seg[0] || "" : ""))
    .join("");
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Translate a single string. Injectable fetch + sleep keep it testable and let the
// CLI pass a throttled fetch. Retries with linear backoff on failure.
export async function translateText(text, from, to, opts = {}) {
  const { fetchFn = fetch, tries = 3, backoffMs = 1000 } = opts;
  const q = String(text || "");
  if (!q.trim()) return "";
  let lastErr;
  for (let attempt = 0; attempt < tries; attempt++) {
    try {
      const res = await fetchFn(buildTranslateUrl(q, from, to), {
        headers: { "User-Agent": "Mozilla/5.0" },
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return parseTranslateResponse(json);
    } catch (e) {
      lastErr = e;
      if (attempt < tries - 1) await sleep(backoffMs * (attempt + 1));
    }
  }
  throw lastErr;
}

// Translate an array of strings sequentially, throttled by delayMs between calls.
export async function translateBatch(texts, from, to, opts = {}) {
  const { delayMs = 800, onProgress } = opts;
  const out = [];
  for (let i = 0; i < texts.length; i++) {
    out.push(await translateText(texts[i], from, to, opts));
    if (onProgress) onProgress(i + 1, texts.length);
    if (delayMs && i < texts.length - 1) await sleep(delayMs);
  }
  return out;
}
