// Keep ClassicEditor's scroll viewport fitted to the resizable jQuery UI
// dialog. In particular, the CKEditor wrapper is often a sibling of the
// hidden .rce-host; sizing the host alone leaves a short editable at the top.
export function sizeRichCardEditingArea(dialogContent) {
  const root = dialogContent?.jquery ? dialogContent[0] : dialogContent;
  const shell = root?.querySelector('.ck-editor');
  const main = shell?.querySelector('.ck-editor__main');
  const editable = main?.querySelector('.ck-editor__editable');
  if (!root || !shell || !main || !editable ||
      !root.isConnected || !root.clientHeight || !shell.getClientRects().length) return false;

  const host = root.querySelector('.rce-host');
  const layoutBox = host?.contains(shell) ? host : shell;
  const css = getComputedStyle(root);
  const pad = (parseFloat(css.paddingTop) || 0) + (parseFloat(css.paddingBottom) || 0);
  const nonEditorHeight = [...root.children].filter(el =>
    el !== layoutBox && getComputedStyle(el).display !== 'none'
  ).reduce((total, el) => {
    const style = getComputedStyle(el);
    return total + el.getBoundingClientRect().height +
      (parseFloat(style.marginTop) || 0) + (parseFloat(style.marginBottom) || 0);
  }, 0);
  const shellHeight = Math.max(120, Math.floor(root.clientHeight - pad - nonEditorHeight - 4));
  const top = shell.querySelector('.ck-editor__top');
  const toolbarHeight = top?.getBoundingClientRect().height || 0;
  const editingHeight = Math.max(80, Math.floor(shellHeight - toolbarHeight - 2));

  // Remeasuring must never reset the user's reading/selection position.
  const scrollTop = editable.scrollTop;
  if (layoutBox !== shell) {
    layoutBox.style.flex = '0 0 auto';
    layoutBox.style.height = shellHeight + 'px';
    layoutBox.style.minHeight = '0';
    layoutBox.style.overflow = 'hidden';
  }
  Object.assign(shell.style, {
    display: 'flex', flexDirection: 'column', flex: '0 0 auto',
    height: shellHeight + 'px', minHeight: '0', overflow: 'hidden',
  });
  Object.assign(main.style, {
    display: 'flex', flexDirection: 'column', flex: '0 0 auto',
    height: editingHeight + 'px', minHeight: '0', overflow: 'hidden',
  });
  Object.assign(editable.style, {
    flex: '0 0 auto', height: editingHeight + 'px',
    minHeight: '0', maxHeight: 'none', overflowY: 'auto',
    touchAction: 'pan-y',
  });
  editable.scrollTop = scrollTop;
  // All scrolling should occur inside the editable, not in nested dialog
  // containers. Ancestor scrolling makes clicks on the bottom line jump up.
  root.scrollTop = 0;
  const dialog = root.closest('.ui-dialog');
  if (dialog) dialog.scrollTop = 0;
  return true;
}

// jQuery UI reports drag-resize, but not toolbar reflow, browser/window
// switching, DPR changes or the editor being restored after losing focus.
// Observe those changes and re-fit the real editable without touching data,
// selection or scrollTop. Call the returned cleanup before destroying the editor.
export function observeRichCardEditingArea(dialogContent) {
  const root = dialogContent?.jquery ? dialogContent[0] : dialogContent;
  if (!root) return () => {};
  let frame = 0;
  let disposed = false;
  const fit = () => {
    frame = 0;
    if (!disposed) sizeRichCardEditingArea(root);
  };
  const schedule = () => {
    if (!disposed && !frame) frame = requestAnimationFrame(fit);
  };
  const onVisibility = () => {
    if (!document.hidden) schedule();
  };
  const observer = typeof ResizeObserver === 'function'
    ? new ResizeObserver(schedule) : null;
  if (observer) {
    observer.observe(root);
    const shell = root.querySelector('.ck-editor');
    const top = shell?.querySelector('.ck-editor__top');
    if (shell) observer.observe(shell);
    if (top) observer.observe(top);
  }
  window.addEventListener('resize', schedule);
  window.addEventListener('focus', schedule);
  window.addEventListener('pageshow', schedule);
  document.addEventListener('visibilitychange', onVisibility);
  window.visualViewport?.addEventListener('resize', schedule);
  root.addEventListener('focusin', schedule);
  schedule();
  return () => {
    disposed = true;
    if (frame) cancelAnimationFrame(frame);
    observer?.disconnect();
    window.removeEventListener('resize', schedule);
    window.removeEventListener('focus', schedule);
    window.removeEventListener('pageshow', schedule);
    document.removeEventListener('visibilitychange', onVisibility);
    window.visualViewport?.removeEventListener('resize', schedule);
    root.removeEventListener('focusin', schedule);
  };
}
