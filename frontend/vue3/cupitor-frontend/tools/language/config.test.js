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
