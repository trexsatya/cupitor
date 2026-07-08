// Config for the "Manage" CLI: documented defaults, a JSON config file, and CLI
// flag overrides (later layers win).
import { readFileSync } from "node:fs";

export const DEFAULTS = {
  lang: "sv",
  targetLang: "en",
  dataDir: "",
  srtsDir: "",
  outDir: "./out",
  rareThreshold: 2,
  maxItemsPerWord: 5,
  linesBefore: 3,
  linesAfter: 3,
  excludeChannels: [], // HARD block: matching videos are dropped entirely
  // SOFT de-prioritize: matching videos are captured only when non-blacklisted
  // candidates aren't enough (see maxSearchPages). Same channel-name matching as
  // excludeChannels; excludeChannels wins if a channel is in both.
  blacklistChannels: [],
  preferManualCaptions: true,
  // How to fetch filmot. "browser" (recommended) drives a real Chromium via
  // Playwright with a persistent, logged-in session — the only reliable way past
  // filmot's hCaptcha/fingerprint wall. "http" uses a pasted cookie (often still
  // blocked). Browser mode needs: npm i playwright && npx playwright install chromium
  filmotMode: "http",
  browserHeadless: false, // headed so you can log in / solve the captcha once
  browserUserDataDir: "./out/filmot-browser",
  // http mode only: paste your logged-in filmot Cookie header (or FILMOT_COOKIE env)
  // and the matching browser User-Agent.
  filmotCookie: "",
  userAgent: "",
  // Max filmot result pages fetched per alternative term. Only pages beyond 1
  // when blacklistChannels is set and page 1 lacks enough non-blacklisted
  // candidates; no-blacklist runs always fetch page 1 only.
  maxSearchPages: 3,
  filmotDelayMs: 1500,
  translateDelayMs: 800,
  chunkFilmot: 10,
  chunkSrt: 20,
  srtConflict: "keep",
  defaultDurSec: 3,
  // `prune`: an srt counts as a full-video transcript (removal candidate) if it
  // spans more than this many seconds; captured snippets span only seconds.
  pruneMinSpanSec: 60,
  // `prune`: lines of context kept on each side of a preserved dictionary item
  // when shrinking a transcript to windows.
  pruneWindowLines: 4,
};

export function mergeConfig(...layers) {
  return Object.assign({}, ...layers.filter(Boolean));
}

export function loadConfig(path, flags = {}) {
  let file = {};
  if (path) {
    try {
      file = JSON.parse(readFileSync(path, "utf8"));
    } catch (e) {
      /* no/invalid config file — fall back to defaults + flags */
    }
  }
  return mergeConfig(DEFAULTS, file, flags);
}
