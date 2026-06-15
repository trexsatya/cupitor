/**
 * @jest-environment jsdom
 */
import { renderLogViewerBody } from "./log-viewer-render";

const entry = (level, msg, t = 1700000000000) => ({ t, level, msg });

function makeMount() {
  const el = document.createElement("div");
  el.id = "logViewerBody";
  // Give it a reasonable scrollHeight so the scroll-to-bottom assertion has
  // something to chew on. jsdom doesn't lay out, so scrollHeight stays 0,
  // but we can still observe that scrollTop is set to whatever scrollHeight
  // returns at the time.
  return el;
}

describe("renderLogViewerBody", () => {
  test("renders one .log-line per row", () => {
    const mount = makeMount();
    const rows = [entry("error", "E"), entry("warn", "W"), entry("info", "I")];
    renderLogViewerBody(rows, mount);
    const lines = mount.querySelectorAll(".log-line");
    expect(lines.length).toBe(3);
  });
  test("each line has timestamp + level + message spans", () => {
    const mount = makeMount();
    renderLogViewerBody([entry("error", "boom")], mount);
    const line = mount.querySelector(".log-line");
    expect(line.querySelector(".log-ts").textContent).toBe("22:13:20.000");
    expect(line.querySelector(".log-level").textContent).toBe("error");
    expect(line.querySelector(".log-msg").textContent).toBe("boom");
  });
  test("stamps the level on the line via data-level", () => {
    const mount = makeMount();
    renderLogViewerBody([entry("warn", "x")], mount);
    expect(mount.querySelector(".log-line").getAttribute("data-level")).toBe("warn");
  });
  test("uses textContent — markup in a message stays as text", () => {
    const mount = makeMount();
    renderLogViewerBody([entry("log", "<script>alert(1)</script>")], mount);
    // The <script> never becomes a real element — it's rendered as text.
    expect(mount.querySelectorAll("script").length).toBe(0);
    expect(mount.querySelector(".log-msg").textContent)
      .toBe("<script>alert(1)</script>");
  });
  test("clears prior content before re-rendering", () => {
    const mount = makeMount();
    renderLogViewerBody([entry("log", "first")], mount);
    renderLogViewerBody([entry("log", "second")], mount);
    const lines = mount.querySelectorAll(".log-line");
    expect(lines.length).toBe(1);
    expect(lines[0].querySelector(".log-msg").textContent).toBe("second");
  });
  test("auto-scrolls to bottom by setting scrollTop = scrollHeight", () => {
    const mount = makeMount();
    // Fake scrollHeight since jsdom has no layout.
    Object.defineProperty(mount, "scrollHeight", { value: 9999, configurable: true });
    renderLogViewerBody([entry("log", "x")], mount);
    expect(mount.scrollTop).toBe(9999);
  });
  test("no-op when mountEl is falsy", () => {
    expect(() => renderLogViewerBody([entry("log", "x")], null)).not.toThrow();
    expect(() => renderLogViewerBody([entry("log", "x")], undefined)).not.toThrow();
  });
  test("null entries inside rows are skipped without throwing", () => {
    const mount = makeMount();
    renderLogViewerBody([null, entry("log", "ok"), undefined], mount);
    expect(mount.querySelectorAll(".log-line").length).toBe(1);
  });
  test("empty / null rows array renders nothing", () => {
    const mount = makeMount();
    renderLogViewerBody([], mount);
    expect(mount.querySelectorAll(".log-line").length).toBe(0);
    renderLogViewerBody(null, mount);
    expect(mount.querySelectorAll(".log-line").length).toBe(0);
  });
});
