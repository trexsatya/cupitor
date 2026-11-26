import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { speechLocale } from './language-config.js'

const app = fs.readFileSync(path.join(__dirname, 'language.js'), 'utf8')
const functions = app.slice(app.indexOf('function _ttsLangCode()'), app.indexOf('// Render / refresh the play-mode info banner'))

test.each([
  ['sv', 'sv-SE'], ['es', 'es-ES'], ['fr', 'fr-FR'], ['de', 'de-DE'],
])('word pronunciation uses %s for Google and its locale for browser speech', async (code, locale) => {
  const audio = [], spoken = []
  class Audio {
    constructor() { audio.push(this) }
    play() { this.onended(); return Promise.resolve() }
  }
  class SpeechSynthesisUtterance {
    constructor(text) { this.text = text }
  }
  const context = vm.createContext({
    getLangFromUrl: () => ({code}), speechLocale, Audio, SpeechSynthesisUtterance,
    setTimeout: () => 0,
    window: {
      SpeechSynthesisUtterance,
      speechSynthesis: { cancel() {}, speak(utterance) { spoken.push(utterance); utterance.onend() } },
    },
  })
  vm.runInContext(functions, context)
  await vm.runInContext('_speakWordGoogle("word")', context)
  expect(new URL(audio[0].src).searchParams.get('tl')).toBe(code)
  await vm.runInContext('_speakWordBrowser("word")', context)
  expect(spoken[0].lang).toBe(locale)
})
