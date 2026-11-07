import { toggleRichCardStrikethrough } from './rich-card-strikethrough.js';
import { toggleRichCardUnderline } from './rich-card-underline.js';

// Use one capture handler on the editable surface so the browser's own
// Cmd/Ctrl+U (View Source), and CKEditor's built-in Bold/Italic bindings, do
// not run a second time. Other input fields and shortcuts are untouched.
export function handleRichCardFormattingShortcut(editor, event) {
  if ((!event.metaKey && !event.ctrlKey) || event.altKey ||
      event.isComposing || event.repeat) return false;
  const key = String(event.key || '').toLowerCase();
  let command;
  if (!event.shiftKey && key === 'b') command = 'bold';
  else if (!event.shiftKey && key === 'i') command = 'italic';
  else if (!event.shiftKey && key === 'u') command = 'underline';
  else if (event.shiftKey && key === 'x') command = 'strikethrough';
  else return false;

  const native = editor.commands.get(command);
  if ((command === 'bold' || command === 'italic') && (!native || native.isEnabled === false))
    return false;
  if (native && native.isEnabled === false) return false;

  event.preventDefault();
  event.stopImmediatePropagation?.();
  if (command === 'underline') toggleRichCardUnderline(editor);
  else if (command === 'strikethrough') toggleRichCardStrikethrough(editor);
  else editor.execute(command);
  return true;
}

export function installRichCardShortcuts(editor) {
  const editable = editor.editing.view.getDomRoot();
  if (!editable) throw new Error('Rich editor editable element is unavailable');
  editable.addEventListener('keydown', event => {
    handleRichCardFormattingShortcut(editor, event);
  }, true);
}
