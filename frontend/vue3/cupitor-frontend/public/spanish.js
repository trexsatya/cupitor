/* eslint-disable @typescript-eslint/no-use-before-define */
const replaceLastChar = (str, x, y) => {
  const idx = str.lastIndexOf(x);
  if (idx === -1) return str;
  return str.slice(0, idx) + y + str.slice(idx + x.length);
};

const lastOToUe = (calculated, inf) => {
  const {stem, ending} = splitInfinitive(inf);
  return calculated.replace(stem, replaceLastChar(stem, 'o', 'ue'));
}
const lastEToIe = (calculated, inf) => {
  const {stem, ending} = splitInfinitive(inf);
  return calculated.replace(stem, replaceLastChar(stem, 'e', 'ie'));
}
const lastEToI = (calculated, inf) => {
  const {stem, ending} = splitInfinitive(inf);
  return calculated.replace(stem, replaceLastChar(stem, 'e', 'i'));
}
const lastZToC = (calculated, inf) => {
  const {stem, ending} = splitInfinitive(inf);
  return calculated.replace(stem, replaceLastChar(stem, 'z', 'c'));
}
const lastCToZ = (calculated, inf) => {
  const {stem, ending} = splitInfinitive(inf);
  return calculated.replace(stem, replaceLastChar(stem, 'c', 'z'));
}
const lastCToQu = (calculated, inf) => {
  const {stem, ending} = splitInfinitive(inf);
  return calculated.replace(stem, replaceLastChar(stem, 'z', 'c'));
}
const accentLastI = (calculated, inf) => {
  const {stem, ending} = splitInfinitive(inf);
  return calculated.replace(stem, replaceLastChar(stem, 'i', 'í'));
}
const accentLastU = (calculated, inf) => {
  const {stem, ending} = splitInfinitive(inf);
  return calculated.replace(stem, replaceLastChar(stem, 'u', 'ú'));
}
const appendY = (calculated, inf) => {
  const {stem, ending} = splitInfinitive(inf);
  return calculated.replace(stem, stem + 'y');
}
const appendU = (calculated, inf) => {
  const {stem, ending} = splitInfinitive(inf);
  return calculated.replace(stem, stem + 'u');
}

const none = x => x;
// @formatter:off
const irregularityMap = {
  present: {
    'pedir': {changes:   [lastEToI,   lastEToI,   lastEToI,   none, none, lastEToI]},
    'pensar': {changes:   [lastEToIe,   lastEToIe,   lastEToIe,   none, none, lastEToIe]},
    'sentir': {changes:   [lastEToIe,   lastEToIe,   lastEToIe,   none, none, lastEToIe]},
    'contar': {changes:   [lastOToUe,   lastOToUe,   lastOToUe,   none, none, lastOToUe]},
    'entender': {changes: [lastEToIe,   lastEToIe,   lastEToIe,   none, none, lastEToIe]},
    'enviar': {changes:   [accentLastI, accentLastI, accentLastI, none, none, accentLastI]},
    'construir': {changes:   [appendY,  appendY,     appendY,     none, none, appendY]},
    'oír': 'oigo\toyes\toís\toye\toímos\toís\toyen',
    'actuar': {changes: [accentLastU, accentLastU, accentLastU, none, none, accentLastU]},
    'proseguir': 'prosigo\tprosigues\tproseguís\tprosigue\tproseguimos\tproseguís\tprosiguen',
    'volver': 'vuelvo\tvuelves\tvolvés\tvuelve\tvolvemos\tvolvéis\tvuelven',
    'vencer': {changes: [lastCToZ, none, none, none, none, none]},
  },
  preterite: {
    'pedir': {changes:   [none,   none,   lastEToI, none, none, lastEToI]},
    'realizar': {changes: [lastZToC, none, none, none, none, none]},
    'complicar': {changes: [lastCToQu, none, none, none, none, none]},
    'llegar': {changes: [appendU, none, none, none, none, none]},
  },
  imperfect: {
  },
  future: { },
  conditional: { },
  subjunctivePresent: {
    'pedir': {changes:   [lastEToI,   lastEToI,   lastEToI,   lastEToI, lastEToI, lastEToI]},
    'pensar': {changes:   [lastEToIe,   lastEToIe,   lastEToIe,   none, none, lastEToIe]},
    'sentir': {changes:   [lastEToIe,   lastEToIe,   lastEToIe,   lastEToI, lastEToI, lastEToIe]},
    'contar': {changes:   [lastOToUe,   lastOToUe,   lastOToUe,   none,     none,     lastOToUe]},
    'entender': {changes: [lastEToIe,   lastEToIe,   lastEToIe,   none,     none,     lastEToIe]},
    'realizar': {changes: [lastZToC,    lastZToC,    lastZToC,    lastZToC, lastZToC, lastZToC]},
    'enviar': {changes:   [accentLastI, accentLastI, accentLastI, none,     none,     accentLastI]},
    'construir': {changes:   [appendY,  appendY,     appendY,     appendY,  appendY,  appendY]},
    'oír': 'oiga\toigas\toigas\toiga\toigamos\toigáis\toigan',
    'complicar': {changes: [lastCToQu, lastCToQu, lastCToQu, lastCToQu, lastCToQu, lastCToQu]},
    'actuar': {changes: [accentLastU, accentLastU, accentLastU, none, none, accentLastU]},
    'proseguir': 'prosiga\tprosigas\tprosigas, prosigás\tprosiga\tprosigamos\tprosigáis\tprosigan',
    'volver': 'vuelva\tvuelvas\tvuelvas\tvuelva\tvolvamos\tvolváis\tvuelvan',
    'llegar': {changes:   [appendU,  appendU,     appendU,     appendU,  appendU,  appendU]},
    'vencer': {changes: [lastCToZ,    lastCToZ,    lastCToZ,    lastCToZ, lastCToZ, lastCToZ]},
  },
  subjunctiveImperfect: {
    'pedir': {changes:   [lastEToI,   lastEToI,   lastEToI,   lastEToI, lastEToI, lastEToI]},
    'sentir': {changes: [lastEToI, lastEToI, lastEToI, lastEToI, lastEToI, lastEToI]},
    'construir': {changes:   [appendY,  appendY,     appendY,     appendY,  appendY,  appendY]},
    'oír': 'oyera\toyeras\toyeras\toyera\toyéramos\toyerais\toyeran',
    'proseguir': 'prosiguiera\tprosiguieras\tprosiguieras\tprosiguiera\tprosiguiéramos\tprosiguierais\tprosiguieran'
  },
  subjunctiveFuture: {
    'pedir': {changes:   [lastEToI,   lastEToI,   lastEToI,   lastEToI, lastEToI, lastEToI]},
    'sentir': {changes: [lastEToI, lastEToI, lastEToI, lastEToI, lastEToI, lastEToI]},
    'construir': {changes:   [appendY,  appendY,     appendY,     appendY,  appendY,  appendY]},
    'oír': 'oyere\toyeres\toyeres\toyere\toyéremos\toyereis\toyeren',
    'proseguir': 'prosiguiere\tprosiguieres\tprosiguieres\tprosiguiere\tprosiguiéremos\tprosiguiereis\tprosiguieren'
  },
  gerund: {
    'pedir': {changes: [lastEToI]},
    'sentir': {changes: [lastEToI]},
    'oír':  'oyendo',
    'proseguir': 'prosiguiendo',
  },
  pastParticiple: {
    'escribir': 'escrito',
    'oír': 'oído',
    'volver': 'vuelto'
  },
  imperativeAffirmative: {
    'pedir': {changes:    [lastEToI,   lastEToI,   lastEToI,    none, lastEToI]},
    'pensar': {changes:   [lastEToIe,   lastEToIe,   none,      none, lastEToIe]},
    'sentir': {changes:   [lastEToIe,   lastEToIe,   lastEToI,  none, lastEToIe]},
    'entender': {changes: [lastEToIe,   lastEToIe,   none,      none, lastEToIe]},
    'realizar': {changes: [none,        lastZToC,    lastZToC,  none, lastZToC]},
    'vencer': {changes:   [none,        lastCToZ,    lastCToZ,  none, lastCToZ]},
    'enviar': {changes:   [accentLastI, accentLastI, none,      none, accentLastI]},
    'contar': {changes:   [lastOToUe,   lastOToUe,   lastOToUe, none, lastOToUe]},
    'oír': 'oye\toiga\toigamos\toíd\toigan',
    'complicar': {changes: [none, lastCToQu, lastCToQu, none, lastCToQu]},
    'actuar': {changes: [accentLastU, accentLastU, none, none, accentLastU]},
    'proseguir': 'prosigue\tproseguí\tprosiga\tprosigamos\tproseguid\tprosigan',
    'volver': 'vuelve\tvolvé\tvuelva\tvolvamos\tvolved\tvuelvan',
    'llegar': {changes: [none, appendU, appendU, none, appendU]},
  }
}
// @formatter:on
const VALID_ENDINGS = ['ar', 'er', 'ir', 'ír'];

// Utility
function ensureInfinitive(v) {
  const last2 = v.slice(-2);
  if (!VALID_ENDINGS.includes(last2)) {
    throw new Error(`Infinitive must end in -ar, -er, or -ir. Got: ${v}`);
  }
}

function splitInfinitive(verb) {
  const lower = verb.toLowerCase();
  ensureInfinitive(lower);
  return {
    verb: lower,
    stem: lower.slice(0, -2),
    ending: lower.slice(-2)
  };
}

// Participles / gerund
export function participles(infinitive, ref) {
  const {stem, ending} = splitInfinitive(infinitive);
  const calculatedGerund = ending === 'ar' ? `${stem}ando` : `${stem}iendo`;
  const gerund = tryIrregular([calculatedGerund], infinitive, ref, irregularityMap.gerund);
  const calculatedPastParticiple = ending === 'ar' ? `${stem}ado` : `${stem}ido`;
  const pastParticiple = tryIrregular([calculatedPastParticiple], infinitive, ref, irregularityMap.pastParticiple);
  return {gerund, pastParticiple};
}

export function gerundForm(inf, ref) {
  return [participles(inf, ref).gerund];
}

// Endings tables for regular verbs
const INDICATIVE_PRESENT = {
  ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
  er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
  ir: ['o', 'es', 'e', 'imos', 'ís', 'en'],
  'ír': ['o', 'es', 'e', 'imos', '<UNK>s', 'en'],
};

const INDICATIVE_PRETERITE = {
  ar: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'],
  er: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'],
  ir: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'],
  'ír': ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'],
};

const INDICATIVE_IMPERFECT = {
  ar: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'],
  er: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
  ir: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
  'ír': ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
};

const FUTURE_ENDINGS = ['é', 'ás', 'á', 'emos', 'éis', 'án'];
const CONDITIONAL_ENDINGS = ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'];

// Subjunctive present
const SUBJ_PRESENT = {
  ar: ['e', 'es', 'e', 'emos', 'éis', 'en'],
  er: ['a', 'as', 'a', 'amos', 'áis', 'an'],
  ir: ['a', 'as', 'a', 'amos', 'áis', 'an'],
  'ír': ['a', 'as', 'a', 'amos', 'áis', 'an'],
};

// Subjunctive imperfect base
const PRETERITE_3PL_SUFFIX_AR = 'aron';
const PRETERITE_3PL_SUFFIX_ERIR = 'ieron';

function preteriteThirdPlural(inf) {
  const {stem, ending} = splitInfinitive(inf);
  if (ending === 'ar') return `${stem}${PRETERITE_3PL_SUFFIX_AR}`;
  return `${stem}${PRETERITE_3PL_SUFFIX_ERIR}`;
}

function subjImperfectBase(inf) {
  const pp = preteriteThirdPlural(inf);
  return pp.slice(0, -3);
}

function subjImperfect(inf, series = 'ra') {
  const base = subjImperfectBase(inf);
  const raSet = ['ra', 'ras', 'ra', 'ramos', 'rais', 'ran'];
  const seSet = ['se', 'ses', 'se', 'semos', 'seis', 'sen'];
  const set = series === 'ra' ? raSet : seSet;
  const forms = set.map(s => base + s);
  forms[3] = addAccentToLastVowelBeforeSuffix(forms[3], set[3]);
  return forms;
}

function addAccentToLastVowelBeforeSuffix(word, suffix) {
  const idx = word.lastIndexOf(suffix);
  if (idx <= 0) return word;
  for (let i = idx - 1; i >= 0; i--) {
    const ch = word[i];
    const map = {a: 'á', e: 'é', i: 'í', o: 'ó', u: 'ú'};
    if (map[ch]) {
      return word.slice(0, i) + map[ch] + word.slice(i + 1);
    }
  }
  return word;
}

// Present perfect
const HABER_PRESENT = ['he', 'has', 'ha', 'hemos', 'habéis', 'han'];

// Imperative affirmative
function imperativeAffirmative(inf, ref) {
  const pres = indicativePresent(inf);
  const subj = subjunctivePresent(inf);
  const vosotros = `${inf.slice(0, -1)}d`;
  return tryIrregular([pres[2], subj[2], subj[3], vosotros, subj[5]], inf, ref, irregularityMap.imperativeAffirmative);
}

// Negative imperative
function imperativeNegative(inf) {
  return subjunctivePresent(inf);
}

function maybeProcessMapRecord(calculated, calculatedFrom, record) {
  if (typeof record === 'string') {
    return record.split(/[,; \t]+/);
  }
  const final = []
  for (let i = 0; i < calculated.length; i++) {
    try {
      final.push(record.changes[i](calculated[i], calculatedFrom));
    } catch (e) {
      console.error(e);
    }
  }
  return final;
}

function tryIrregular(calculated, inf, ref, irregularMap) {
  return irregular(calculated, inf, irregularMap, inf) || irregular(calculated, inf, irregularMap, ref) || calculated;
}

// Core conjugators
export function indicativePresent(inf, ref) {
  const {stem, ending} = splitInfinitive(inf);
  return tryIrregular(INDICATIVE_PRESENT[ending].map(suf => stem + suf), inf, ref, irregularityMap.present);
}

export function irregular(calculated, calculatedFrom, map, inf) {
  const foundExact = map[inf]
  if (foundExact) {
    return maybeProcessMapRecord(calculated, calculatedFrom, foundExact, inf);
  }
  return null
}

export function indicativePreterite(inf, ref) {
  const {stem, ending} = splitInfinitive(inf);
  return tryIrregular(INDICATIVE_PRETERITE[ending].map(suf => stem + suf), inf, ref, irregularityMap.preterite);
}

export function indicativeImperfect(inf, ref) {
  const {stem, ending} = splitInfinitive(inf);
  return tryIrregular(INDICATIVE_IMPERFECT[ending].map(suf => stem + suf), inf, ref, irregularityMap.imperfect);
}

export function indicativeFuture(inf, ref) {
  return tryIrregular(FUTURE_ENDINGS.map(suf => `${inf}${suf}`), inf, ref, irregularityMap.future);
}

export function indicativeConditional(inf, ref) {
  return tryIrregular(CONDITIONAL_ENDINGS.map(suf => `${inf}${suf}`), inf, ref, irregularityMap.conditional);
}

export function subjunctivePresent(inf, ref) {
  const {stem, ending} = splitInfinitive(inf);
  return tryIrregular(SUBJ_PRESENT[ending].map(suf => stem + suf), inf, ref, irregularityMap.subjunctivePresent);
}

export function subjunctiveImperfectRa(inf, ref) {
  return tryIrregular(subjImperfect(inf, 'ra'), inf, ref, irregularityMap.subjunctiveImperfect);
}

export function subjunctiveImperfectSe(inf, ref) {
  return subjImperfect(inf, 'se');
}

export function presentPerfect(inf, ref) {
  const {pastParticiple} = participles(inf, ref);
  return HABER_PRESENT.map(h => `${h} ${pastParticiple}`);
}

// --- ADD: Subjunctive Future (rare/archaic) ---
// built from the same preterite 3pl base as the imperfect subjunctive
export function subjunctiveFuture(inf, ref) {
  const base = subjImperfectBase(inf);         // e.g., hablaron → habla-, comieron → comie-
  const set = ['re', 'res', 're', 'remos', 'reis', 'ren'];
  const forms = set.map(s => base + s);        // hablare, hablares, hablare, hablaremos, hablareis, hablaren
  // add accent on nosotros (…ré/…áremos / …iéremos pattern)
  forms[3] = addAccentToLastVowelBeforeSuffix(forms[3], 'remos'); // habláremos, comiéremos, viviéremos
  return tryIrregular(forms, inf, ref, irregularityMap.subjunctiveFuture);
}

// Convenience: all rows
export function conjugateTableSpanish(inf, ref) {
  const now = indicativePresent(inf, ref);
  const then = indicativePreterite(inf, ref);
  const thenOngoing = indicativeImperfect(inf, ref);
  const future = indicativeFuture(inf, ref);
  const would = indicativeConditional(inf, ref);
  const emotionsNow = subjunctivePresent(inf, ref);
  const emotionsThen = subjunctiveImperfectRa(inf, ref);
  const emotionsFuture = subjunctiveFuture(inf, ref);
  const hasCompleted = presentPerfect(inf, ref);
  const impAff = imperativeAffirmative(inf, ref);
  const gerund = gerundForm(inf, ref);

  const row = (label, arr) => [...arr];

  return [
    inf,
    row('now', now),
    row('then', then),
    row('then-ongoing', thenOngoing),
    row('future', future),
    row('would', would),
    row('emotions-now', emotionsNow),
    row('emotions-then', emotionsThen),
    row('emotions-future', emotionsFuture),
    row('has completed', hasCompleted),
    [`(imperative)`, ...impAff],
    row('gerund', gerund)
  ];
}

// API
export function conjugateForm(inf, tense, ref) {
  switch (tense) {
    case 'present':
      return indicativePresent(inf, ref);
    case 'preterite':
      return indicativePreterite(inf, ref);
    case 'imperfect':
      return indicativeImperfect(inf, ref);
    case 'future':
      return indicativeFuture(inf, ref);
    case 'conditional':
      return indicativeConditional(inf, ref);
    case 'subjPresent':
      return subjunctivePresent(inf, ref);
    case 'subjImperfectRa':
      return subjunctiveImperfectRa(inf, ref);
    case 'subjImperfectSe':
      return subjunctiveImperfectSe(inf, ref);
    case 'subjFuture':
      return subjunctiveFuture(inf, ref);
    case 'presentPerfect':
      return presentPerfect(inf, ref);
    case 'imperativeAffirmative':
      return imperativeAffirmative(inf, ref);
    case 'imperativeNegative':
      return imperativeNegative(inf, ref);
    case 'gerund':
      return gerundForm(inf, ref);
    default:
      throw new Error(`Unsupported tense key: ${tense}`);
  }
}

