/**
 * @jest-environment jsdom
 */
import {
  renderPlayingSubsList,
  updatePlayingBanner,
} from "./playing-ui-render";

const mount = () => document.createElement("div");

describe("renderPlayingSubsList", () => {
  test("renders the 'no-primary' error placeholder", () => {
    const el = mount();
    renderPlayingSubsList({ state: "no-primary" }, el);
    expect(el.querySelector(".rec-ps-err").textContent)
      .toContain("Subtitles unavailable");
  });
  test("renders the 'no-match' error placeholder", () => {
    const el = mount();
    renderPlayingSubsList({ state: "no-match" }, el);
    expect(el.querySelector(".rec-ps-err").textContent)
      .toContain("Matched line not found");
  });
  test("renders one .rec-ps-row per VM row, with data-line-i", () => {
    const el = mount();
    renderPlayingSubsList({
      state: "ok", from: 0, to: 1, matchIdx: 0, primary: [],
      rows: [
        { i: 0, mainText: "a", secText: "A", active: true, highlightHtml: null },
        { i: 1, mainText: "b", secText: "B", active: false, highlightHtml: null },
      ]
    }, el);
    const rows = el.querySelectorAll(".rec-ps-row");
    expect(rows.length).toBe(2);
    expect(rows[0].getAttribute("data-line-i")).toBe("0");
    expect(rows[0].classList.contains("rec-ps-active")).toBe(true);
    expect(rows[1].classList.contains("rec-ps-active")).toBe(false);
  });
  test("plain text rows use .textContent", () => {
    const el = mount();
    renderPlayingSubsList({
      state: "ok", from: 0, to: 0, matchIdx: 0, primary: [],
      rows: [{ i: 0, mainText: "<script>x</script>", secText: "", active: true, highlightHtml: null }]
    }, el);
    expect(el.querySelector(".rec-ps-main").textContent).toBe("<script>x</script>");
    expect(el.querySelectorAll("script").length).toBe(0);
  });
  test("highlightHtml rows use .innerHTML (must be pre-escaped by the VM)", () => {
    const el = mount();
    renderPlayingSubsList({
      state: "ok", from: 0, to: 0, matchIdx: 0, primary: [],
      rows: [{
        i: 0,
        mainText: "doesn't matter",
        secText: "",
        active: true,
        highlightHtml: 'before <mark class="hl-word">match</mark> after'
      }]
    }, el);
    const main = el.querySelector(".rec-ps-main");
    expect(main.querySelector("mark.hl-word")).not.toBeNull();
    expect(main.querySelector("mark.hl-word").textContent).toBe("match");
  });
  test("empty secText → no .rec-ps-sec element", () => {
    const el = mount();
    renderPlayingSubsList({
      state: "ok", from: 0, to: 0, matchIdx: 0, primary: [],
      rows: [{ i: 0, mainText: "a", secText: "", active: true, highlightHtml: null }]
    }, el);
    expect(el.querySelector(".rec-ps-sec")).toBeNull();
  });
  test("clears prior content on re-render", () => {
    const el = mount();
    renderPlayingSubsList({
      state: "ok", from: 0, to: 0, matchIdx: 0, primary: [],
      rows: [{ i: 0, mainText: "first", secText: "", active: true, highlightHtml: null }]
    }, el);
    renderPlayingSubsList({ state: "no-primary" }, el);
    expect(el.querySelector(".rec-ps-list")).toBeNull();
  });
  test("no-op when mountEl is falsy", () => {
    expect(() => renderPlayingSubsList({ state: "ok", rows: [] }, null)).not.toThrow();
  });
});

describe("updatePlayingBanner", () => {
  function bannerEl() {
    const el = document.createElement("div");
    el.innerHTML = `
      <span class="rec-pb-count"></span>
      <span class="rec-pb-bar"></span>
      <span class="rec-pb-gap-val"></span>
      <div class="rec-pb-head"></div>
      <div class="rec-pb-meta"></div>
    `;
    return el;
  }

  test("populates the mutable text/value fields", () => {
    const banner = bannerEl();
    const word = document.createElement("div");
    updatePlayingBanner({
      progressText: "3/5", headText: "h", metaText: "m", gapLabel: "30s", word: "W"
    }, banner, word);
    expect(banner.querySelector(".rec-pb-count").textContent).toBe("3/5");
    expect(banner.querySelector(".rec-pb-head").textContent).toBe("h");
    expect(banner.querySelector(".rec-pb-meta").textContent).toBe("m");
    expect(banner.querySelector(".rec-pb-gap-val").textContent).toBe("30s");
    expect(banner.querySelector(".rec-pb-bar").style.width).toBe("0%");
    expect(word.textContent).toBe("W");
  });
  test("uses .textContent — markup stays as text", () => {
    const banner = bannerEl();
    updatePlayingBanner({
      progressText: "1/1", headText: "<i>x</i>", metaText: "", gapLabel: "0s", word: ""
    }, banner, null);
    expect(banner.querySelector(".rec-pb-head").textContent).toBe("<i>x</i>");
    expect(banner.querySelectorAll("i").length).toBe(0);
  });
  test("no-op when both banner and word are null", () => {
    expect(() => updatePlayingBanner({
      progressText: "", headText: "", metaText: "", gapLabel: "", word: ""
    }, null, null)).not.toThrow();
  });
});
