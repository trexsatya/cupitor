import { handleRichCardFormattingShortcut, installRichCardShortcuts } from './rich-card-shortcuts.js';

function fixture() {
  const calls = [];
  let onKey;
  const editor = {
    commands: { get: name => ['bold', 'italic', 'underline', 'strikethrough'].includes(name)
      ? { isEnabled: true } : null },
    execute: name => calls.push(name),
    editing: { view: {
      getDomRoot: () => ({ addEventListener: (kind, fn, capture) => {
        expect(kind).toBe('keydown');
        expect(capture).toBe(true);
        onKey = fn;
      } }),
      focus() {},
    } },
  };
  return { editor, calls, dispatch: opts => {
    const ev = {
      key: opts.key, ctrlKey: !!opts.ctrlKey, metaKey: !!opts.metaKey,
      shiftKey: !!opts.shiftKey, altKey: !!opts.altKey,
      repeat: !!opts.repeat, isComposing: false,
      preventDefault: jest.fn(), stopImmediatePropagation: jest.fn(),
    };
    const handled = onKey ? onKey(ev) : handleRichCardFormattingShortcut(editor, ev);
    return { ev, handled };
  } };
}

test.each([
  ['b', false, 'bold'],
  ['i', false, 'italic'],
  ['u', false, 'underline'],
  ['x', true, 'strikethrough'],
])('Ctrl+%s%s formats only inside the rich editor', (key, shiftKey, name) => {
  const { editor, calls, dispatch } = fixture();
  installRichCardShortcuts(editor);
  const { ev } = dispatch({ key, ctrlKey: true, shiftKey });
  expect(ev.preventDefault).toHaveBeenCalledTimes(1);
  expect(ev.stopImmediatePropagation).toHaveBeenCalledTimes(1);
  expect(calls).toEqual([name]);
});

test('Command shortcuts work on Mac Meta modifier as well as Control', () => {
  const { editor, calls, dispatch } = fixture();
  installRichCardShortcuts(editor);
  const { ev } = dispatch({ key: 'B', metaKey: true });
  expect(ev.preventDefault).toHaveBeenCalledTimes(1);
  expect(calls).toEqual(['bold']);
});

test('Other shortcuts, Alt combinations, repeats and unmodified keys are untouched', () => {
  const { editor, calls, dispatch } = fixture();
  installRichCardShortcuts(editor);
  for (const options of [
    { key: 'u' },
    { key: 'u', altKey: true, ctrlKey: true },
    { key: 'x', ctrlKey: true },
    { key: 'b', ctrlKey: true, shiftKey: true },
    { key: 'b', ctrlKey: true, repeat: true },
    { key: 'z', ctrlKey: true },
  ]) {
    const { ev } = dispatch(options);
    expect(ev.preventDefault).not.toHaveBeenCalled();
  }
  expect(calls).toEqual([]);
});

test('Unavailable formatting commands are not intercepted', () => {
  const { editor, dispatch } = fixture();
  editor.commands.get = () => ({ isEnabled: false });
  const { ev } = dispatch({ key: 'b', metaKey: true });
  expect(ev.preventDefault).not.toHaveBeenCalled();
});
