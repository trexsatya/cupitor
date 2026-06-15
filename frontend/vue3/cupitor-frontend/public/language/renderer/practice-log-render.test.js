/**
 * @jest-environment jsdom
 */
import {
  renderPracticeLogPlan,
  renderPracticeLogHistory,
} from "./practice-log-render";

const makeMount = () => document.createElement("div");

function planVM() {
  return {
    weekLabel: "2026-W24",
    items: [
      { name: "Reading", status: "done", notes: "ok", isDefault: true },
      { name: "Custom",  status: "not_started", notes: "", isDefault: false },
    ],
  };
}

function historyVM() {
  return {
    state: "normal",
    retainWeeks: 50,
    weeks: [
      { label: "2026-W24", empty: true, items: [] },
      {
        label: "2026-W23",
        empty: false,
        items: [
          { name: "Reading", status: "done", notes: "wrote a journal",
            statusLabel: "Done", statusCls: "pl-status-done" },
          { name: "Writing", status: "in_progress", notes: "",
            statusLabel: "In progress", statusCls: "pl-status-progress" },
        ],
      },
    ],
  };
}

describe("renderPracticeLogPlan — structure", () => {
  test("renders one .practice-log-item per item", () => {
    const mount = makeMount();
    renderPracticeLogPlan(planVM(), mount);
    expect(mount.querySelectorAll(".practice-log-item").length).toBe(2);
  });
  test("updates the optional weekLabelEl", () => {
    const mount = makeMount();
    const label = document.createElement("h3");
    renderPracticeLogPlan(planVM(), mount, {}, label);
    expect(label.textContent).toBe("Week 2026-W24");
  });
  test("each row has the item name + status select + notes textarea", () => {
    const mount = makeMount();
    renderPracticeLogPlan(planVM(), mount);
    const first = mount.querySelectorAll(".practice-log-item")[0];
    expect(first.querySelector(".practice-log-item-name").textContent).toBe("Reading");
    expect(first.querySelector(".practice-log-item-status").value).toBe("done");
    expect(first.querySelector(".practice-log-item-notes").value).toBe("ok");
    expect(first.getAttribute("data-item-name")).toBe("Reading");
  });
  test("custom items get an × remove button; default items get a placeholder div", () => {
    const mount = makeMount();
    renderPracticeLogPlan(planVM(), mount);
    const rows = mount.querySelectorAll(".practice-log-item");
    expect(rows[0].querySelector(".practice-log-item-remove")).toBeNull();    // default
    expect(rows[1].querySelector(".practice-log-item-remove")).not.toBeNull(); // custom
  });
});

describe("renderPracticeLogPlan — callbacks", () => {
  test("onStatusChange fires with (name, newValue) when the select changes", () => {
    const mount = makeMount();
    const onStatusChange = jest.fn();
    renderPracticeLogPlan(planVM(), mount, { onStatusChange });
    const select = mount.querySelector(".practice-log-item-status");
    select.value = "in_progress";
    select.dispatchEvent(new Event("change"));
    expect(onStatusChange).toHaveBeenCalledWith("Reading", "in_progress");
  });
  test("onNotesChange fires with (name, newNotes) on input", () => {
    const mount = makeMount();
    const onNotesChange = jest.fn();
    renderPracticeLogPlan(planVM(), mount, { onNotesChange });
    const ta = mount.querySelector(".practice-log-item-notes");
    ta.value = "edited";
    ta.dispatchEvent(new Event("input"));
    expect(onNotesChange).toHaveBeenCalledWith("Reading", "edited");
  });
  test("onRemoveItem fires when the × button is clicked", () => {
    const mount = makeMount();
    const onRemoveItem = jest.fn();
    renderPracticeLogPlan(planVM(), mount, { onRemoveItem });
    mount.querySelector(".practice-log-item-remove").click();
    expect(onRemoveItem).toHaveBeenCalledWith("Custom");
  });
});

describe("renderPracticeLogHistory", () => {
  test("renders the empty-state copy", () => {
    const mount = makeMount();
    renderPracticeLogHistory({ state: "empty", retainWeeks: 50 }, mount);
    expect(mount.textContent).toContain("No history yet");
  });
  test("renders one .practice-log-history-week per week", () => {
    const mount = makeMount();
    renderPracticeLogHistory(historyVM(), mount);
    expect(mount.querySelectorAll(".practice-log-history-week").length).toBe(2);
  });
  test("empty week shows (no items)", () => {
    const mount = makeMount();
    renderPracticeLogHistory(historyVM(), mount);
    const firstWeek = mount.querySelectorAll(".practice-log-history-week")[0];
    expect(firstWeek.textContent).toContain("(no items)");
  });
  test("items render with status badge + name; notes hidden by default", () => {
    const mount = makeMount();
    renderPracticeLogHistory(historyVM(), mount);
    const w23 = mount.querySelectorAll(".practice-log-history-week")[1];
    const items = w23.querySelectorAll(".practice-log-history-item");
    expect(items.length).toBe(2);
    expect(items[0].querySelector(".pl-status").textContent).toBe("Done");
    expect(items[0].textContent).toContain("· Reading");
    // Reading has notes → notes div present but hidden
    const notesDiv = items[0].querySelector(".practice-log-history-notes");
    expect(notesDiv).not.toBeNull();
    expect(notesDiv.style.display).toBe("none");
  });
  test("clicking 💬 toggles the notes div", () => {
    const mount = makeMount();
    renderPracticeLogHistory(historyVM(), mount);
    const w23 = mount.querySelectorAll(".practice-log-history-week")[1];
    const toggle = w23.querySelector(".practice-log-notes-toggle");
    const notes = w23.querySelector(".practice-log-history-notes");
    expect(notes.style.display).toBe("none");
    toggle.click();
    expect(notes.style.display).toBe("");
    expect(toggle.title).toBe("Hide notes");
    toggle.click();
    expect(notes.style.display).toBe("none");
    expect(toggle.title).toBe("Show notes");
  });
  test("items without notes don't get a 💬 button", () => {
    const mount = makeMount();
    renderPracticeLogHistory(historyVM(), mount);
    const w23 = mount.querySelectorAll(".practice-log-history-week")[1];
    const writingRow = w23.querySelectorAll(".practice-log-history-item")[1];
    expect(writingRow.querySelector(".practice-log-notes-toggle")).toBeNull();
  });
  test("no-op when mountEl is falsy", () => {
    expect(() => renderPracticeLogHistory(historyVM(), null)).not.toThrow();
  });
});
