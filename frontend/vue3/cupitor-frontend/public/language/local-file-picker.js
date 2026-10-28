// Local media subtitle picker. A browser/Android file chooser does not let us
// reorder the device's files, so prioritise filename matches *after* the user
// grants access. Never claim a suggested file is available before it is chosen.

export function localMediaStem(name) {
  return String(name || '').replace(/\.(mp3|wav|mp4)$/i, '');
}

function normalised(name) {
  return String(name || '').normalize('NFC').toLocaleLowerCase();
}

export function isLocalMediaFile(name) {
  return /\.(mp3|wav|mp4)$/i.test(String(name || ''));
}

export async function readLocalSubtitleText(file) {
  const bytes = new Uint8Array(await new Response(file).arrayBuffer());
  let encoding = 'utf-8';
  if (bytes[0] === 0xff && bytes[1] === 0xfe) encoding = 'utf-16le';
  else if (bytes[0] === 0xfe && bytes[1] === 0xff) encoding = 'utf-16be';
  let text;
  try { text = new TextDecoder(encoding, {fatal:true}).decode(bytes); }
  catch (error) {
    if (encoding !== 'utf-8') throw error;
    text = new TextDecoder('windows-1252').decode(bytes);
  }
  return text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
}

export function localSubtitleRank(mediaName, subtitleName, targetLanguage = 'sv') {
  const stem = normalised(localMediaStem(mediaName));
  const name = normalised(subtitleName);
  if (!stem || !name.endsWith('.srt')) return null;
  if (name === stem + '.srt') return 0;
  const prefix = stem + '.';
  if (!name.startsWith(prefix)) return 4;
  const suffix = name.slice(prefix.length);
  if (!/^[a-z]{2,3}\.srt$/.test(suffix)) return 4;
  if (suffix === normalised(targetLanguage) + '.srt') return 1;
  if (suffix === 'en.srt') return 2;
  return 3;
}

export function rankLocalSubtitles(mediaName, files, targetLanguage = 'sv') {
  return (files || [])
    .filter(file => file && /\.srt$/i.test(file.name || ''))
    .map((file, index) => ({
      file,
      rank: localSubtitleRank(mediaName, file.name, targetLanguage),
      index,
    }))
    .filter(entry => entry.rank !== null)
    .sort((a, b) => a.rank - b.rank ||
      normalised(a.file.name).localeCompare(normalised(b.file.name)) || a.index - b.index);
}

export function matchingEnglishSubtitle(mediaName, files, primary) {
  // An unrelated user-chosen SRT may have different timing; do not silently
  // attach a same-named English track to it.
  if (!primary || localSubtitleRank(mediaName, primary.name, 'sv') >= 4 ||
      localSubtitleRank(mediaName, primary.name, 'sv') === null) return null;
  return (files || []).find(file => file !== primary &&
    /\.en\.srt$/i.test(file.name || '') &&
    localSubtitleRank(mediaName, file.name, 'sv') === 2) || null;
}

// UI integration. onPlay owns player state, while this module owns only the
// temporary File handles and their selection.
export function openLocalSubtitlePicker({files, mediaFile: currentMedia, targetLanguage = 'sv', attachOnly = false, onPlay}) {
  const mediaFile = currentMedia || (files || []).find(file => isLocalMediaFile(file && file.name));
  if (!mediaFile) {
    alert('Choose an MP3, WAV or MP4 media file first.');
    return;
  }
  const subtitleFiles = (files || []).filter(file => file && /\.srt$/i.test(file.name));
  let selected = null;
  let busy = false;

  const $old = $('#localSubtitlePickerDialog');
  if ($old.length) {
    if ($old.hasClass('ui-dialog-content')) $old.dialog('destroy');
    $old.remove();
  }
  const $dlg = $('<div id="localSubtitlePickerDialog"></div>').appendTo('body');
  const $media = $('<div class="local-subtitle-media"></div>').appendTo($dlg);
  $('<small></small>').text('CURRENT MEDIA').appendTo($media);
  $('<strong></strong>').text(mediaFile.name).appendTo($media);
  const $matchTitle = $('<h4>Suggested matches</h4>').appendTo($dlg);
  const $matches = $('<div class="local-subtitle-list"></div>').appendTo($dlg);
  const $otherTitle = $('<h4>Other subtitle files</h4>').appendTo($dlg);
  const $others = $('<div class="local-subtitle-list"></div>').appendTo($dlg);
  const $companion = $('<p class="local-subtitle-note"></p>').appendTo($dlg);
  const $error = $('<p class="local-subtitle-error" role="alert"></p>').hide().appendTo($dlg);
  const $browse = $('<button type="button" class="lang-tool-btn">Choose subtitle files…</button>').appendTo($dlg);
  const $input = $('<input type="file" multiple accept=".srt" aria-label="Choose SRT files">')
    .hide().appendTo($dlg);
  const $footer = $('<div class="local-subtitle-actions"></div>').appendTo($dlg);
  const $use = $('<button type="button" class="lang-tool-btn"></button>')
    .text(attachOnly ? 'Apply subtitles' : 'Use subtitle & play').appendTo($footer);
  const $without = $('<button type="button" class="lang-tool-btn"></button>')
    .text(attachOnly ? 'Remove subtitles' : 'Play without subtitles').appendTo($footer);
  const $cancel = $('<button type="button" class="lang-tool-btn">Cancel</button>').appendTo($footer);

  function render() {
    const ranked = rankLocalSubtitles(mediaFile.name, subtitleFiles, targetLanguage);
    const matches = ranked.filter(entry => entry.rank < 4);
    const others = ranked.filter(entry => entry.rank === 4);
    if (selected && !subtitleFiles.includes(selected)) selected = null;
    if (!selected && matches.length) selected = matches[0].file;
    $matches.empty();
    $others.empty();

    function addRows(rows, $parent) {
      for (const {file, rank} of rows) {
        const $row = $('<label class="local-subtitle-file"></label>')
          .toggleClass('is-selected', file === selected);
        const $radio = $('<input type="radio" name="local-subtitle-selection">')
          .prop('checked', file === selected);
        $radio.on('change', () => { selected = file; render(); });
        $row.append($radio);
        const $body = $('<span class="local-subtitle-file-body"></span>');
        $('<strong></strong>').text(file.name).appendTo($body);
        if (rank < 4) {
          $('<small></small>').text(rank === 0 ? 'Exact filename match' : 'Matching media name')
            .appendTo($body);
        }
        $parent.append($row.append($body));
      }
    }

    addRows(matches, $matches);
    addRows(others, $others);
    if (!matches.length) {
      $('<p class="local-subtitle-note"></p>')
        .text('Expected: ' + localMediaStem(mediaFile.name) + '.srt. Choose subtitle files to look for it.')
        .appendTo($matches);
    }
    $otherTitle.toggle(others.length > 0);
    if (!others.length) $others.empty();
    const companion = matchingEnglishSubtitle(mediaFile.name, subtitleFiles, selected);
    $companion.text(companion
      ? 'English companion will also be loaded: ' + companion.name : '');
    $use.prop('disabled', !selected || busy);
    $without.prop('disabled', busy);
    $browse.prop('disabled', busy);
    $cancel.prop('disabled', busy);
  }

  $browse.on('click', () => $input.trigger('click'));
  $input.on('change', function () {
    for (const file of Array.from(this.files || [])) {
      if (/\.srt$/i.test(file.name)) {
        const index = subtitleFiles.findIndex(old => old.name === file.name);
        if (index >= 0) {
          if (selected === subtitleFiles[index]) selected = file;
          subtitleFiles.splice(index, 1);
        }
        subtitleFiles.push(file);
      }
    }
    this.value = ''; // Selecting the same name again should still open a new selection.
    render();
  });

  async function play(withSubtitles) {
    if (busy || (withSubtitles && !selected)) return;
    busy = true;
    $error.hide().text('');
    render();
    try {
      await onPlay({
        mediaFile,
        subtitleFile: withSubtitles ? selected : null,
        englishFile: withSubtitles
          ? matchingEnglishSubtitle(mediaFile.name, subtitleFiles, selected) : null,
      });
      $dlg.dialog('close');
    } catch (error) {
      $error.text('Could not open media: ' + (error && error.message || error)).show();
    } finally {
      busy = false;
      if ($dlg.closest('body').length) render();
    }
  }

  $use.on('click', () => play(true));
  $without.on('click', () => play(false));
  $cancel.on('click', () => $dlg.dialog('close'));
  $dlg.dialog({
    title: attachOnly ? 'Change subtitles' : 'Select subtitles',
    width: Math.max(280, Math.min(510, window.innerWidth - 24)),
    maxHeight: window.innerHeight - 24,
    modal: true,
    resizable: false,
    close: function () {
      const input = document.getElementById('localFiles');
      if (input) input.value = '';
      $(this).dialog('destroy').remove();
    },
  });
  render();
}
