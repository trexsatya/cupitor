import { buildOembedUrl, parseOembedChannel } from "./youtube-channel.js";

describe("buildOembedUrl", () => {
  test("targets youtube oembed json for the video's watch url", () => {
    const url = buildOembedUrl("NxAaT1Yj9OE");
    expect(url).toContain("youtube.com/oembed");
    expect(url).toContain("format=json");
    expect(url).toContain(
      encodeURIComponent("https://www.youtube.com/watch?v=NxAaT1Yj9OE")
    );
  });
});

describe("parseOembedChannel", () => {
  test("returns author_name", () => {
    expect(parseOembedChannel({ author_name: "Some Channel" })).toBe("Some Channel");
  });

  test("returns empty string when missing", () => {
    expect(parseOembedChannel(null)).toBe("");
    expect(parseOembedChannel({})).toBe("");
  });
});
