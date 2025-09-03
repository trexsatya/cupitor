const PERSONS = ['yo','tú','él/ella/Ud.','nosotros','vosotros','ellos/Uds.'];

function detectType(inf) {
  if (inf.endsWith('ar')) return 'ar';
  if (inf.endsWith('er')) return 'er';
  if (inf.endsWith('ir')) return 'ir';
  throw new Error('Verb måste sluta på -ar, -er eller -ir');
}
function stem(inf) { return inf.slice(0,-2); }

const ENDINGS = {
  indicative: {
    present: {
      ar: ['o','as','a','amos','áis','an'],
      er: ['o','es','e','emos','éis','en'],
      ir: ['o','es','e','imos','ís','en']
    },
    preterite: {
      ar: ['é','aste','ó','amos','asteis','aron'],
      er: ['í','iste','ió','imos','isteis','ieron'],
      ir: ['í','iste','ió','imos','isteis','ieron']
    },
    imperfect: {
      ar: ['aba','abas','aba','ábamos','abais','aban'],
      er: ['ía','ías','ía','íamos','íais','ían'],
      ir: ['ía','ías','ía','íamos','íais','ían']
    },
    future: { base: ['é','ás','á','emos','éis','án'] },
    conditional: { base: ['ía','ías','ía','íamos','íais','ían'] }
  },
  subjunctive: {
    present: {
      ar: ['e','es','e','emos','éis','en'],
      er: ['a','as','a','amos','áis','an'],
      ir: ['a','as','a','amos','áis','an']
    }
  }
};

// Hjälpfunktioner
function apply(stem, endings) { return endings.map(e => stem+e); }
function applyInf(inf, suffixes) { return suffixes.map(s => inf+s); }

// Bygg en tabell av konjugationer
export function conjugateTableSpanish(inf) {
  const type = detectType(inf);
  const root = stem(inf);

  const pres = apply(root, ENDINGS.indicative.present[type]);
  const pret = apply(root, ENDINGS.indicative.preterite[type]);
  const impf = apply(root, ENDINGS.indicative.imperfect[type]);
  const fut = applyInf(inf, ENDINGS.indicative.future.base);
  const cond = applyInf(inf, ENDINGS.indicative.conditional.base);
  const subjPres = apply(root, ENDINGS.subjunctive.present[type]);

  // imperfect subjunctive: ellos preterite -ron + endings
  const pretEllos = pret[5];
  const base = pretEllos.slice(0,-3);
  const impSubjRa = ['ra','ras','ra','ramos','rais','ran'].map(e=>base+e);
  const impSubjSe = ['se','ses','se','semos','seis','sen'].map(e=>base+e);
  const impSubj = impSubjRa.map((form,i)=> form);

  // Perfekt: presens av haber + particip
  const haberPres = ['he','has','ha','hemos','habéis','han'];
  const particip = (type==='ar')? root+'ado' : root+'ido';
  const perf = haberPres.map(h=>h+' '+particip);

  // Imperativ (affirmativ)
  const imperative = [
    pres[2],        // tú → 3s present indicative
    subjPres[2],    // Ud.
    subjPres[3],    // nosotros
    inf.slice(0,-1)+'d', // vosotros: infinitive -r + d
    subjPres[5]     // Uds.
  ];
  // match med personer: (tú, Ud., nosotros, vosotros, Uds.)
  // för utskrift kan vi placera i samma rad

  // Bygg tabellen i samma stil som exemplet
  return [
    ['(now)', ...pres],
    ['(then)', ...pret],
    ['(then-ongoing)', ...impf],
    ['(future)', ...fut],
    ['(would)', ...cond],
    ['(emotions-now)', ...subjPres],
    ['(emotions-then)', ...impSubj],
    ['(has completed)', ...perf],
    ['(imperative)', imperative[0], imperative[1], imperative[2], imperative[3], imperative[4]]
  ];
}

