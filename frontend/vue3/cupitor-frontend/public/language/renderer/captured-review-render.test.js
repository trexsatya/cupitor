/**
 * @jest-environment jsdom
 */
import {
  renderCapturedReviewList,
  applyCapturedRowStatus,
} from "./captured-review-render";

const mount = () => document.createElement("div");

function item(id, detail) {
  return { id, capturedAt: 0, detail };
}

describe("renderCapturedReviewList", () => {
  test("empty / null buffer → placeholder paragraph", () => {
    const el = mount();
    renderCapturedReviewList([], el);
    expect(el.querySelector("p").textContent).toContain("No captured subtitles pending.");
    renderCapturedReviewList(null, el);
    expect(el.querySelector("p")).not.toBeNull();
  });
  test("renders one .captured-item per buffer entry", () => {
    const el = mount();
    renderCapturedReviewList([
      item("a", { videoId: "v1", videoTitle: "T1", sourceLang: "sv", targetLang: "en", lines: [1, 2], translation: [1] }),
      item("b", { videoId: "v2", videoTitle: "T2" }),
    ], el);
    const rows = el.querySelectorAll(".captured-item");
    expect(rows.length).toBe(2);
    expect(rows[0].getAttribute("data-id")).toBe("a");
    expect(rows[1].getAttribute("data-id")).toBe("b");
  });
  test("each row has title, meta, query block (when query present), and 3 action buttons", () => {
    const el = mount();
    renderCapturedReviewList([
      item("a", { videoId: "v1", videoTitle: "Title", query: "trolla", matchIndex: 5 })
    ], el);
    const row = el.querySelector(".captured-item");
    expect(row.querySelector("[data-role='srt-status']").textContent).toBe("checking…");
    const actions = row.querySelectorAll("button[data-action]");
    expect(actions.length).toBe(3);
    expect(Array.from(actions, b => b.getAttribute("data-action"))).toEqual(["preview", "push", "delete"]);
    expect(row.querySelector("code").textContent).toBe("trolla");
  });
  test("query block is omitted when query is empty", () => {
    const el = mount();
    renderCapturedReviewList([
      item("a", { videoId: "v1", videoTitle: "T" })
    ], el);
    expect(el.querySelectorAll("code").length).toBe(0);
  });
  test("uses safe DOM APIs — markup in title stays as text", () => {
    const el = mount();
    renderCapturedReviewList([
      item("a", { videoId: "v1", videoTitle: "<script>X</script>" })
    ], el);
    expect(el.querySelectorAll("script").length).toBe(0);
    expect(el.querySelector(".captured-item > div").textContent).toBe("<script>X</script>");
  });
  test("preview pre element starts hidden", () => {
    const el = mount();
    renderCapturedReviewList([item("a", { videoId: "v1" })], el);
    const pre = el.querySelector("[data-role='preview']");
    expect(pre.style.display).toBe("none");
  });
  test("clears prior content on re-render", () => {
    const el = mount();
    renderCapturedReviewList([item("a", { videoId: "v1" })], el);
    renderCapturedReviewList([], el);
    expect(el.querySelectorAll(".captured-item").length).toBe(0);
  });
});

describe("applyCapturedRowStatus", () => {
  function buildRow() {
    const el = mount();
    renderCapturedReviewList([item("a", { videoId: "v1", videoTitle: "T" })], el);
    return el.querySelector(".captured-item");
  }

  test("'modify' state sets data-srt-state, updates status text, and renames push button", () => {
    const row = buildRow();
    applyCapturedRowStatus(row, "modify", "Foo Channel || Title || vid");
    expect(row.getAttribute("data-srt-state")).toBe("modify");
    const status = row.querySelector("[data-role='srt-status']");
    expect(status.textContent).toContain("modifying existing SRT");
    expect(status.textContent).toContain("Foo Channel || Title || vid");
    expect(row.querySelector("button[data-action='push']").textContent).toBe("Push (merge)");
  });
  test("'new' state shows the green 'new SRT' label and leaves the push button alone", () => {
    const row = buildRow();
    applyCapturedRowStatus(row, "new");
    expect(row.getAttribute("data-srt-state")).toBe("new");
    expect(row.querySelector("[data-role='srt-status']").textContent).toBe("new SRT");
    expect(row.querySelector("button[data-action='push']").textContent).toBe("Push This");
  });
  test("'error' / unknown state shows 'status unknown'", () => {
    const row = buildRow();
    applyCapturedRowStatus(row, "error");
    expect(row.querySelector("[data-role='srt-status']").textContent).toBe("status unknown");
  });
  test("uses textContent — no innerHTML injection", () => {
    const row = buildRow();
    applyCapturedRowStatus(row, "modify", "<script>x</script>");
    expect(row.querySelectorAll("script").length).toBe(0);
  });
  test("clears prior content before re-applying", () => {
    const row = buildRow();
    applyCapturedRowStatus(row, "modify", "first");
    applyCapturedRowStatus(row, "new");
    expect(row.querySelector("[data-role='srt-status']").textContent).toBe("new SRT");
  });
  test("no-op when rowEl is falsy", () => {
    expect(() => applyCapturedRowStatus(null, "new")).not.toThrow();
  });
});
