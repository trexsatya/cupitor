// Tiny CLI arg parser + flag coercion for lang-manage. Pure and unit-tested so
// the orchestrator stays focused on I/O.

// argv (without node/script) -> { command, flags }. Supports `--k v`, `--k=v`,
// and boolean `--k`.
export function parseArgs(argv) {
  const args = argv || [];
  const command = args[0] && !args[0].startsWith("--") ? args[0] : "";
  const flags = {};
  for (let i = command ? 1 : 0; i < args.length; i++) {
    const a = args[i];
    if (!a.startsWith("--")) continue;
    const body = a.slice(2);
    const eq = body.indexOf("=");
    if (eq >= 0) {
      flags[body.slice(0, eq)] = body.slice(eq + 1);
    } else if (i + 1 < args.length && !args[i + 1].startsWith("--")) {
      flags[body] = args[++i];
    } else {
      flags[body] = true;
    }
  }
  return { command, flags };
}

// Does a rare-word entry's category match the `--category` filter? Filter is a
// case-insensitive substring (category names themselves contain commas, so we
// can't split on comma). Empty/undefined filter matches everything.
export function matchCategory(entryCategory, filter) {
  if (!filter) return true;
  return String(entryCategory || "")
    .toLowerCase()
    .includes(String(filter).toLowerCase());
}

// Update (not replace) a rare-words list for a category-scoped `rare` run: drop
// the existing entries whose category matches `filter`, then append the freshly
// scanned ones. Other categories are left untouched, so scanning one category
// doesn't wipe the rest of rare-words.json.
export function mergeRareByCategory(existing, fresh, filter) {
  const kept = (existing || []).filter((e) => !matchCategory(e.category, filter));
  return [...kept, ...(fresh || [])];
}

const NUMERIC = {
  threshold: "rareThreshold",
  max: "maxItemsPerWord",
  before: "linesBefore",
  after: "linesAfter",
  chunk: "chunk",
  maxPages: "maxSearchPages",
  minSpan: "pruneMinSpanSec",
  window: "pruneWindowLines",
};

// Map raw CLI flags to config overrides with the right types. Unknown flags are
// dropped; boolean flags (e.g. --reset) pass through unchanged.
export function coerceFlags(flags) {
  const out = {};
  for (const [k, v] of Object.entries(flags || {})) {
    if (NUMERIC[k] != null) {
      const n = parseInt(v, 10);
      if (!Number.isNaN(n)) out[NUMERIC[k]] = n;
    } else if (k === "words") {
      out.words = String(v)
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    } else if (k === "reset" || typeof v === "boolean") {
      out[k] = v;
    } else if (
      ["lang", "targetLang", "dataDir", "srtsDir", "outDir", "config", "srtConflict", "category"].includes(k)
    ) {
      out[k] = v;
    }
  }
  return out;
}
