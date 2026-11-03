import { DEFAULTS, mergeConfig } from "./config.js";

describe("mergeConfig", () => {
  test("later layers override earlier; falsy layers skipped", () => {
    const cfg = mergeConfig(DEFAULTS, null, { rareThreshold: 5, lang: "de" });
    expect(cfg.rareThreshold).toBe(5);
    expect(cfg.lang).toBe("de");
    expect(cfg.targetLang).toBe(DEFAULTS.targetLang); // untouched default
  });

  test("array options are replaced wholesale", () => {
    const cfg = mergeConfig(DEFAULTS, { excludeChannels: ["X", "Y"] });
    expect(cfg.excludeChannels).toEqual(["X", "Y"]);
  });

  test("DEFAULTS carries the documented step defaults", () => {
    expect(DEFAULTS.chunkFilmot).toBe(10);
    expect(DEFAULTS.chunkSrt).toBe(20);
    expect(DEFAULTS.linesBefore).toBe(3);
    expect(DEFAULTS.preferManualCaptions).toBe(true);
  });
});

describe('registered CLI language configuration', () => {
  const {loadConfig} = require('./config.js')
  test('normalizes registered names and locales without changing arbitrary explicit language-code support', () => {
    expect(loadConfig(null, {lang:'spanish', targetLang:'english'})).toMatchObject({lang:'es',targetLang:'en'})
    expect(loadConfig(null, {lang:'sv-SE'}).lang).toBe('sv')
    expect(loadConfig(null, {lang:'uk'}).lang).toBe('uk')
    expect(() => loadConfig(null, {lang:'../swedish'})).toThrow(/Unsupported lang/)
  })
})
