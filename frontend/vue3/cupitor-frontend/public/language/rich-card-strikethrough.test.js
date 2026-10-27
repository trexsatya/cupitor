import { toggleRichCardStrikethrough } from "./rich-card-strikethrough.js";

function fakeEditor({ collapsed = false, active = false, native = false } = {}) {
    const range = { start: 0, end: 4 };
    const calls = [];
    const selection = {
        isCollapsed: collapsed,
        getAttribute: () => active,
        getRanges: () => [range]
    };
    const writer = {
        setAttribute: (...args) => calls.push(["set", ...args]),
        removeAttribute: (...args) => calls.push(["remove", ...args]),
        setSelectionAttribute: (...args) => calls.push(["setSelection", ...args]),
        removeSelectionAttribute: (...args) => calls.push(["removeSelection", ...args])
    };
    const editor = {
        commands: { get: () => native ? {} : null },
        execute: command => calls.push(["execute", command]),
        model: {
            document: { selection },
            change: callback => callback(writer),
            schema: { getValidRanges: () => [range] }
        },
        editing: { view: { focus: () => calls.push(["focus"]) } }
    };
    return { editor, calls, range };
}

describe("manual-card strikethrough command", () => {
    test("strikes selected text and leaves focus in the editor", () => {
        const { editor, calls, range } = fakeEditor();
        toggleRichCardStrikethrough(editor);
        expect(calls).toEqual([["set", "cupCardStrike", true, range], ["focus"]]);
    });

    test("removes strikethrough from selected text", () => {
        const { editor, calls, range } = fakeEditor({ active: true });
        toggleRichCardStrikethrough(editor);
        expect(calls).toEqual([["remove", "cupCardStrike", range], ["focus"]]);
    });

    test("at the caret, changes the attribute for subsequently typed text", () => {
        const { editor, calls } = fakeEditor({ collapsed: true });
        toggleRichCardStrikethrough(editor);
        expect(calls).toEqual([["setSelection", "cupCardStrike", true], ["focus"]]);
    });

    test("uses the editor's native strikethrough command when available", () => {
        const { editor, calls } = fakeEditor({ native: true });
        toggleRichCardStrikethrough(editor);
        expect(calls).toEqual([["execute", "strikethrough"], ["focus"]]);
    });
});
