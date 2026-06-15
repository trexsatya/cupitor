// View-model for the "Review pending SRT edits" dialog. Given the
// localStorage-backed pending-edits map, produce the grouped, sorted
// rows the dialog needs to render — plus a count helper used by the
// Settings "Sync edits (N)" button.
//
// Pending-edits shape (mirrors what _savePendingSrtEdits stores):
//   {
//     [filePath: 'db/language/<Lang>/srts/<base>.<langCode>.srt']: {
//       [lineIndex: '42']: { newText: '…', ts: 1700000000000 }
//     }
//   }

// Total queued edits across all files.
export function pendingSrtEditCount(edits) {
  return Object.values(edits || {}).reduce(
    (n, perFile) => n + Object.keys(perFile || {}).length, 0
  )
}

// Trim the long `db/language/<Lang>/srts/` prefix so the header is
// readable; the full path stays in the dialog row via title=.
function shortenFilePath(filePath) {
  return String(filePath).replace(/^db\/language\/[^/]+\/srts\//, '')
}

// Render-friendly "5m ago" / "just now" label for an edit's timestamp.
// `now` is the time-of-render in ms; rounding to the nearest minute.
function ageLabel(now, ts) {
  const ageMin = Math.round(Math.max(0, now - (ts || 0)) / 60000)
  return ageMin < 1 ? 'just now' : ageMin + 'm ago'
}

// Build the review-dialog VM. Files are grouped together (sorted by
// filePath for stable order); within each file, edits are sorted by
// numeric line index so a user scanning the list sees them in playback
// order. Empty/missing input yields { state: 'empty', groups: [] }.
//
// `opts.now` lets tests pin "now" for deterministic age labels.
export function buildSrtEditsReviewVM(edits, opts = {}) {
  const now = (opts.now != null) ? opts.now : Date.now()
  const paths = Object.keys(edits || {}).sort()
  if (!paths.length) return { state: 'empty', groups: [] }

  const groups = []
  paths.forEach(filePath => {
    const lines = edits[filePath] || {}
    const lineKeys = Object.keys(lines).sort((a, b) => parseInt(a, 10) - parseInt(b, 10))
    if (!lineKeys.length) return
    const shortName = shortenFilePath(filePath)
    groups.push({
      filePath,
      shortName,
      count: lineKeys.length,
      headLabel: `${shortName} — ${lineKeys.length} edit${lineKeys.length === 1 ? '' : 's'}`,
      lines: lineKeys.map(li => {
        const entry = lines[li] || {}
        return {
          lineIndex: li,
          newText: String(entry.newText || ''),
          ageLabel: ageLabel(now, entry.ts),
        }
      }),
    })
  })

  if (!groups.length) return { state: 'empty', groups: [] }
  return { state: 'normal', groups }
}
