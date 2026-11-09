// Place a rich-card editor above its owning card dialog. Practice/Player
// uses a near-max-int layer; the ordinary 100030 dialog layer is insufficient
// there, and silently puts Apply/Cancel/Close behind the parent dialog.
export function arrangeRichCardDialog($rich, $source, { studyActive = false, studyZ = 2147483647 } = {}) {
  const $owner = $source.closest('.ui-dialog-content');
  const owner = $owner.length && $owner.dialog('instance');
  const $parent = $owner.closest('.ui-dialog');
  const parentNode = $parent[0];
  const previousZ = parentNode?.style.getPropertyValue('z-index') || '';
  const previousPriority = parentNode?.style.getPropertyPriority('z-index') || '';
  const wasModal = !!owner?.options.modal;

  // Only one modal focus trap and overlay should be active. The rich dialog
  // blocks the parent until it closes; the parent becomes modal again then.
  if (wasModal) $owner.dialog('option', 'modal', false);

  const $wrapper = $rich.closest('.ui-dialog');
  const wrapper = $wrapper[0];
  const overlay = $rich.dialog('instance')?.overlay?.[0];
  if (studyActive) {
    // The study view's dialogopen handler already lifts to this z-index.
    // Never overwrite it with 100030, even when nested in a modal card editor.
    $wrapper.appendTo('body').removeClass('behind-study-view').addClass('above-practice-mode');
    wrapper?.style.setProperty('z-index', String(studyZ), 'important');
    if (parentNode && parentNode !== wrapper) {
      parentNode.style.setProperty('z-index', String(studyZ - 3), 'important');
    }
    overlay?.style.setProperty('z-index', String(studyZ - 1), 'important');
  } else {
    wrapper?.style.setProperty('z-index', '100030', 'important');
    overlay?.style.setProperty('z-index', '100029', 'important');
  }

  let restored = false;
  return () => {
    if (restored) return;
    restored = true;
    if (!owner || !parentNode?.isConnected || !$owner.dialog('isOpen')) return;
    // Restore the parent's precise previous layer and modal state even when
    // the rich dialog is cancelled or fails while CKEditor is still loading.
    if (previousZ) parentNode.style.setProperty('z-index', previousZ, previousPriority);
    else parentNode.style.removeProperty('z-index');
    if (wasModal) $owner.dialog('option', 'modal', true);
  };
}
