// Vocabulary expansion, shared by the browser app (language.js) and the Node
// "Manage" CLI. Pure — no DOM, no window. `<*ref` expansion pulls forms from an
// expansion map passed in by the caller (the browser derives it from the
// `expansions` vocab category; the CLI does the same via buildExpansionMap).
//
//   `<*gå an (something)|göra` becomes `göra|gå an|går an|gick an|gått an`
//   Extra info in (brackets) is removed; alternatives are joined with `|`.
import { SEPARATOR_PIPE } from "./vocab-search.js";
import { getSearchedTerms } from "./search-text.js";

// Strip parenthetical hints from a vocab/search line. A few hint tokens map to
// regex fragments ((ngn)/(ngt) → wildcards) rather than being deleted outright.
export function removeHintsInBrackets(txt) {
  const original = txt;
  txt = txt
    .replaceAll("(sl-pl)", "")
    .replaceAll("(pl)", "")
    .replaceAll(" (ngt) ", " .*")
    .replaceAll(" (ngn) ", " .*")
    .replaceAll(" (ngn)", " [^ ]*")
    .replaceAll(" (ngt)", " [^ ]*");

  const fn = () => {
    if (txt.indexOf("(") < 0) return;
    if (txt.indexOf("(") >= 0 && txt.indexOf(")") < 0) {
      // Unbalanced — warn (browser: alert) and drop the stray '('.
      if (typeof alert === "function") alert("Invalid brackets in" + original);
      txt = txt.replaceAll("(", "");
      return;
    }
    // Match the innermost balanced pair (no nested parens inside) and strip it
    // by position, so nested pairs like "(was i so (vajaså))" don't over-consume.
    const m = txt.match(/\([^()]*\)/);
    if (m) {
      txt = txt.slice(0, m.index) + txt.slice(m.index + m[0].length);
    } else {
      // Structurally broken (e.g. ")foo(") — bail to avoid an infinite loop.
      txt = txt.replace(/[()]/g, "");
    }
  };

  while (txt.indexOf("(") >= 0) {
    fn();
  }

  return txt;
}

// Build the `{ key: [values] }` expansion map from a parsed vocabulary object
// (as produced by parseVocabularyFile). Reads the `expansions` / `Expansions` /
// `_expansions` category; each usable line is `key=val1,val2,...`.
export function buildExpansionMap(vocabulary, baseMap = {}) {
  const wordsMap = { ...baseMap };
  const userLines =
    (vocabulary &&
      (vocabulary["expansions"] ||
        vocabulary["Expansions"] ||
        vocabulary["_expansions"])) ||
    [];
  userLines.forEach((line) => {
    if (typeof line !== "string") return;
    const t = line.trim();
    if (!t || t.indexOf("=") < 1) return;
    const eq = t.indexOf("=");
    const key = t.substring(0, eq).trim();
    const valStr = t.substring(eq + 1).trim();
    if (!key || !valStr) return;
    const vals = valStr
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);
    if (vals.length) wordsMap[key] = vals;
  });
  return wordsMap;
}

function uniq(arr) {
  return [...new Set(arr)];
}

function _expandWords(txt, lang, expansionMap, conjugateSpanish) {
  if (txt.indexOf("<*") < 0) {
    return removeHintsInBrackets(txt);
  }

  const expansions = expansionMap || {};
  const terms = txt.split(SEPARATOR_PIPE);
  const fn = () => {
    const w = terms.shift();
    if (!w) return;
    // Trailing whitespace is optional so a synthetic trailing space isn't baked
    // into the expanded term (that broke matches against punctuation).
    const match = w.match(/<\*(?:\{([^)]+)})?([^\s>]*)(?:\s.*)?$/);
    if (match && match.length === 3) {
      const ref = match[1];
      const wordToExpand = match[2];
      let expandedWords = [];
      if (lang === "es" && typeof conjugateSpanish === "function") {
        expandedWords = conjugateSpanish(wordToExpand, ref).flat();
      } else {
        expandedWords = expansions[wordToExpand] || [wordToExpand];
      }
      expandedWords.forEach((it) =>
        terms.push(
          w.replace(`<*${ref ? "{" + ref + "}" : ""}` + wordToExpand, it)
        )
      );
    } else if (w.indexOf("<*") < 0) {
      terms.push(w);
    }
  };

  while (terms.some((t) => t.indexOf("<*") >= 0)) {
    fn();
  }

  return uniq(terms)
    .filter((it) => it.trim().length > 1)
    .map((it) => {
      if (it.length < 3) return ` ${it} `;
      return it;
    })
    .join(SEPARATOR_PIPE);
}

// Expand a vocabulary/search line: split into terms, expand `<*` references from
// `expansionMap`, and strip bracket hints. `conjugateSpanish` (optional) supplies
// Spanish conjugations when lang === 'es'.
export function expandWords(txt, lang = "sv", expansionMap = {}, conjugateSpanish = null) {
  // Mirror language.js: getSearchedTerms is called with removeHintsInBrackets as
  // the bracket-stripper (it lowercases + splits on '|' too).
  const terms = getSearchedTerms(txt, removeHintsInBrackets);
  const final = [];
  terms.forEach((term) => {
    if (lang === "es" && ["lo", "le", "la"].some((it) => term.trim().endsWith(it))) {
      final.push(term.substring(0, term.length - 2));
    }
    final.push(term);
  });
  txt = final.join(SEPARATOR_PIPE);

  const t = _expandWords(txt, lang, expansionMap, conjugateSpanish);
  if (!t || t.trim() === "") {
    // Fallback
    return txt.replaceAll("<*", "");
  }
  return t;
}
