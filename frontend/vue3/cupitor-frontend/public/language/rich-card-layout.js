// Explicitly size the CKEditor scroll viewport inside a resizable jQuery UI
// dialog. CSS flex-basis:0 alone is not reliable with ClassicEditor's nested
// editing surface: its content can end up with a 0px client height.
export function sizeRichCardEditingArea(dialogContent) {
  const root = dialogContent?.jquery ? dialogContent[0] : dialogContent;
  // ClassicEditor replaces the source .rce-host with its own .ck-editor
  // element, leaving the original source hidden as a sibling. Do not search
  // for .ck-editor *inside* .rce-host: that silently disables resize.
  const shell = root?.querySelector('.ck-editor');
  const main = shell?.querySelector('.ck-editor__main');
  const editable = main?.querySelector('.ck-editor__editable');
  if (!root || !shell || !main || !editable) return false;

  // Also handle builds that mount the editor inside a host rather than
  // replacing it. Measure only the actual editor-bearing layout box.
  const host = root.querySelector('.rce-host');
  const layoutBox = host?.contains(shell) ? host : shell;
  const css = getComputedStyle(root);
  const pad = (parseFloat(css.paddingTop) || 0) + (parseFloat(css.paddingBottom) || 0);
  const nonEditorHeight = Array.from(root.children).filter(el =>
    el !== layoutBox && getComputedStyle(el).display !== 'none'
  ).reduce((sum, el) => {
    const style = getComputedStyle(el);
    return sum + el.getBoundingClientRect().height +
      (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
  }, 0);
  const hostHeight = Math.max(140, Math.floor(root.clientHeight - pad - nonEditorHeight - 8));

  // jQuery UI updates the dialog content height on each resize event. Apply
  // its remaining vertical space to the actual CKEditor wrapper and editable.
  if (layoutBox !== shell) {
    layoutBox.style.flex = '0 0 auto';
    layoutBox.style.height = hostHeight + 'px';
    layoutBox.style.minHeight = '0';
    layoutBox.style.overflow = 'hidden';
  }
  shell.style.display = 'flex';
  shell.style.flexDirection = 'column';
  shell.style.flex = '0 0 auto';
  shell.style.height = hostHeight + 'px';
  shell.style.minHeight = '0';
  shell.style.overflow = 'hidden';

  const top = shell.querySelector('.ck-editor__top');
  const toolbarHeight = top?.getBoundingClientRect().height || 0;
  const editorHeight = Math.max(112, Math.floor(hostHeight - toolbarHeight - 2));
  main.style.display = 'flex';
  main.style.flexDirection = 'column';
  main.style.flex = '0 0 auto';
  main.style.height = editorHeight + 'px';
  main.style.minHeight = '0';
  main.style.overflow = 'hidden';
  editable.style.flex = '0 0 auto';
  editable.style.height = editorHeight + 'px';
  editable.style.minHeight = '0';
  editable.style.maxHeight = 'none';
  editable.style.overflowY = 'auto';
  editable.style.touchAction = 'pan-y';
  return true;
}
