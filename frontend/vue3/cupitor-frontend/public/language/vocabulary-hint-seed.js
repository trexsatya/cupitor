import { vocabularyFormKey, vocabularyLineParts } from './vocabulary-hints.js'

function group(language, category, line, links) {
  const forms = vocabularyLineParts(line).forms.map((text, index) => ({
    id: String(index + 1), text, meanings: links[vocabularyFormKey(text)] || [],
  }))
  return { language, category, line, forms }
}

export const vocabularyHintSeed = {
  version: 1,
  meanings: {
    'hole-in-surface': {
      label: 'Hole in a surface',
      hints: { en: ['hole'], hi: ['छेद', 'chhed'] },
      examples: { sv: 'Det är ett hål i väggen.', hi: 'दीवार में एक छेद है।', en: 'There is a hole in the wall.' },
    },
    'narrow-gap': {
      label: 'Narrow gap',
      hints: { en: ['narrow gap', 'slit'], hi: ['पतली दरार', 'patli darar', 'सँकरी दरार'] },
      examples: { sv: 'Ljus kom in genom springan.', hi: 'दरार से रोशनी आ रही थी।', en: 'Light came through the gap.' },
    },
    'opening-in-wall': {
      label: 'Opening in a wall',
      hints: { en: ['opening in a wall'], hi: ['दीवार में खुली जगह'] },
      examples: { sv: 'Det finns en öppning i väggen.', hi: 'दीवार में एक खुली जगह है।', en: 'There is an opening in the wall.' },
    },
    'eat-food': {
      label: 'Eat food',
      hints: { en: ['eat'], hi: ['खाना', 'खाना खाना', 'khana'] },
      examples: { sv: 'Vill du äta nu?', es: '¿Quieres comer ahora?', hi: 'क्या तुम अभी खाना खाना चाहते हो?', en: 'Do you want to eat now?' },
    },
    'drink-liquid': {
      label: 'Drink liquid',
      hints: { en: ['drink'], hi: ['पीना', 'पानी पीना', 'peena'] },
      examples: { sv: 'Jag dricker vatten.', es: 'Bebo agua.', hi: 'मैं पानी पीता हूँ।', en: 'I drink water.' },
    },
  },
  groups: {
    'swedish-openings': group('sv', 'Shapes, arrangements and conditions',
      '(opening, gap)|öppning|slits|hål|glugg|gluggar|springa|springor|', {
        öppning: ['opening-in-wall'], slits: ['narrow-gap'], hål: ['hole-in-surface'],
        springa: ['narrow-gap'], springor: ['narrow-gap'],
      }),
    'swedish-eat': group('sv', 'Basic Necessities',
      '(eat)| äta | äter | åt | ätit | ät |förtära(f.)|inmundiga( elevated)|konsumera|käka( informal)|krubba( slang)|inmundiga( elevated)|', {
        äta: ['eat-food'], äter: ['eat-food'], åt: ['eat-food'], ätit: ['eat-food'], ät: ['eat-food'],
      }),
    'swedish-drink': group('sv', 'Food, Drink, kitchen, Eating', '(drink)|dricka|dricker|drack|druckit|', {
      dricka: ['drink-liquid'], dricker: ['drink-liquid'], drack: ['drink-liquid'], druckit: ['drink-liquid'],
    }),
    'spanish-eat': group('es', 'Food, Drink, kitchen, Eating', '(eat)|comer|alimentarse|', { comer: ['eat-food'] }),
    'spanish-drink': group('es', 'Food, Drink, kitchen, Eating', '(drink)|beber|tomar|', { beber: ['drink-liquid'] }),
  },
}
