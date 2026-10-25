// Keep native scrolling inside a dialog while its title and actions stay visible.
export function installDialogScrolling($, win = window) {
  const doc = win.document;
  let frame = 0;

  function layout(element, opening = false) {
    const wrapper = $(element).closest('.ui-dialog');
    if (!wrapper.length) return;
    if (opening) wrapper.css('display', 'flex');
    const viewport = win.visualViewport;
    const width = viewport?.width || win.innerWidth;
    const height = viewport?.height || win.innerHeight;
    const gap = Math.min(20, height / 10);
    wrapper.addClass('cupitor-scroll-dialog').css({
      position: 'fixed',
      top: ((viewport?.offsetTop || 0) + gap) + 'px',
      margin: 0,
      '--cupitor-dialog-height': Math.max(0, height - 2 * gap) + 'px',
      '--cupitor-dialog-width': Math.max(0, width - 20) + 'px',
    });
    // Measure after changing the width limit, including on device rotation.
    const left = (viewport?.offsetLeft || 0) +
      Math.max(10, (width - wrapper.outerWidth()) / 2);
    wrapper.css('left', left + 'px');
  }

  function refresh() {
    frame = 0;
    // Update hidden dialogs too, so minimizing across a rotation stays safe.
    // Only dialogopen changes display; resize must never restore a dialog.
    $('.ui-dialog > .ui-dialog-content').each(function () { layout(this); });
  }

  function schedule() {
    if (!frame) frame = win.requestAnimationFrame(refresh);
  }

  $(doc).on('dialogopen.cupitorScrolling', event => {
    layout(event.target, true);
    // Some dialogs restore their previous size immediately after opening.
    schedule();
  });
  win.addEventListener('resize', schedule);
  win.visualViewport?.addEventListener('resize', schedule);
  win.visualViewport?.addEventListener('scroll', schedule);

  // A cold notification can open a dialog before the document-ready
  // installer runs. Adopt those open windows without restoring hidden ones.
  $('.ui-dialog:visible > .ui-dialog-content').each(function () { layout(this, true); });

  return () => {
    $(doc).off('.cupitorScrolling');
    win.removeEventListener('resize', schedule);
    win.visualViewport?.removeEventListener('resize', schedule);
    win.visualViewport?.removeEventListener('scroll', schedule);
    if (frame) win.cancelAnimationFrame(frame);
  };
}
