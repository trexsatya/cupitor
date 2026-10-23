// Display the original file, including cue numbers and timestamps. Search
// excerpts and result limits must never determine the contents of this view.
export function createFullSrtDialog($, { win = window, loadSubtitle, getLanguage }) {
  let $dialog;
  let request = 0;
  let current;
  let tracks = [];

  function selectTrack() {
    const selected = $dialog.find('.full-srt-language').val();
    const track = tracks.find(track => track.key === selected);
    // Text, rather than HTML: SRT markup is part of the file being displayed.
    $dialog.find('.full-srt-text').text(track?.text || '');
    $dialog[0].scrollTop = 0;
  }

  function ensureDialog() {
    if ($dialog) return $dialog;
    $dialog = $(`<div id="fullSrtDialog">
      <div class="full-srt-toolbar">
        <div class="full-srt-name"></div>
        <label class="full-srt-language-label" for="fullSrtLanguage">Language
          <select id="fullSrtLanguage" class="full-srt-language"></select>
        </label>
      </div>
      <p class="full-srt-status" role="status"></p>
      <button type="button" class="full-srt-retry lang-tool-btn">Try again</button>
      <pre class="full-srt-text" tabindex="0" aria-label="Complete SRT text"></pre>
    </div>`).appendTo(win.document.body);
    $dialog.on('change', '.full-srt-language', selectTrack);
    $dialog.on('click', '.full-srt-retry', () => {
      if (current) open(current.id, current.source, current.title);
    });
    $dialog.dialog({
      title: 'Complete SRT', autoOpen: false,
      width: Math.min(900, win.innerWidth - 20),
      draggable: false, resizable: false,
      buttons: { Close() { $(this).dialog('close'); } },
      open() { $(this).closest('.ui-dialog').attr('tabindex', '-1').focus(); },
      // A late response must neither reopen a closed dialog nor replace a
      // newer link's subtitles in the shared dialog.
      close() { request++; },
    });
    return $dialog;
  }

  async function open(id, source, title) {
    const $view = ensureDialog();
    const token = ++request;
    current = { id, source, title };
    tracks = [];
    $view.find('.full-srt-name').text(title || id);
    $view.find('.full-srt-language-label, .full-srt-retry, .full-srt-text').hide();
    $view.find('.full-srt-language').empty();
    $view.find('.full-srt-text').text('');
    $view.find('.full-srt-status').text('Loading complete SRT…').show();
    $view.attr('aria-busy', 'true').dialog('open');
    $view[0].scrollTop = 0;
    try {
      const subtitle = await loadSubtitle(id, source);
      if (token !== request) return;
      if (subtitle?._partial) {
        $view.find('.full-srt-status').text('Only captured excerpts are available. The complete SRT could not be loaded.');
        $view.find('.full-srt-retry').show();
        return;
      }
      const language = getLanguage();
      if (typeof subtitle?.sv === 'string' && subtitle.sv.trim()) {
        tracks.push({ key: 'sv', label: language.fullName || language.code || 'Original', text: subtitle.sv });
      }
      if (typeof subtitle?.en === 'string' && subtitle.en.trim() && (language.code !== 'en' || !tracks.length)) {
        tracks.push({ key: 'en', label: 'English', text: subtitle.en });
      }
      if (!tracks.length) {
        $view.find('.full-srt-status').text('No SRT is available for this link.');
        $view.find('.full-srt-retry').show();
        return;
      }
      $view.find('.full-srt-name').text(subtitle.fileName || title || id);
      tracks.forEach(track => $('<option>').val(track.key).text(track.label).appendTo($view.find('.full-srt-language')));
      $view.find('.full-srt-language-label').show();
      $view.find('.full-srt-status').hide();
      $view.find('.full-srt-text').show();
      selectTrack();
    } catch (_) {
      if (token !== request) return;
      $view.find('.full-srt-status').text('The complete SRT could not be loaded. Please try again.');
      $view.find('.full-srt-retry').show();
    } finally {
      if (token === request) $view.attr('aria-busy', 'false');
    }
  }

  return open;
}
