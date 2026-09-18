/**
 * @jest-environment jsdom
 */
import {
  renderSrtEditsReviewList,
  collectSrtEditsByCheckbox,
  setSrtEditsGroupChecked,
  syncSrtEditsGroupBoxes,
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

describe("per-file select / deselect", () => {
  function twoFileVM() {
    return {
      state: "normal",
      groups: [
        sampleVM().groups[0],
        {
          filePath: "db/language/Swedish/srts/bar.en.srt",
          shortName: "bar.en.srt",
          count: 1,
          headLabel: "bar.en.srt — 1 edit",
          lines: [{ lineIndex: "7", newText: "only", ageLabel: "now" }],
        },
      ],
    };
  }

  test("a freshly rendered file is fully selected, not part-way", () => {
    const mount = makeMount();
    renderSrtEditsReviewList(sampleVM(), mount);
    const head = mount.querySelector(".srt-review-file-keep");
    expect(head.checked).toBe(true);
    expect(head.indeterminate).toBe(false);
  });

  test("the header box takes or leaves only its own file", () => {
    const mount = makeMount();
    renderSrtEditsReviewList(twoFileVM(), mount);
    const groups = mount.querySelectorAll(".srt-review-file");
    setSrtEditsGroupChecked(groups[0], false);
    syncSrtEditsGroupBoxes(mount);
    expect(collectSrtEditsByCheckbox(mount, true).map(e => e.lineIndex)).toEqual(["7"]);
    expect(groups[0].querySelector(".srt-review-file-keep").checked).toBe(false);
    expect(groups[1].querySelector(".srt-review-file-keep").checked).toBe(true);
  });

  test("unticking one row of a file leaves its header part-way", () => {
    const mount = makeMount();
    renderSrtEditsReviewList(sampleVM(), mount);
    mount.querySelectorAll(".srt-review-keep")[0].checked = false;
    syncSrtEditsGroupBoxes(mount);
    const head = mount.querySelector(".srt-review-file-keep");
    expect(head.checked).toBe(false);
    expect(head.indeterminate).toBe(true);
  });

  test("ticking the last row back fills the header in again", () => {
    const mount = makeMount();
    renderSrtEditsReviewList(sampleVM(), mount);
    const rows = mount.querySelectorAll(".srt-review-keep");
    rows[0].checked = false;
    syncSrtEditsGroupBoxes(mount);
    rows[0].checked = true;
    syncSrtEditsGroupBoxes(mount);
    const head = mount.querySelector(".srt-review-file-keep");
    expect(head.checked).toBe(true);
    expect(head.indeterminate).toBe(false);
  });

  test("a header box is not counted as one of its file's edits", () => {
    const mount = makeMount();
    renderSrtEditsReviewList(twoFileVM(), mount);
    expect(collectSrtEditsByCheckbox(mount, true).length).toBe(3);
  });

  test("no-ops on falsy elements", () => {
    expect(() => setSrtEditsGroupChecked(null, true)).not.toThrow();
    expect(() => syncSrtEditsGroupBoxes(null)).not.toThrow();
  });
});
