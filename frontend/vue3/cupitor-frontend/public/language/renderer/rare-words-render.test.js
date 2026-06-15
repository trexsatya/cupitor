/**
 * @jest-environment jsdom
 */
import {
  renderRareWordsList,
  renderRareWordsPager,
  renderRareWordsCategorySelect,
} from "./rare-words-render";

function makeMount(tag = "div") {
  const el = document.createElement(tag);
  return el;
}

describe("renderRareWordsList", () => {
  test("renders the empty-state message", () => {
    const mount = makeMount();
    renderRareWordsList({ state: "empty", rows: [] }, mount);
    expect(mount.textContent).toContain("Nothing to show yet");
    expect(mount.querySelector(".rare-words-empty")).toBeTruthy();
  });
  test("renders the no-matches message", () => {
    const mount = makeMount();
    renderRareWordsList({ state: "no-matches", rows: [] }, mount);
    expect(mount.textContent).toContain("No matches in this category.");
  });
  test("renders one button per item with text and count spans", () => {
    const mount = makeMount();
    const vm = {
      state: "normal",
      rows: [
        { kind: "item", line: "trolla", count: 0, category: "Verbs" },
        { kind: "item", line: "förråta", count: 1, category: "Verbs" },
      ],
    };
    renderRareWordsList(vm, mount);
    const btns = mount.querySelectorAll("button.rare-word-item");
    expect(btns.length).toBe(2);
    expect(btns[0].querySelector(".rare-word-text").textContent).toBe("trolla");
    expect(btns[0].querySelector(".rare-word-count").textContent).toBe("0");
  });
  test("renders category headers before items when grouped", () => {
    const mount = makeMount();
    const vm = {
      state: "normal",
      rows: [
        { kind: "header", category: "Verbs" },
        { kind: "item", line: "a", count: 0, category: "Verbs" },
        { kind: "header", category: "Adjectives" },
        { kind: "item", line: "b", count: 0, category: "Adjectives" },
      ],
    };
    renderRareWordsList(vm, mount);
    expect(mount.querySelectorAll(".rare-words-cat-hdr").length).toBe(2);
    expect(mount.querySelector(".rare-words-cat-hdr").textContent).toBe("Verbs");
  });
  test("calls onItemClick with the line when a button is clicked", () => {
    const mount = makeMount();
    const onClick = jest.fn();
    renderRareWordsList(
      { state: "normal", rows: [{ kind: "item", line: "trolla", count: 0, category: "V" }] },
      mount,
      onClick
    );
    mount.querySelector("button.rare-word-item").click();
    expect(onClick).toHaveBeenCalledWith("trolla");
  });
  test("clears prior content before re-rendering", () => {
    const mount = makeMount();
    renderRareWordsList(
      { state: "normal", rows: [{ kind: "item", line: "first", count: 0, category: "V" }] },
      mount
    );
    renderRareWordsList(
      { state: "normal", rows: [{ kind: "item", line: "second", count: 0, category: "V" }] },
      mount
    );
    const btns = mount.querySelectorAll("button.rare-word-item");
    expect(btns.length).toBe(1);
    expect(btns[0].querySelector(".rare-word-text").textContent).toBe("second");
  });
  test("uses textContent — markup in a line stays as text", () => {
    const mount = makeMount();
    renderRareWordsList(
      { state: "normal", rows: [{ kind: "item", line: "<i>foo</i>", count: 0, category: "V" }] },
      mount
    );
    expect(mount.querySelectorAll("i").length).toBe(0);
    expect(mount.querySelector(".rare-word-text").textContent).toBe("<i>foo</i>");
  });
  test("no-op when mountEl is falsy", () => {
    expect(() => renderRareWordsList({ state: "empty", rows: [] }, null)).not.toThrow();
  });
});

describe("renderRareWordsPager", () => {
  test("no-op (empty mount) when pages <= 1", () => {
    const mount = makeMount();
    mount.appendChild(document.createElement("span"));   // pre-existing junk
    renderRareWordsPager({ page: 0, pages: 1 }, mount);
    expect(mount.children.length).toBe(0);
  });
  test("renders prev/info/next when pages > 1", () => {
    const mount = makeMount();
    renderRareWordsPager({ page: 1, pages: 3 }, mount);
    expect(mount.querySelectorAll("button").length).toBe(2);
    expect(mount.querySelector(".rare-words-pageinfo").textContent).toBe("Page 2 / 3");
  });
  test("prev is disabled on page 0; next is disabled on the last page", () => {
    const mount = makeMount();
    renderRareWordsPager({ page: 0, pages: 3 }, mount);
    const [prev, next] = mount.querySelectorAll("button");
    expect(prev.disabled).toBe(true);
    expect(next.disabled).toBe(false);

    renderRareWordsPager({ page: 2, pages: 3 }, mount);
    const btns = mount.querySelectorAll("button");
    expect(btns[0].disabled).toBe(false);
    expect(btns[1].disabled).toBe(true);
  });
  test("onPrev / onNext fire on click", () => {
    const mount = makeMount();
    const onPrev = jest.fn();
    const onNext = jest.fn();
    renderRareWordsPager({ page: 1, pages: 3 }, mount, { onPrev, onNext });
    const [prev, next] = mount.querySelectorAll("button");
    prev.click();
    next.click();
    expect(onPrev).toHaveBeenCalled();
    expect(onNext).toHaveBeenCalled();
  });
  test("stopPropagation on the click event keeps outside-click handlers quiet", () => {
    const mount = makeMount();
    document.body.appendChild(mount);
    const documentHandler = jest.fn();
    document.addEventListener("click", documentHandler);
    renderRareWordsPager({ page: 1, pages: 3 }, mount, { onNext: () => {} });
    mount.querySelectorAll("button")[1].click();
    expect(documentHandler).not.toHaveBeenCalled();
    document.removeEventListener("click", documentHandler);
    document.body.removeChild(mount);
  });
});

describe("renderRareWordsCategorySelect", () => {
  test("renders one <option> per entry, with value and label", () => {
    const mount = makeMount("select");
    renderRareWordsCategorySelect(
      [{ value: "", label: "All (3)" }, { value: "V", label: "Verbs — 2" }],
      mount
    );
    const opts = mount.querySelectorAll("option");
    expect(opts.length).toBe(2);
    expect(opts[0].value).toBe("");
    expect(opts[0].textContent).toBe("All (3)");
    expect(opts[1].value).toBe("V");
    expect(opts[1].textContent).toBe("Verbs — 2");
  });
  test("clears prior options before re-rendering", () => {
    const mount = makeMount("select");
    mount.appendChild(document.createElement("option"));
    mount.appendChild(document.createElement("option"));
    renderRareWordsCategorySelect([{ value: "", label: "All (0)" }], mount);
    expect(mount.querySelectorAll("option").length).toBe(1);
  });
  test("uses textContent — markup in a label stays as text", () => {
    const mount = makeMount("select");
    renderRareWordsCategorySelect([{ value: "x", label: "<b>boo</b>" }], mount);
    expect(mount.querySelector("option").textContent).toBe("<b>boo</b>");
  });
  test("no-op for empty / falsy options", () => {
    const mount = makeMount("select");
    renderRareWordsCategorySelect([], mount);
    expect(mount.children.length).toBe(0);
    renderRareWordsCategorySelect(null, mount);
    expect(mount.children.length).toBe(0);
  });
});
