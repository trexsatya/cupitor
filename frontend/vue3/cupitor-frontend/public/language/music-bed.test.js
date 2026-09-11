import {
  MUSIC_TRACKS_MAX,
  MUSIC_VOL_IN_GAPS,
  musicVideoIdFromUrl,
  normalizeMusicTracks,
  musicSelectedId,
  musicVolumeFor,
  musicVolumeFieldsFor,
  musicShouldPlay,
  addMusicTrack,
  removeMusicTrack,
} from "./music-bed";

const YT = "https://www.youtube.com/watch?v=aBcDeFgHiJk";
const SHORT = "https://youtu.be/aBcDeFgHiJk";

describe("musicVideoIdFromUrl", () => {
  it("accepts the YouTube URL forms and rejects everything else", () => {
    expect(musicVideoIdFromUrl(YT)).toBe("aBcDeFgHiJk");
    expect(musicVideoIdFromUrl(SHORT)).toBe("aBcDeFgHiJk");
    expect(musicVideoIdFromUrl("https://vimeo.com/12345")).toBe("");
    expect(musicVideoIdFromUrl("file:///x.mp3")).toBe("");
    expect(musicVideoIdFromUrl(null)).toBe("");
  });
});

describe("normalizeMusicTracks", () => {
  // The same track pasted in two URL forms is one track, not two rows that
  // both play the same thing.
  it("collapses duplicates by video id and drops unusable rows", () => {
    const out = normalizeMusicTracks([
      { id: "a", url: YT, name: "One" },
      { id: "a", url: SHORT, name: "One again" },
      null,
      { id: "", name: "nameless" },
      { id: "b" },
    ]);
    expect(out.map(t => t.id)).toEqual(["a", "b"]);
    // A row always has a name, so the picker can't render a blank option.
    expect(out[1].name).toBe("b");
  });

  it("caps the library", () => {
    const many = Array.from({ length: MUSIC_TRACKS_MAX + 10 }, (_, i) => ({ id: `v${i}` }));
    expect(normalizeMusicTracks(many)).toHaveLength(MUSIC_TRACKS_MAX);
  });
});

describe("musicSelectedId", () => {
  const settings = { recMusicTracks: [{ id: "a" }, { id: "b" }] };

  it("honours a valid selection", () => {
    expect(musicSelectedId({ ...settings, recMusicSelected: "b" })).toBe("b");
  });

  // A deleted track shouldn't silence a library that still has music in it.
  it("falls back to the first track when the selection is gone", () => {
    expect(musicSelectedId({ ...settings, recMusicSelected: "deleted" })).toBe("a");
    expect(musicSelectedId(settings)).toBe("a");
  });

  it("is empty only when the library is", () => {
    expect(musicSelectedId({ recMusicTracks: [] })).toBe("");
    expect(musicSelectedId({})).toBe("");
  });
});

describe("musicVolumeFor", () => {
  const s = { recMusicVolume: 10, recMusicGapVolume: 70 };

  // 'clip' is the only phase where something else is sounding.
  it("uses the quiet level only while audio is playing", () => {
    expect(musicVolumeFor(s, "clip")).toBe(10);
    expect(musicVolumeFor(s, "gap")).toBe(70);
    expect(musicVolumeFor(s, "idle")).toBe(70);
  });

  it("clamps and falls back", () => {
    expect(musicVolumeFor({ recMusicGapVolume: 900 }, "gap")).toBe(100);
    expect(musicVolumeFor({ recMusicGapVolume: -5 }, "gap")).toBe(0);
    expect(musicVolumeFor({}, "gap")).toBe(MUSIC_VOL_IN_GAPS);
  });
});

describe("musicVolumeFieldsFor", () => {
  it("offers both sliders only where both situations arise", () => {
    expect(musicVolumeFieldsFor("item")).toEqual(["withAudio"]);
    expect(musicVolumeFieldsFor("gap")).toEqual(["inGaps"]);
    expect(musicVolumeFieldsFor("nonstop")).toEqual(["withAudio", "inGaps"]);
  });
});

describe("musicShouldPlay", () => {
  const base = { hasTrack: true, playing: true, paused: false, errored: false };

  it("maps each mode to the phases it sounds in", () => {
    const at = (mode, phase) => musicShouldPlay({ ...base, mode, phase });
    expect(["clip", "gap", "idle"].map(p => at("nonstop", p))).toEqual([true, true, true]);
    expect(["clip", "gap", "idle"].map(p => at("item", p))).toEqual([true, false, false]);
    expect(["clip", "gap", "idle"].map(p => at("gap", p))).toEqual([false, true, false]);
  });

  // A captured clip carries its own audio in every mode.
  it("never plays over a video clip", () => {
    for (const mode of ["item", "gap", "nonstop"]) {
      expect(musicShouldPlay({ ...base, mode, phase: "video" })).toBe(false);
    }
  });

  // Hushing is orthogonal: it silences the bed in every mode and every phase,
  // including the ones that would otherwise always be playing.
  it("stays silent while hushed, whatever else is true", () => {
    for (const mode of ["item", "gap", "nonstop"]) {
      for (const phase of ["clip", "gap", "idle"]) {
        expect(musicShouldPlay({ ...base, mode, phase, hushed: true })).toBe(false);
      }
    }
  });

  it("stays silent when there is nothing to play or nothing running", () => {
    const s = { ...base, mode: "nonstop", phase: "gap" };
    expect(musicShouldPlay({ ...s, hasTrack: false })).toBe(false);
    expect(musicShouldPlay({ ...s, errored: true })).toBe(false);
    expect(musicShouldPlay({ ...s, playing: false })).toBe(false);
    expect(musicShouldPlay({ ...s, paused: true })).toBe(false);
  });
});

describe("addMusicTrack / removeMusicTrack", () => {
  it("reports why a URL was not added", () => {
    expect(addMusicTrack([], "https://vimeo.com/1").reason).toBe("not-youtube");
    const first = addMusicTrack([], YT, "Lo-fi");
    expect(first.added).toBe(true);
    expect(first.tracks[0]).toEqual({ id: "aBcDeFgHiJk", url: YT, name: "Lo-fi" });
    // Same video via the short form is the same track.
    const again = addMusicTrack(first.tracks, SHORT, "");
    expect(again.added).toBe(false);
    expect(again.reason).toBe("duplicate");
    expect(again.tracks).toHaveLength(1);
  });

  // Re-adding with a name is how a track gets renamed from the add box; each
  // call returns a fresh list, so it never mutates the one passed in.
  it("renames on a duplicate that carries a name", () => {
    const { tracks } = addMusicTrack([], YT, "Old");
    expect(addMusicTrack(tracks, YT, "New").tracks[0].name).toBe("New");
    expect(addMusicTrack(tracks, YT, "").tracks[0].name).toBe("Old");
    expect(tracks[0].name).toBe("Old");
  });

  it("refuses to grow past the cap", () => {
    const full = Array.from({ length: MUSIC_TRACKS_MAX }, (_, i) => ({ id: `v${i}` }));
    expect(addMusicTrack(full, YT, "x").reason).toBe("full");
  });

  it("removes by id and leaves the rest alone", () => {
    const { tracks } = addMusicTrack([], YT, "Lo-fi");
    expect(removeMusicTrack(tracks, "aBcDeFgHiJk")).toEqual([]);
    expect(removeMusicTrack(tracks, "nope")).toHaveLength(1);
  });
});
