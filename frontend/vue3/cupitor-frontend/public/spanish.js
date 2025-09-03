
const irregularityMap = {
  present: {
    'contar': 'cuento\tcuentas\tcontás\tcontamos\tcontáis\tcuentan',
    'pedir': 'pido\tpides\tpedís\tpide\tpedimos\tpedís\tpiden',
    'pensar': 'pienso\tpiensas\tpensás\tpiensa\tpensamos\tpensáis\tpiensan',
    'entender': 'entiendo\tentiendes\tentendés\tentiende\tentendemos\tentendéis\tentienden'
  },
  preterite: {},
  imperfect: {
  },
  future: { },
  conditional: { },
  subjunctivePresent: {
    'contar': 'cuente\tcuentes\tcuente\tcontemos\tcontéis\tcuenten',
    'pedir': 'pida\tpidas\tpidas, pidás\tpida\tpidamos\tpidáis\tpidan',
    'pensar': 'piense\tpienses\tpienses\tpiense\tpensemos\tpenséis\tpiensen',
    'entender': 'entienda\tentiendas\tentiendas\tentienda\tentendamos\tentendáis\tentiendan'
  },
  subjunctiveImperfect: {
    'pedir': 'pidiera\tpidieras\tpidieras\tpidiera\tpidiésemos\tpidierais\tpidieran'
  },
  subjunctiveFuture: {
    'pedir': 'pidiere\tpidieres\tpidieres\tpidiere\tpidiéremos\tpidiereis\tpidieren'
  },
  gerund: {
    'pedir': 'pidiendo'
  },
  imperativeAffirmative: {
    'contar': 'cuenta\tcontá\tcuente\tcontemos\tcontad\tcuenten',
    'pedir': 'pide\tpedí\tpida\tpidamos\tpedid\tpidan',
    'pensar': 'piensa\tpensá\tpiense\tpensemos\tpensad\tpiensen',
    'entender': 'entiende\tentendé\tentienda\tentendamos\tentended\tentiendan'
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
  return irregularityMap.imperativeAffirmative[inf]?.split(/[,; \t]+/) || [ pres[2], subj[2], subj[3], vosotros, subj[5] ];
}

// Negative imperative
function imperativeNegative(inf) {
  return subjunctivePresent(inf);
}

function buildUsingRef(inf, ref, stem) {

}

// Core conjugators
export function indicativePresent(inf, ref) {
  const { stem, ending } = splitInfinitive(inf);
  return irregularityMap.present[inf]?.split(/[,; \t]+/) || INDICATIVE_PRESENT[ending].map(suf => stem + suf);
}

export function indicativePreterite(inf, ref) {
  const { stem, ending } = splitInfinitive(inf);
  return irregularityMap.preterite[inf]?.split(/[,; \t]+/) || INDICATIVE_PRETERITE[ending].map(suf => stem + suf);
}

export function indicativeImperfect(inf, ref) {
  const { stem, ending } = splitInfinitive(inf);
  return irregularityMap.imperfect[inf]?.split(/[,; \t]+/) || INDICATIVE_IMPERFECT[ending].map(suf => stem + suf);
}

export function indicativeFuture(inf, ref) {
  return irregularityMap.future[inf]?.split(/[,; \t]+/) || FUTURE_ENDINGS.map(suf => `${inf}${suf}`);
}

export function indicativeConditional(inf, ref) {
  return irregularityMap.conditional[inf]?.split(/[,; \t]+/) || CONDITIONAL_ENDINGS.map(suf => `${inf}${suf}`);
}

export function subjunctivePresent(inf, ref) {
  const { stem, ending } = splitInfinitive(inf);
  return irregularityMap.subjunctivePresent[inf]?.split(/[,; \t]+/) || SUBJ_PRESENT[ending].map(suf => stem + suf);
}

export function subjunctiveImperfectRa(inf, ref) {
  return irregularityMap.subjunctiveImperfect[inf]?.split(/[,; \t]+/) || subjImperfect(inf, 'ra');
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
  return irregularityMap.subjunctiveFuture[inf]?.split(/[,; \t]+/) || forms;
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
export function conjugateForm(inf, tense) {
  switch (tense) {
    case 'present': return indicativePresent(inf);
    case 'preterite': return indicativePreterite(inf);
    case 'imperfect': return indicativeImperfect(inf);
    case 'future': return indicativeFuture(inf);
    case 'conditional': return indicativeConditional(inf);
    case 'subjPresent': return subjunctivePresent(inf);
    case 'subjImperfectRa': return subjunctiveImperfectRa(inf);
    case 'subjImperfectSe': return subjunctiveImperfectSe(inf);
    case 'subjFuture': return subjunctiveFuture(inf);
    case 'presentPerfect': return presentPerfect(inf);
    case 'imperativeAffirmative': return imperativeAffirmative(inf);
    case 'imperativeNegative': return imperativeNegative(inf);
    case 'gerund': return gerundForm(inf);
    default:
      throw new Error(`Unsupported tense key: ${tense}`);
  }
}

