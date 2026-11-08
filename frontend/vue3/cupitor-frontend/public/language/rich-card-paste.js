// Per-editor paste preference. Off by default so external HTML (fonts,
// colors, headings, links, etc.) cannot unexpectedly restyle a manual card.
export function plainTextPasteHtml(text) {
  const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const lines = String(text).replace(/\r\n?/g, '\n').split('\n');
  // A single-line paste should be inline, not split the current paragraph.
  if (lines.length === 1) return escape(lines[0]);
  // Plain-text newlines are soft breaks, not paragraph boundaries. Creating
  // one <p> per line introduces paragraph spacing on every copy/paste cycle.
  // Keep genuine empty lines as consecutive <br> elements instead.
  return '<p>' + lines.map(escape).join('<br>') + '</p>';
}

export function installRichCardPasteControl(editor, checkbox) {
  const clipboard = editor.plugins.get('ClipboardPipeline');
  // This runs before CKEditor's normal inputTransformation listener turns the
  // clipboard view fragment into model content. It preserves CKEditor's own
  // insertion, undo/redo and selection behavior.
  clipboard.on('inputTransformation', (_event, data) => {
    if (checkbox.checked || data.method === 'drop') return;
    const plain = data.dataTransfer?.getData?.('text/plain');
    // An image-only paste has no plain-text representation. Keep CKEditor's
    // upload pipeline intact rather than silently discarding the image.
    if (!plain) return;
    data.content = editor.data.processor.toView(plainTextPasteHtml(plain));
  }, { priority: 'high' });
}
