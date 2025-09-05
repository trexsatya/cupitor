/* eslint-disable @typescript-eslint/no-use-before-define */
const lastEToIe = (calculated, inf) => {
  const { stem, ending } = splitInfinitive(inf);
  return calculated.replace(stem, stem.replace(/e([^e]*)$/, 'ie$1'));
}
const lastEToI = (calculated, inf) => {
  const { stem, ending } = splitInfinitive(inf);
  return calculated.replace(stem, stem.replace(/e([^e]*)$/, 'i$1'));
}
const lastZToC = (calculated, inf) => {
  const { stem, ending } = splitInfinitive(inf);
  return calculated.replace(stem, stem.replace(/z([^z]*)$/, 'c$1'));
}
const none = x => x;

const irregularityMap = {
  present: {
    'contar': 'cuento\tcuentas\tcontás\tcuenta\tcontamos\tcontáis\tcuentan',
    'pedir': 'pido\tpides\tpedís\tpide\tpedimos\tpedís\tpiden',
    'pensar': 'pienso\tpiensas\tpensás\tpiensa\tpensamos\tpensáis\tpiensan',
    'sentir': {changes: [lastEToIe, lastEToIe, lastEToIe, none, none, lastEToIe]},
    'entender': {changes: [lastEToIe, lastEToIe, lastEToIe, none, none, lastEToIe]},
  },
  preterite: {
    'realizar': {changes: [lastZToC, none, none, none, none, none]},
  },
  imperfect: {
  },
  future: { },
  conditional: { },
  subjunctivePresent: {
    'contar': 'cuente\tcuentes\tcuente\tcontemos\tcontéis\tcuenten',
    'pedir': 'pida\tpidas\tpidas, pidás\tpida\tpidamos\tpidáis\tpidan',
    'pensar': 'piense\tpienses\tpienses\tpiense\tpensemos\tpenséis\tpiensen',
    'sentir': {changes: [lastEToIe, lastEToIe, lastEToIe, lastEToI, lastEToI, lastEToIe]},
    'entender': {changes: [lastEToIe, lastEToIe, lastEToIe, none, none, lastEToIe]},
    'realizar': {changes: [lastZToC, lastZToC, lastZToC, lastZToC, lastZToC, lastZToC]},
  },
  subjunctiveImperfect: {
    'pedir': 'pidiera\tpidieras\tpidieras\tpidiera\tpidiésemos\tpidierais\tpidieran',
    'sentir': {changes: [lastEToI, lastEToI, lastEToI, lastEToI, lastEToI, lastEToI]}
  },
  subjunctiveFuture: {
    'pedir': 'pidiere\tpidieres\tpidieres\tpidiere\tpidiéremos\tpidiereis\tpidieren',
    'sentir': {changes: [lastEToI, lastEToI, lastEToI, lastEToI, lastEToI, lastEToI]}
  },
  gerund: {
    'pedir': 'pidiendo',
    'sentir': {changes: [lastEToI]}
  },
  imperativeAffirmative: {
    'contar': 'cuenta\tcontá\tcuente\tcontemos\tcontad\tcuenten',
    'pedir': 'pide\tpedí\tpida\tpidamos\tpedid\tpidan',
    'pensar': 'piensa\tpensá\tpiense\tpensemos\tpensad\tpiensen',
    'sentir': {changes: [lastEToIe, lastEToIe, lastEToI, none, lastEToIe]},
    'entender': {changes: [lastEToIe, lastEToIe, none, none, lastEToIe]},
    'realizar': {changes: [none, lastZToC, lastZToC, none, lastZToC]},
  }
}

const VALID_ENDINGS = ['ar', 'er', 'ir'];

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
export function participles(infinitive) {
  const { stem, ending } = splitInfinitive(infinitive);
  const gerund = irregularityMap.gerund[infinitive]?.split(/[,; \t]+/) || (ending === 'ar' ? `${stem}ando` : `${stem}iendo`);
  const pastParticiple = ending === 'ar' ? `${stem}ado` : `${stem}ido`;
  return { gerund, pastParticiple };
}

export function gerundForm(inf) {
  return [participles(inf).gerund];
}

// Endings tables for regular verbs
const INDICATIVE_PRESENT = {
  ar: ['o', 'as', 'a', 'amos', 'áis', 'an'],
  er: ['o', 'es', 'e', 'emos', 'éis', 'en'],
  ir: ['o', 'es', 'e', 'imos', 'ís', 'en']
};

const INDICATIVE_PRETERITE = {
  ar: ['é', 'aste', 'ó', 'amos', 'asteis', 'aron'],
  er: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron'],
  ir: ['í', 'iste', 'ió', 'imos', 'isteis', 'ieron']
};

const INDICATIVE_IMPERFECT = {
  ar: ['aba', 'abas', 'aba', 'ábamos', 'abais', 'aban'],
  er: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'],
  ir: ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían']
};

const FUTURE_ENDINGS = ['é', 'ás', 'á', 'emos', 'éis', 'án'];
const CONDITIONAL_ENDINGS = ['ía', 'ías', 'ía', 'íamos', 'íais', 'ían'];

// Subjunctive present
const SUBJ_PRESENT = {
  ar: ['e', 'es', 'e', 'emos', 'éis', 'en'],
  er: ['a', 'as', 'a', 'amos', 'áis', 'an'],
  ir: ['a', 'as', 'a', 'amos', 'áis', 'an']
};

// Subjunctive imperfect base
const PRETERITE_3PL_SUFFIX_AR = 'aron';
const PRETERITE_3PL_SUFFIX_ERIR = 'ieron';

function preteriteThirdPlural(inf) {
  const { stem, ending } = splitInfinitive(inf);
  if (ending === 'ar') return `${stem}${PRETERITE_3PL_SUFFIX_AR}`;
  return `${stem}${PRETERITE_3PL_SUFFIX_ERIR}`;
}

function subjImperfectBase(inf) {
  const pp = preteriteThirdPlural(inf);
  return pp.slice(0, -3);
}

function subjImperfect(inf, series = 'ra') {
  const base = subjImperfectBase(inf);
  const raSet = ['ra','ras','ra','ramos','rais','ran'];
  const seSet = ['se','ses','se','semos','seis','sen'];
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
    const map = { a:'á', e:'é', i:'í', o:'ó', u:'ú' };
    if (map[ch]) {
      return word.slice(0,i) + map[ch] + word.slice(i+1);
    }
  }
  return word;
}

// Present perfect
const HABER_PRESENT = ['he','has','ha','hemos','habéis','han'];

// Imperative affirmative
function imperativeAffirmative(inf, ref) {
  const pres = indicativePresent(inf);
  const subj = subjunctivePresent(inf);
  const vosotros = `${inf.slice(0, -1)}d`;
  return tryIrregular([ pres[2], subj[2], subj[3], vosotros, subj[5] ], inf, ref, irregularityMap.imperativeAffirmative);
}

// Negative imperative
function imperativeNegative(inf) {
  return subjunctivePresent(inf);
}

function maybeProcessMapRecord(calculated, calculatedFrom, record) {
  if(typeof record === 'string') {
    return record;
  }
  const final = []
  for(let i = 0; i < calculated.length; i++) {
    final.push(record.changes[i](calculated[i], calculatedFrom));
  }
  return final;
}

function tryIrregular(calculated, inf, ref, irregularMap) {
  return irregular(calculated, inf, irregularMap, inf) || irregular(calculated, inf, irregularMap, ref) || calculated;
}

// Core conjugators
export function indicativePresent(inf, ref) {
  const { stem, ending } = splitInfinitive(inf);
  return tryIrregular(INDICATIVE_PRESENT[ending].map(suf => stem + suf), inf, ref, irregularityMap.present);
}

export function irregular(calculated, calculatedFrom, map, inf) {
  const foundExact = map[inf]
  if(foundExact) {
    return maybeProcessMapRecord(calculated, calculatedFrom, foundExact, inf);
  }
  return null
}

export function indicativePreterite(inf, ref) {
  const { stem, ending } = splitInfinitive(inf);
  return  tryIrregular(INDICATIVE_PRETERITE[ending].map(suf => stem + suf), inf, ref, irregularityMap.preterite);
}

export function indicativeImperfect(inf, ref) {
  const { stem, ending } = splitInfinitive(inf);
  return tryIrregular(INDICATIVE_IMPERFECT[ending].map(suf => stem + suf), inf, ref, irregularityMap.imperfect);
}

export function indicativeFuture(inf, ref) {
  return tryIrregular(FUTURE_ENDINGS.map(suf => `${inf}${suf}`), inf, ref, irregularityMap.future);
}

export function indicativeConditional(inf, ref) {
  return tryIrregular(CONDITIONAL_ENDINGS.map(suf => `${inf}${suf}`), inf, ref, irregularityMap.conditional);
}

export function subjunctivePresent(inf, ref) {
  const { stem, ending } = splitInfinitive(inf);
  return tryIrregular(SUBJ_PRESENT[ending].map(suf => stem + suf), inf, ref, irregularityMap.subjunctivePresent);
}

export function subjunctiveImperfectRa(inf, ref) {
  return tryIrregular(subjImperfect(inf, 'ra'), inf, ref, irregularityMap.subjunctiveImperfect);
}

export function subjunctiveImperfectSe(inf, ref) {
  return subjImperfect(inf, 'se');
}

export function presentPerfect(inf, ref) {
  const { pastParticiple } = participles(inf);
  return HABER_PRESENT.map(h => `${h} ${pastParticiple}`);
}

// --- ADD: Subjunctive Future (rare/archaic) ---
// built from the same preterite 3pl base as the imperfect subjunctive
export function subjunctiveFuture(inf, ref) {
  const base = subjImperfectBase(inf);         // e.g., hablaron → habla-, comieron → comie-
  const set  = ['re','res','re','remos','reis','ren'];
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
    case 'present': return indicativePresent(inf, ref);
    case 'preterite': return indicativePreterite(inf, ref);
    case 'imperfect': return indicativeImperfect(inf, ref);
    case 'future': return indicativeFuture(inf, ref);
    case 'conditional': return indicativeConditional(inf, ref);
    case 'subjPresent': return subjunctivePresent(inf, ref);
    case 'subjImperfectRa': return subjunctiveImperfectRa(inf, ref);
    case 'subjImperfectSe': return subjunctiveImperfectSe(inf, ref);
    case 'subjFuture': return subjunctiveFuture(inf, ref);
    case 'presentPerfect': return presentPerfect(inf, ref);
    case 'imperativeAffirmative': return imperativeAffirmative(inf, ref);
    case 'imperativeNegative': return imperativeNegative(inf, ref);
    case 'gerund': return gerundForm(inf, ref);
    default:
      throw new Error(`Unsupported tense key: ${tense}`);
  }
}

