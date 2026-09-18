import {
  MUSIC_TRACKS_MAX,
  MUSIC_VOL_IN_GAPS,
  musicVideoIdFromUrl,
  normalizeMusicTracks,
  musicSelectedId,
  musicVolumeFor,
  musicVolumeFieldsFor,
  musicShouldPlay,
  musicNeedsReload,
  MUSIC_END_EPSILON,
  addMusicTrack,
  removeMusicTrack,
  MUSIC_SERVE_BASE,
  musicTrackKind,
  musicLocalFileName,
  musicLocalIdFromUrl,
  musicEngineFor,
  musicServedUrl,
  addLocalMusicTrack,
  pruneMissingLocalTracks,
  resolveMusicTrack,
  MUSIC_NONE,
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
    expect(first.tracks[0]).toEqual({ kind: "youtube", id: "aBcDeFgHiJk", url: YT, name: "Lo-fi" });
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

// ── Local tracks ─────────────────────────────────────────────────────────

const LOCAL = "file:///data/user/0/org.satya.cupitor/files/music/kalinka.mp3";
const LOCAL2 = "file:///data/user/0/org.satya.cupitor/files/music/waltz.ogg";

describe("musicTrackKind", () => {
  // A library saved before local tracks existed has no `kind` at all, and
  // every one of those rows is a YouTube track.
  it("defaults to youtube and only reads 'local' as local", () => {
    expect(musicTrackKind({ id: "a", url: YT })).toBe("youtube");
    expect(musicTrackKind({ kind: "youtube", id: "a" })).toBe("youtube");
    expect(musicTrackKind({ kind: "local", id: "local:x.mp3" })).toBe("local");
    expect(musicTrackKind({ kind: "nonsense", id: "a" })).toBe("youtube");
    expect(musicTrackKind(null)).toBe("youtube");
  });
});

describe("musicLocalFileName", () => {
  it("takes the basename of a file url and rejects anything else", () => {
    expect(musicLocalFileName(LOCAL)).toBe("kalinka.mp3");
    expect(musicLocalFileName("file:///a/b/c/My Song (live).m4a")).toBe("My Song (live).m4a");
    expect(musicLocalFileName("https://example.com/x.mp3")).toBe("");
    expect(musicLocalFileName("file:///dir/")).toBe("");
    expect(musicLocalFileName(null)).toBe("");
  });
});

describe("musicLocalIdFromUrl", () => {
  // The id IS the filename, so a url that is already saved collapses onto the
  // existing row through the dedupe normalizeMusicTracks already does.
  it("derives the id from the filename", () => {
    expect(musicLocalIdFromUrl(LOCAL)).toBe("local:kalinka.mp3");
    expect(musicLocalIdFromUrl("https://example.com/x.mp3")).toBe("");
  });
});

describe("musicEngineFor", () => {
  it("names the engine each track needs", () => {
    expect(musicEngineFor({ id: "aBcDeFgHiJk", url: YT })).toBe("youtube");
    expect(musicEngineFor({ kind: "local", id: "local:kalinka.mp3", url: LOCAL })).toBe("local");
    // A local row whose url has been emptied can't be played by anything.
    expect(musicEngineFor({ kind: "local", id: "local:x", url: "" })).toBe("none");
    expect(musicEngineFor({ id: "", url: YT })).toBe("none");
    expect(musicEngineFor(null)).toBe("none");
  });
});

describe("musicServedUrl", () => {
  // A page loaded over https cannot reference a file:// subresource, so the
  // player asks the app for it over the intercepted origin instead.
  it("builds the served url from the filename, and is empty for youtube", () => {
    expect(musicServedUrl({ kind: "local", id: "local:kalinka.mp3", url: LOCAL }))
      .toBe(`${MUSIC_SERVE_BASE}kalinka.mp3`);
    expect(musicServedUrl({ kind: "local", id: "x", url: "file:///a/My Song.m4a" }))
      .toBe(`${MUSIC_SERVE_BASE}My%20Song.m4a`);
    expect(musicServedUrl({ id: "aBcDeFgHiJk", url: YT })).toBe("");
    expect(musicServedUrl(null)).toBe("");
  });
});

describe("addLocalMusicTrack", () => {
  it("adds a file url, naming it from the file when no name is given", () => {
    const res = addLocalMusicTrack([], LOCAL, "");
    expect(res.added).toBe(true);
    expect(res.id).toBe("local:kalinka.mp3");
    expect(res.tracks[0]).toEqual({
      kind: "local", id: "local:kalinka.mp3", url: LOCAL, name: "kalinka.mp3",
    });
  });

  it("refuses anything that is not a file url", () => {
    expect(addLocalMusicTrack([], YT, "x").reason).toBe("not-local");
    expect(addLocalMusicTrack([], "", "x").reason).toBe("not-local");
  });

  // Same rename-on-duplicate behaviour the YouTube add box has, and the list
  // passed in is never mutated.
  it("collapses a duplicate url and renames when given a name", () => {
    const { tracks } = addLocalMusicTrack([], LOCAL, "Kalinka");
    const again = addLocalMusicTrack(tracks, LOCAL, "Kalinka (slow)");
    expect(again.added).toBe(false);
    expect(again.reason).toBe("duplicate");
    expect(again.tracks).toHaveLength(1);
    expect(again.tracks[0].name).toBe("Kalinka (slow)");
    expect(tracks[0].name).toBe("Kalinka");
  });

  it("refuses to grow past the cap", () => {
    const full = Array.from({ length: MUSIC_TRACKS_MAX }, (_, i) => ({ id: `v${i}` }));
    expect(addLocalMusicTrack(full, LOCAL, "x").reason).toBe("full");
  });
});

describe("normalizeMusicTracks with kinds", () => {
  it("carries kind through and defaults a missing one to youtube", () => {
    const out = normalizeMusicTracks([
      { id: "a", url: YT, name: "One" },
      { kind: "local", id: "local:kalinka.mp3", url: LOCAL, name: "Kalinka" },
    ]);
    expect(out[0].kind).toBe("youtube");
    expect(out[1].kind).toBe("local");
  });

  // Selection falls back to the first row, so a local row with no file url
  // would be chosen and then play nothing, with nothing to say why.
  it("drops a local row that has no usable file url", () => {
    const out = normalizeMusicTracks([
      { kind: "local", id: "local:x", url: "", name: "Ghost" },
      { kind: "local", id: "local:y", url: "https://not-a-file", name: "Ghost 2" },
      { kind: "local", id: "local:kalinka.mp3", url: LOCAL, name: "Kalinka" },
      { id: "a", url: "" },                       // a youtube row needs no url
    ]);
    expect(out.map(t => t.id)).toEqual(["local:kalinka.mp3", "a"]);
  });
});

describe("pruneMissingLocalTracks", () => {
  const mixed = [
    { id: "a", url: YT, name: "One" },
    { kind: "local", id: "local:kalinka.mp3", url: LOCAL, name: "Kalinka" },
    { kind: "local", id: "local:waltz.ogg", url: LOCAL2, name: "Waltz" },
  ];

  it("drops local tracks whose file is gone and keeps the ones still there", () => {
    const res = pruneMissingLocalTracks(mixed, [LOCAL]);
    expect(res.tracks.map(t => t.id)).toEqual(["a", "local:kalinka.mp3"]);
    expect(res.removed.map(t => t.name)).toEqual(["Waltz"]);
  });

  // A YouTube track is never swept: it isn't on disk to begin with, and
  // whether YouTube will serve it can change back.
  it("never removes a youtube track, even with nothing on disk", () => {
    const res = pruneMissingLocalTracks(mixed, []);
    expect(res.tracks.map(t => t.id)).toEqual(["a"]);
    expect(res.removed).toHaveLength(2);
  });

  it("removes nothing when every file is present", () => {
    const res = pruneMissingLocalTracks(mixed, [LOCAL, LOCAL2]);
    expect(res.removed).toEqual([]);
    expect(res.tracks).toHaveLength(3);
  });

  // A failed listing is not an empty disk. This is the rule that stops one bad
  // bridge call from wiping the library.
  it("removes nothing when there is no listing at all", () => {
    for (const none of [null, undefined, "oops", {}]) {
      const res = pruneMissingLocalTracks(mixed, none);
      expect(res.removed).toEqual([]);
      expect(res.tracks).toHaveLength(3);
    }
  });
});

describe("musicShouldPlay is independent of the source", () => {
  // The decision reads mode, phase, hush and error state — never what the
  // track is. Re-running the table against a local track proves it.
  const base = { hasTrack: true, playing: true, mode: "gap", phase: "gap" };
  it("gives a local track the same answers as a youtube one", () => {
    expect(musicShouldPlay({ ...base, mode: "nonstop", phase: "clip" })).toBe(true);
    expect(musicShouldPlay({ ...base, mode: "item", phase: "clip" })).toBe(true);
    expect(musicShouldPlay({ ...base, mode: "item", phase: "gap" })).toBe(false);
    expect(musicShouldPlay({ ...base, mode: "gap", phase: "gap" })).toBe(true);
    expect(musicShouldPlay({ ...base, phase: "video" })).toBe(false);
    expect(musicShouldPlay({ ...base, hushed: true })).toBe(false);
    expect(musicShouldPlay({ ...base, errored: true })).toBe(false);
  });
});

describe("resolveMusicTrack", () => {
  const settings = {
    recMusicTracks: [
      { id: "aaaaaaaaaaa", url: YT, name: "Rain" },
      { id: "bbbbbbbbbbb", url: "https://www.youtube.com/watch?v=bbbbbbbbbbb", name: "Waves" },
    ],
    recMusicSelected: "aaaaaaaaaaa",
  };

  it("plays the panel's track when neither the card nor the playlist says anything", () => {
    expect(resolveMusicTrack(settings, {}).name).toBe("Rain");
    expect(resolveMusicTrack(settings, null).name).toBe("Rain");
  });

  it("lets the playlist speak over the panel, and the card over both", () => {
    expect(resolveMusicTrack(settings, { playlistTrackId: "bbbbbbbbbbb" }).name).toBe("Waves");
    expect(resolveMusicTrack(settings, {
      playlistTrackId: "bbbbbbbbbbb", cardTrackId: "aaaaaaaaaaa",
    }).name).toBe("Rain");
  });

  it("treats silence as an answer, not as an empty one", () => {
    expect(resolveMusicTrack(settings, { cardTrackId: MUSIC_NONE })).toBeNull();
    // The card is silent even where its playlist named a track.
    expect(resolveMusicTrack(settings, {
      playlistTrackId: "bbbbbbbbbbb", cardTrackId: MUSIC_NONE,
    })).toBeNull();
    // A silent playlist still lets one of its cards name its own.
    expect(resolveMusicTrack(settings, {
      playlistTrackId: MUSIC_NONE, cardTrackId: "bbbbbbbbbbb",
    }).name).toBe("Waves");
  });

  it("falls through a track that is no longer in the library", () => {
    // Deleted from the panel, or its file swept away — going silent over an id
    // nothing can explain would leave the user nothing to look at.
    expect(resolveMusicTrack(settings, { cardTrackId: "ccccccccccc" }).name).toBe("Rain");
    expect(resolveMusicTrack(settings, {
      cardTrackId: "ccccccccccc", playlistTrackId: "bbbbbbbbbbb",
    }).name).toBe("Waves");
  });

  it("has nothing to play when the library is empty", () => {
    expect(resolveMusicTrack({}, { cardTrackId: "aaaaaaaaaaa" })).toBeNull();
  });
});

describe("musicNeedsReload", () => {
  // The bed keeps its position across the pauses between cards on purpose, so
  // this has to stay false everywhere except a track sitting at its end.
  // `ended` is only readable because the engine does not set `loop` — a
  // looping element never reports having ended.
  const el = (o) => Object.assign({ ended: false, paused: true, currentTime: 0, duration: 180 }, o);

  it("reloads an element that has ended", () => {
    expect(musicNeedsReload(el({ ended: true, currentTime: 180 }))).toBe(true);
  });

  it("reloads one paused at the end without having said it ended", () => {
    expect(musicNeedsReload(el({ currentTime: 180 }))).toBe(true);
  });

  it("counts the last position before the end as the end", () => {
    expect(musicNeedsReload(el({ currentTime: 180 - MUSIC_END_EPSILON / 2 }))).toBe(true);
    expect(musicNeedsReload(el({ currentTime: 180 - MUSIC_END_EPSILON * 4 }))).toBe(false);
  });

  it("leaves a paused track alone in the middle", () => {
    // Resuming from here is the whole point of keeping the position.
    expect(musicNeedsReload(el({ currentTime: 90 }))).toBe(false);
  });

  it("never touches a track that is still playing", () => {
    // Playback runs through the last fraction of a second on the way to the
    // end; reloading there would cut a track that was perfectly fine.
    expect(musicNeedsReload(el({ paused: false, currentTime: 179.99 }))).toBe(false);
    expect(musicNeedsReload(el({ paused: false, currentTime: 90 }))).toBe(false);
  });

  it("does not call a freshly loaded element finished", () => {
    // Nothing has played yet. Short tracks are the trap: with a duration
    // under the epsilon, position 0 is within reach of the end.
    expect(musicNeedsReload(el({ currentTime: 0 }))).toBe(false);
    expect(musicNeedsReload(el({ currentTime: 0, duration: 0.2 }))).toBe(false);
  });

  it("waits rather than reloading while the duration is still unknown", () => {
    // A stream being measured reports NaN; an endless one, Infinity.
    expect(musicNeedsReload(el({ duration: NaN, currentTime: 5 }))).toBe(false);
    expect(musicNeedsReload(el({ duration: Infinity, currentTime: 5 }))).toBe(false);
    expect(musicNeedsReload(el({ duration: 0, currentTime: 0 }))).toBe(false);
    expect(musicNeedsReload(el({ currentTime: NaN }))).toBe(false);
  });

  it("still reloads an ended element whose duration never arrived", () => {
    expect(musicNeedsReload(el({ ended: true, duration: NaN }))).toBe(true);
    expect(musicNeedsReload(el({ ended: true, paused: false }))).toBe(true);
  });

  it("treats a position past the duration as the end", () => {
    // A revised-down duration can leave the position beyond it.
    expect(musicNeedsReload(el({ currentTime: 200 }))).toBe(true);
  });

  it("has no opinion without an element", () => {
    expect(musicNeedsReload(null)).toBe(false);
    expect(musicNeedsReload(undefined)).toBe(false);
  });
});
