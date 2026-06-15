/**
 * @jest-environment jsdom
 */
import {
  renderSrtEditsReviewList,
  collectSrtEditsByCheckbox,
} from "./srt-edits-review-render";

function makeMount() { return document.createElement("div"); }

function sampleVM() {
  return {
    state: "normal",
    groups: [
      {
        filePath: "db/language/Swedish/srts/foo.sv.srt",
        shortName: "foo.sv.srt",
        count: 2,
        headLabel: "foo.sv.srt — 2 edits",
        lines: [
          { lineIndex: "1", newText: "first", ageLabel: "just now" },
          { lineIndex: "2", newText: "second", ageLabel: "5m ago" },
        ],
      },
    ],
  };
}

describe("renderSrtEditsReviewList — structure", () => {
  test("renders the empty-state message", () => {
    const mount = makeMount();
    renderSrtEditsReviewList({ state: "empty", groups: [] }, mount);
    expect(mount.querySelector(".srt-review-empty")).toBeTruthy();
    expect(mount.textContent).toContain("No pending edits.");
  });
  test("renders one file group with the file head", () => {
    const mount = makeMount();
    renderSrtEditsReviewList(sampleVM(), mount);
    const heads = mount.querySelectorAll(".srt-review-file-head");
    expect(heads.length).toBe(1);
    expect(heads[0].textContent).toBe("foo.sv.srt — 2 edits");
    expect(heads[0].title).toBe("db/language/Swedish/srts/foo.sv.srt");
  });
  test("renders one .srt-review-row per line, with data-file and data-line attributes", () => {
    const mount = makeMount();
    renderSrtEditsReviewList(sampleVM(), mount);
    const rows = mount.querySelectorAll(".srt-review-row");
    expect(rows.length).toBe(2);
    expect(rows[0].getAttribute("data-line")).toBe("1");
    expect(rows[1].getAttribute("data-line")).toBe("2");
    expect(rows[0].getAttribute("data-file")).toBe("db/language/Swedish/srts/foo.sv.srt");
  });
  test("each row has a checked checkbox, age label, and editable textarea", () => {
    const mount = makeMount();
    renderSrtEditsReviewList(sampleVM(), mount);
    const row = mount.querySelector(".srt-review-row");
    const cb = row.querySelector(".srt-review-keep");
    expect(cb.checked).toBe(true);
    expect(row.querySelector(".srt-review-age").textContent).toBe("just now");
    const ta = row.querySelector(".srt-review-text");
    expect(ta.value).toBe("first");
    expect(ta.rows).toBe(2);
  });
  test("clears prior content on re-render", () => {
    const mount = makeMount();
    renderSrtEditsReviewList(sampleVM(), mount);
    renderSrtEditsReviewList({ state: "empty", groups: [] }, mount);
    expect(mount.querySelectorAll(".srt-review-row").length).toBe(0);
    expect(mount.querySelector(".srt-review-empty")).toBeTruthy();
  });
  test("uses safe DOM APIs — file path with markup stays as text", () => {
    const mount = makeMount();
    renderSrtEditsReviewList({
      state: "normal",
      groups: [{
        filePath: "<i>weird</i>", shortName: "<b>x</b>", count: 1,
        headLabel: "<i>x</i> — 1 edit",
        lines: [{ lineIndex: "1", newText: "<script>", ageLabel: "now" }],
      }],
    }, mount);
    expect(mount.querySelectorAll("i").length).toBe(0);
    expect(mount.querySelectorAll("script").length).toBe(0);
    const row = mount.querySelector(".srt-review-row");
    expect(row.getAttribute("data-file")).toBe("<i>weird</i>");   // attribute value, not parsed
    expect(row.querySelector(".srt-review-text").value).toBe("<script>");
  });
  test("no-op when mountEl is falsy", () => {
    expect(() => renderSrtEditsReviewList(sampleVM(), null)).not.toThrow();
  });
});

describe("collectSrtEditsByCheckbox", () => {
  test("returns rows whose checkbox is checked, with current textarea value", () => {
    const mount = makeMount();
    renderSrtEditsReviewList(sampleVM(), mount);
    // Uncheck the second row.
    const rows = mount.querySelectorAll(".srt-review-row");
    rows[1].querySelector(".srt-review-keep").checked = false;
    // User tweaks the first row's text.
    rows[0].querySelector(".srt-review-text").value = "EDITED";
    const out = collectSrtEditsByCheckbox(mount, true);
    expect(out).toEqual([
      {
        filePath: "db/language/Swedish/srts/foo.sv.srt",
        lineIndex: "1",
        newText: "EDITED",
      }
    ]);
  });
  test("can also collect the unchecked rows when called with false", () => {
    const mount = makeMount();
    renderSrtEditsReviewList(sampleVM(), mount);
    mount.querySelectorAll(".srt-review-row")[0].querySelector(".srt-review-keep").checked = false;
    const out = collectSrtEditsByCheckbox(mount, false);
    expect(out.length).toBe(1);
    expect(out[0].lineIndex).toBe("1");
  });
  test("returns [] for falsy mount", () => {
    expect(collectSrtEditsByCheckbox(null, true)).toEqual([]);
  });
  test("returns [] when there are no review rows", () => {
    const mount = makeMount();
    renderSrtEditsReviewList({ state: "empty", groups: [] }, mount);
    expect(collectSrtEditsByCheckbox(mount, true)).toEqual([]);
  });
});
